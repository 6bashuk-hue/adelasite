// neighbors.config.js — "עוד מהשכונה" (More from the neighborhood).
//
// Trusted, static menu data for the neighboring businesses (הדיינר, 6 בשוק) that
// customers can add to an אדלה בשוק order. This file is the SAME kind of shared,
// server-trusted config as site.config.js — it works in three places with zero
// build step:
//   1. <script src="/neighbors.config.js"> in the browser (index.html)  → window.NEIGHBORS_CONFIG
//   2. require("../../neighbors.config.js") inside Netlify Functions     → module.exports
//   3. importScripts("/neighbors.config.js") if ever needed in a worker  → self.NEIGHBORS_CONFIG
//
// ⚠️ SECURITY: place-order.js re-prices every "guest" cart item against THIS file —
// never against anything the browser sends. Each business's items/extras are looked
// up in their OWN scoped table (keyed by `source`), so a name that happens to collide
// with אדלה בשוק's own menu (or between the two neighbors) can never be mispriced —
// there is no shared/flat name→price map to collide in.
//
// ⚠️ These prices/items are transcribed from menus shared in chat and have NOT been
// verified against the neighbors' current physical menus — proofread before launch.
// Notably: 6 בשוק's drinks and "ארוחה זוגית" bundle are deliberately left out (drinks
// aren't offered from any neighbor here; the couple's-meal price wasn't confirmed).
(function (root) {

  // Diner burger/chicken topping pool — shared by every burger & chicken item below.
  // Format matches a menu item's own custom `extras` array: {name, price}.
  const DINER_TOPPINGS = [
    { name: "קציצה נוספת", price: 18 },
    { name: "גבינה טבעונית", price: 12 },
    { name: "ביצת עין", price: 10 },
    { name: "ריבת פלפלים", price: 10 },
    { name: "שום קונפי", price: 8 },
    { name: "פטריות", price: 8 },
    { name: "בצל מקורמל", price: 8 },
    { name: "שדרוג לארוחה — כולל צ'יפס אישי ושתייה קלה (נא לציין בהערות איזו שתייה)", price: 20 }
  ];

  // 6 בשוק pizza toppings — regular + premium, combined into one flat list (the
  // extras modal shows one checklist; the two original price tiers are preserved).
  const SIXBASHUK_PIZZA_TOPPINGS = [
    { name: "קלמטה", price: 7 },
    { name: "בצל סגול", price: 7 },
    { name: "פטריות", price: 7 },
    { name: "חלפיניו", price: 7 },
    { name: "עגבניות שרי", price: 7 },
    { name: "גבינת עיזים", price: 12 },
    { name: "ארטישוק", price: 12 },
    { name: "פרמזן", price: 12 },
    { name: "מוצרלה נוספת", price: 12 },
    { name: "גבינה טבעונית", price: 12 },
    { name: "ערמונים קלויים", price: 12 },
    { name: "בצל מקורמל", price: 12 }
  ];

  const NEIGHBORS_CONFIG = {
    businesses: [
      {
        key: "diner",
        name: "הדיינר",
        icon: "🍔",
        note: "דיינר אמריקאי",
        sections: [
          {
            key: "burgers",
            label: "המבורגרים",
            items: [
              { name: "סמאש בורגר", desc: "רוטב הבית, חסה לליק, מלפפון חמוץ, עגבנייה, בצל סגול", price: 40, extras: DINER_TOPPINGS },
              { name: "ביג גוי סמאש", desc: "רוטב הבית, סמאש כפול, סגולים מוחמצים, חסה לליק, עגבנייה צרובה ושום קונפי", price: 69, extras: DINER_TOPPINGS },
              { name: "פפר סמאש 🌶️", desc: "סמאש כפול, רוטב הבית, חסה לליק, עגבנייה, בצל סגול, חמוצים וריבת פלפלים", price: 69, extras: DINER_TOPPINGS },
              { name: "אוקלהומה סמאש", desc: "סמאש כפול צרוב עם בצל חי, רוטב הבית, חמוצים, חסה לליק", price: 69, extras: DINER_TOPPINGS }
            ]
          },
          {
            key: "chicken",
            label: "עוף",
            items: [
              { name: "קריספי צ'יקן", desc: "רוטב הבית, חסה לליק, חמוצים וקולסלאו", price: 58, extras: DINER_TOPPINGS },
              { name: "נאשוויל הוט צ'יקן 🌶️", desc: "רוטב הבית, חסה, מלפפון חמוץ, קולסלאו", price: 58, extras: DINER_TOPPINGS },
              { name: "סלט צ'יקן בייטס", desc: "חסות, סגולים מוחמצים, ויניגרט", price: 58, extras: DINER_TOPPINGS },
              { name: "צ'יקן בייטס", desc: "כמו הקריספי, בביסים קטנים", price: 58, extras: DINER_TOPPINGS }
            ]
          },
          {
            key: "sides",
            label: "נשנושים",
            items: [
              { name: "צ'יפס אמריקאי", desc: "", price: 25 },
              { name: "טבעות בצל", desc: "", price: 41 }
            ]
          }
        ]
      },
      {
        key: "sixbashuk",
        name: "6 בשוק",
        icon: "🍕",
        note: "פיצריה",
        sections: [
          {
            key: "starters",
            label: "ראשונות",
            items: [
              { name: "סלט קיסר", desc: "חסה קיסר, בצל סגול, קרוטונים ופרמזן", price: 52 },
              { name: "סלט קפרזה", desc: "עגבניות שרי, בזיליקום, מוצרלה", price: 52 },
              { name: "פוקאצ'ה קלאסית", desc: "שום, שמן זית ורוזמרין", price: 34 },
              { name: "פוקאצ'ה עיזים", desc: "גבינת עיזים, פלפל קלוי ובלסמי", price: 52 },
              { name: "לאבנה אסלית", desc: "פיתה בטאבון, צנוברים, זעתר ודבש", price: 48 }
            ]
          },
          {
            key: "pizzas",
            label: "פיצות הבית",
            items: [
              { name: "פיצת קיסר שרוף", desc: "בסיס שום ושמן זית, מוצרלה, חסה טרייה, צלפים ובצל סגול; אחרי האפייה זילוף רוטב קיסר ביתי, שביבי פרמזן וגרידת לימון וצ'ילי (הבחירה של השף)", price: 74, extras: SIXBASHUK_PIZZA_TOPPINGS },
              { name: "פיצה מרגריטה קלאסית", desc: "", price: 60, extras: SIXBASHUK_PIZZA_TOPPINGS },
              { name: "פיצה דרוזית", desc: "מוצרלה, לאבנה, עגבניות שרי, בצל סגול, פטרוזיליה, שמן זית וזעתר", price: 66, extras: SIXBASHUK_PIZZA_TOPPINGS },
              { name: "פיצת השוק", desc: "עגבניות, מוצרלה, חציל, זוקיני, שום קונפי, פרמזן, בזיליקום ובלסמי", price: 66, extras: SIXBASHUK_PIZZA_TOPPINGS },
              { name: "פיצה מקורמלת", desc: "עגבניות, מוצרלה, בצל מקורמל, חלפיניו ופרמזן", price: 66, extras: SIXBASHUK_PIZZA_TOPPINGS },
              { name: "פיצת אלה-רומנה", desc: "עגבניות, מוצרלה, ארטישוק, בזיליקום ופרמזן", price: 66, extras: SIXBASHUK_PIZZA_TOPPINGS },
              { name: "פיצת דבש וצ'ילי", desc: "גבינת עיזים, שום קונפי, חלפיניו ורוטב דבש צ'ילי", price: 66, extras: SIXBASHUK_PIZZA_TOPPINGS },
              { name: "פיצת אנשובי", desc: "עגבניות, מוצרלה, בצל סגול, אנשובי וצלפים", price: 66, extras: SIXBASHUK_PIZZA_TOPPINGS },
              { name: "פיצת מלך היער", desc: "רוטב מסקרפונה/פרמזן, מוצרלה, שמפיניון, פורטובלו, פטרוזיליה", price: 66, extras: SIXBASHUK_PIZZA_TOPPINGS },
              { name: "פיצת טרטופו", desc: "כמו מלך היער + מחית כמהין שחור וערמונים קלויים", price: 72, extras: SIXBASHUK_PIZZA_TOPPINGS }
            ]
          },
          {
            key: "desserts",
            label: "קינוחים",
            items: [
              { name: "קלצונה נוטלה אישי", desc: "", price: 44 },
              { name: "קלצונה נוטלה זוגי", desc: "", price: 60 }
            ]
          }
        ]
      }
    ]
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = NEIGHBORS_CONFIG;
  } else {
    root.NEIGHBORS_CONFIG = NEIGHBORS_CONFIG;
  }
})(typeof self !== "undefined" ? self : this);
