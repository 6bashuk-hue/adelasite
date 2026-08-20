// site.config.js — EDIT THIS FILE for your business. This is the single place that
// holds your business identity + Firebase connection details. It's written so the
// exact same file works in three places with zero build step:
//   1. <script src="/site.config.js"> in the browser pages          → window.SITE_CONFIG
//   2. require("../../site.config.js") inside Netlify Functions      → module.exports
//   3. importScripts("/site.config.js") inside sw.js (service worker) → self.SITE_CONFIG
//
// See SETUP.md for the full walkthrough (Firebase project, Netlify env vars, etc.).
// This file only holds PUBLIC values — nothing here is a secret (see SETUP.md for
// where the real secrets like ADMIN_PASSWORD/FB_SECRET go: Netlify environment
// variables, never this file).
(function (root) {
  const SITE_CONFIG = {
    business: {
      name: "העסק שלי",                       // ← e.g. "6 בשוק"
      tagline: "התיאור הקצר של העסק",          // ← e.g. "פיצה וטאבון"
      type: "מסעדה",                            // ← free text, used in SEO/schema.org, e.g. "פיצריה וטאבון"
      city: "העיר שלי",                         // ← e.g. "ערד"
      country: "IL",
      phone: "+972000000000",                  // ← international format, used for tel: links
      phoneDisplay: "000-0000000",              // ← how the phone number is shown to customers
      whatsappCountryCode: "972",               // ← used to convert local 05XXXXXXXX numbers into wa.me links
      address: { street: "", locality: "העיר שלי", region: "", country: "IL" },
      hoursDisplay: "ימים א׳-ה׳ 09:00–22:00",   // ← free text shown in the footer / meta description
      canonicalUrl: "https://REPLACE-WITH-YOUR-DOMAIN.netlify.app"
    },
    firebase: {
      // ⚠️ Create your OWN Firebase Realtime Database project (SETUP.md step 2) —
      // never point this at someone else's project. These placeholders will not work
      // until you replace them.
      dbUrl: "https://REPLACE-WITH-YOUR-PROJECT-default-rtdb.REGION.firebasedatabase.app/",
      apiKey: "REPLACE-WITH-YOUR-FIREBASE-WEB-API-KEY",
      adminEmail: "owner@yourbusiness.local"
    },
    commerce: {
      deliveryFee: 20,
      minDelivery: 60,
      currency: "₪"
    },
    theme: {
      primary: "#b3592d",
      primaryDark: "#8f4422",
      bg: "#fdf5e6"
    }
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = SITE_CONFIG;
  } else {
    root.SITE_CONFIG = SITE_CONFIG;
  }
})(typeof self !== "undefined" ? self : this);
