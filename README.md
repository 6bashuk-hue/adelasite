# Ordering Site Template

White-label restaurant/food ordering site template: customer ordering site, kitchen
display (KDS) admin, and an AI-assisted (no API cost) marketing system. Static HTML +
Netlify Functions (CommonJS) + Firebase Realtime Database — no build step.

**Start here: [`SETUP.md`](SETUP.md)** — it walks through creating your own Firebase
project, filling in `site.config.js` (your business identity — the one file you edit
first), and deploying.

## What's included

- Customer ordering site (`index.html`) — menu, cart, delivery/pickup, coupons, group
  orders, referrals, push notifications, PWA install.
- Kitchen display / admin (`admin.html`) — live order queue, menu editor, Kitchen Mode
  (always-on screen with alerts), direct USB receipt printing (WebUSB).
- Marketing system (`marketing/`) — content prompt builder, posting calendar, UGC
  review, local research, daily quiz. Builds copy-paste prompts for your own Claude
  chat; no AI API calls, no ongoing API cost.

## Other docs

- [`SETUP.md`](SETUP.md) — full setup walkthrough (start here)
- [`SECURITY.md`](SECURITY.md) / [`DEPLOY_LOCKDOWN.md`](DEPLOY_LOCKDOWN.md) — security rules and the full lockdown process
- [`KITCHEN_MODE.md`](KITCHEN_MODE.md) — always-on kitchen screen
- [`KIOSK_PRINTER_SETUP.md`](KIOSK_PRINTER_SETUP.md) / [`PRINTER_WEBUSB.md`](PRINTER_WEBUSB.md) — receipt printing
- [`marketing/README.md`](marketing/README.md) — how the marketing system works

## Tests

```bash
npm install
npm test
```
