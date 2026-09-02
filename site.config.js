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
      name: "אדלה בשוק",
      tagline: "בר אוכל שוק",
      type: "בר אוכל שוק אותנטי מזרחי",           // ← free text, used in SEO/schema.org
      city: "ערד",
      country: "IL",
      phone: "+972504599409",
      phoneDisplay: "050-4599409",
      whatsappCountryCode: "972",
      address: { street: "התעשייה 6", locality: "ערד", region: "", country: "IL" },
      hoursDisplay: "א׳-ו׳ 18:00–24:00 · שבת 10:00–24:00",
      canonicalUrl: "https://adelabashuk.netlify.app"
    },
    firebase: {
      // ⚠️ Create your OWN Firebase Realtime Database project (SETUP.md step 2) —
      // never point this at someone else's project. These placeholders will not work
      // until you replace them.
      dbUrl: "https://adela-1fb6a-default-rtdb.europe-west1.firebasedatabase.app/",
      apiKey: "REPLACE-WITH-YOUR-FIREBASE-WEB-API-KEY",
      adminEmail: "owner@yourbusiness.local"
    },
    commerce: {
      deliveryFee: 20,
      minDelivery: 60,
      currency: "₪"
    },
    theme: {
      primary: "#7d6652",
      primaryDark: "#5c4a3a",
      bg: "#f3ead9"
    }
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = SITE_CONFIG;
  } else {
    root.SITE_CONFIG = SITE_CONFIG;
  }
})(typeof self !== "undefined" ? self : this);
