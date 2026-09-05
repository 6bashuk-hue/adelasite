// netlify/functions/lib/pricing.js
//
// Shared trusted pricing for orders — used by place-order.js (solo orders),
// update-group-items.js and submit-group-order.js (group orders) so every path
// re-prices a cart against the live menu/extras/neighbors config, never trusting
// prices sent by the client. Also holds the delivery-zone lookup
// (site.config.js `commerce.deliveryZones`), shared by the same three functions.

const SITE_CONFIG = require("../../../site.config.js");
const NEIGHBORS_CONFIG = require("../../../neighbors.config.js");

class PricingError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Build {name -> price} maps from the authoritative menu/extras nodes.
function flattenPrices(node) {
  const map = new Map();
  if (!node || typeof node !== "object") return map;
  const addItem = (it) => {
    if (it && it.name != null && Number.isFinite(Number(it.price))) map.set(String(it.name), Number(it.price));
  };
  for (const section of Object.values(node)) {
    if (Array.isArray(section)) {
      section.forEach(addItem);
    } else if (section && typeof section === "object") {
      // A section is normally a list of items, but special entries (chefSpecial /
      // coupleMeal) are stored as a single priced item object — handle both.
      if (section.name != null && Number.isFinite(Number(section.price))) addItem(section);
      else Object.values(section).forEach(addItem);
    }
  }
  return map;
}

// ── "עוד מהשכונה" — trusted price tables built from the static neighbors.config.js,
// scoped per business key. This is the ONLY source of truth for guest-item prices;
// nothing here ever reads a price from the request body. Scoping by business key
// (instead of one shared name→price map) means a name that happens to collide with
// אדלה בשוק's own menu — or between the two neighbors — can never be mispriced: each
// business's items/extras only ever get looked up in their own table.
function buildNeighborPriceMaps() {
  const byKey = new Map();
  for (const biz of (NEIGHBORS_CONFIG.businesses || [])) {
    const items = new Map();
    const extras = new Map();
    for (const sec of (biz.sections || [])) {
      for (const item of (sec.items || [])) {
        if (item && item.name != null && Number.isFinite(Number(item.price))) {
          items.set(String(item.name), Number(item.price));
        }
        if (Array.isArray(item.extras)) {
          for (const e of item.extras) {
            if (e && e.name != null && Number.isFinite(Number(e.price))) {
              extras.set(String(e.name), Number(e.price));
            }
          }
        }
      }
    }
    byKey.set(biz.key, { name: biz.name, icon: biz.icon || null, items, extras });
  }
  return byKey;
}
const NEIGHBOR_PRICES = buildNeighborPriceMaps();

// Re-price a raw cart (as sent by the client: [{name, source, extras:[{name,qty}], notes, choice}])
// against the live price maps. `source` is "self" (or omitted) for the diner's — er,
// אדלה בשוק's — own menu, or a NEIGHBORS_CONFIG business key for a guest dish.
// Returns {orderItems, itemsTotal, selfItemsTotal}. Throws PricingError(409/400) for a
// sold-out, unknown, or off-menu item — callers should turn that into the matching
// HTTP error response.
function priceCart(items, { menuPrices, extraPrices, soldOut, menuLoaded }) {
  const orderItems = [];
  let itemsTotal = 0;
  // אדלה בשוק's own items only — guest ("עוד מהשכונה") items never count toward the
  // threshold-nudge free item.
  let selfItemsTotal = 0;
  for (const raw of items) {
    const itemName = String((raw && raw.name) || "").slice(0, 120);
    if (!itemName) continue;
    const rawSource = String((raw && raw.source) || "self").slice(0, 40);
    const isGuest = rawSource !== "self";

    let basePrice, extraPriceMap, sourceName = null, sourceIcon = null;

    if (!isGuest) {
      if (soldOut.has(itemName)) throw new PricingError(409, `הפריט "${itemName}" אזל מהמלאי`);
      if (menuLoaded) {
        if (!menuPrices.has(itemName)) throw new PricingError(409, `הפריט "${itemName}" כבר לא בתפריט — רענן את הדף`);
        basePrice = menuPrices.get(itemName);
      } else {
        basePrice = Math.max(0, Number(raw.basePrice) || 0);
      }
      extraPriceMap = extraPrices;
    } else {
      const biz = NEIGHBOR_PRICES.get(rawSource);
      if (!biz || !biz.items.has(itemName)) throw new PricingError(409, `הפריט "${itemName}" לא נמצא בתפריט השכן`);
      basePrice = biz.items.get(itemName);
      extraPriceMap = biz.extras;
      sourceName = biz.name;
      sourceIcon = biz.icon;
    }

    const rawExtras = (Array.isArray(raw.extras) ? raw.extras : []).slice(0, 30);
    const extras = [];
    for (const e of rawExtras) {
      const en = String((e && e.name) || "").slice(0, 120);
      if (!en) continue;
      const qty = Math.max(1, Math.min(20, Math.floor(Number(e && e.qty) || 1)));
      let price;
      if (isGuest) {
        if (!extraPriceMap.has(en)) throw new PricingError(409, `התוספת "${en}" לא נמצאה בתפריט השכן`);
        price = extraPriceMap.get(en);
      } else {
        price = menuLoaded && extraPriceMap.has(en) ? extraPriceMap.get(en) : Math.max(0, Number(e && e.price) || 0);
      }
      extras.push({ name: en, qty, price });
    }

    const extrasSum = extras.reduce((s, e) => s + e.qty * e.price, 0);
    const lineTotal = basePrice + extrasSum;
    itemsTotal += lineTotal;
    if (!isGuest) selfItemsTotal += lineTotal;
    const choice = String((raw && raw.choice) || "").slice(0, 80);
    orderItems.push({
      name: itemName, basePrice, extras,
      choice: choice || null,
      notes: String((raw && raw.notes) || "").slice(0, 280),
      total: lineTotal,
      source: isGuest ? rawSource : "self",
      sourceName, sourceIcon
    });
  }
  return { orderItems, itemsTotal, selfItemsTotal };
}

// ── Delivery zones (site.config.js `commerce.deliveryZones`) ──
function getDeliveryZones() {
  const z = SITE_CONFIG.commerce && SITE_CONFIG.commerce.deliveryZones;
  return Array.isArray(z) ? z : [];
}
function findDeliveryZone(key) {
  return getDeliveryZones().find(z => z.key === key) || null;
}

module.exports = {
  PricingError,
  flattenPrices,
  priceCart,
  getDeliveryZones, findDeliveryZone
};
