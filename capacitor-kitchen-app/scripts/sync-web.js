// scripts/sync-web.js
//
// Builds www/ for Capacitor from the site's real admin.html — copied VERBATIM
// (Capacitor always loads www/index.html as its entry point, so we rename on copy).
// Every fix needed for admin.html to work inside a native Android WebView
// (PROD_ORIGIN fetch rewriting, the <audio loop> WebView quirk, the native USB
// printer bridge) is injected as a <script> block into the WWW COPY ONLY, at
// build time. The source admin.html at the repo root is never touched.
//
// Run: node scripts/sync-web.js   (also runs automatically via `npm run android:sync`)

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", ".."); // repo root (one level above capacitor-kitchen-app/)
const OUT = path.resolve(__dirname, "..", "www");

const SOURCE_HTML = path.join(ROOT, "admin.html");

// Files admin.html actually references from the browser (checked against its
// <script src>/<link href>/<audio src> tags) — NOT the whole site (no server
// code, no keys, no other pages).
const ASSETS = [
  "site.config.js",
  "js/firebase-auth.js",
  "admin-manifest.json",
  "icon-192.png",
  "icon-512.png",
  "sounds/alert.wav"
];

function readSiteConfigCanonicalUrl() {
  try {
    const src = fs.readFileSync(path.join(ROOT, "site.config.js"), "utf8");
    const m = src.match(/canonicalUrl:\s*["']([^"']+)["']/);
    return m ? m[1].replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}

function copyFile(rel) {
  const from = path.join(ROOT, rel);
  const to = path.join(OUT, rel);
  if (!fs.existsSync(from)) {
    console.warn(`[sync-web] skipping missing asset: ${rel}`);
    return;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  console.log(`[sync-web] copied ${rel}`);
}

function buildInjectedScript(prodOrigin) {
  // NOTE: this whole block only ever runs inside the compiled www/ copy — never
  // inside the real admin.html served by the website.
  return `
<!-- ========= Capacitor native-app bridge — INJECTED AT BUILD TIME (scripts/sync-web.js) =========
     Not present in the real admin.html. Fixes things that only break inside a
     native Android WebView: relative fetch() calls (Capacitor's local origin is
     https://localhost, not the real site), an unreliable <audio loop>, and a
     native USB bridge so the EXISTING WebUSB printer code below keeps working
     unmodified, transparently backed by native USB (which can claim a USB
     printer interface without root — Chrome/WebUSB cannot). ======================================== -->
<script>
(function () {
  'use strict';
  var IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

  // 1) Relative-URL fetch rewrite: /.netlify/functions/... etc. resolve against
  //    https://localhost inside the app, not the real site. PROD_ORIGIN is baked
  //    in at build time from site.config.js's canonicalUrl (override with the
  //    PROD_ORIGIN env var if that value isn't set yet).
  var PROD_ORIGIN = ${JSON.stringify(prodOrigin || "")};
  if (IS_NATIVE && PROD_ORIGIN) {
    var origFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var rewritten = null;
      try {
        if (typeof input === "string" && input.charAt(0) === "/" && input.charAt(1) !== "/") {
          rewritten = PROD_ORIGIN + input;
          input = rewritten;
        } else if (input && typeof input.url === "string" && input.url.charAt(0) === "/" && input.url.charAt(1) !== "/") {
          rewritten = PROD_ORIGIN + input.url;
          input = rewritten;
        }
      } catch (e) { console.error("[capacitor-bridge] fetch rewrite threw:", e); }
      // Diagnostic only (visible via chrome://inspect) — tells us definitively
      // whether a login/API failure is "request never went out" vs. "server
      // rejected it", instead of admin.html's identical error message for both.
      if (rewritten) {
        console.log("[capacitor-bridge] fetch rewritten:", rewritten);
        return origFetch(input, init).then(
          function (res) { console.log("[capacitor-bridge] fetch ok:", rewritten, "status:", res.status); return res; },
          function (err) { console.error("[capacitor-bridge] fetch FAILED (network/CORS):", rewritten, err); throw err; }
        );
      }
      return origFetch(input, init);
    };
  } else if (IS_NATIVE && !PROD_ORIGIN) {
    console.error("[capacitor-bridge] IS_NATIVE but PROD_ORIGIN is empty — relative fetch() calls will hit https://localhost and fail.");
  }

  // 2) <audio loop> is unreliable in the Android WebView (plays once and stops
  //    instead of looping). Manually replay on 'ended' when loop is still true —
  //    a no-op in real browsers, where 'ended' shouldn't fire at all while loop=true.
  document.addEventListener("DOMContentLoaded", function () {
    var snd = document.getElementById("kitchen-alert-sound");
    if (snd) {
      snd.addEventListener("ended", function () {
        if (snd.loop) { snd.currentTime = 0; snd.play().catch(function () {}); }
      });
    }
  });

  // 3) Native USB thermal-printer bridge.
  //    admin.html's existing WebUSB module (window.escposConnect/escposIsConnected/
  //    escposPrintOrder, further down this file) calls navigator.usb.*. On Android,
  //    Chrome/WebView's WebUSB cannot claim a USB-printer-class device because the
  //    kernel's usblp driver already holds its interface, and there is no way to
  //    force-detach it without root from inside the browser sandbox. The native
  //    UsbThermalPrinterPlugin (Kotlin) *can*, via claimInterface(iface, force=true).
  //    Rather than duplicating admin.html's receipt-rendering/ESC-POS code here,
  //    this installs a minimal navigator.usb polyfill backed by that native plugin,
  //    so the existing WebUSB code runs completely unmodified on top of it.
  if (IS_NATIVE && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.UsbThermalPrinter) {
    var Native = window.Capacitor.Plugins.UsbThermalPrinter;
    var FAKE_ENDPOINT = 1, FAKE_IFACE = 0;

    function uint8ToBase64(bytes) {
      var CHUNK = 0x8000, s = "";
      for (var i = 0; i < bytes.length; i += CHUNK) {
        s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
      }
      return btoa(s);
    }

    function makeFakeDevice() {
      var fakeAlt = { alternateSetting: 0, interfaceClass: 7,
        endpoints: [{ direction: "out", type: "bulk", endpointNumber: FAKE_ENDPOINT }] };
      var fakeInterface = { interfaceNumber: FAKE_IFACE, alternates: [fakeAlt] };
      var fakeConfig = { configurationValue: 1, interfaces: [fakeInterface] };
      return {
        vendorId: 0, productId: 0,
        configuration: fakeConfig, configurations: [fakeConfig],
        open: function () { return Promise.resolve(); },
        selectConfiguration: function () { return Promise.resolve(); },
        selectAlternateInterface: function () { return Promise.resolve(); },
        claimInterface: function () { return Promise.resolve(); }, // already claimed natively by connect()
        releaseInterface: function () { return Promise.resolve(); },
        reset: function () { return Promise.resolve(); },
        close: function () { return Native.disconnect().catch(function () {}); },
        transferOut: function (endpointNumber, data) {
          var bytes = data instanceof Uint8Array ? data : new Uint8Array(data.buffer || data);
          return Native.printBytes({ bytesBase64: uint8ToBase64(bytes) });
        }
      };
    }

    var lastDevice = null;

    navigator.usb = {
      // Called from the explicit "🔌 חבר מדפסת USB" button (user gesture) — may
      // show the native Android USB-permission dialog once.
      requestDevice: function () {
        return Native.connect({}).then(function () {
          lastDevice = makeFakeDevice();
          return lastDevice;
        });
      },
      // Called automatically on page load to silently reconnect — must NEVER pop
      // up a permission dialog on its own, only succeed if permission already exists.
      getDevices: function () {
        return Native.connect({ silent: true }).then(function () {
          lastDevice = makeFakeDevice();
          return [lastDevice];
        }).catch(function () { return []; });
      },
      addEventListener: function () {},
      removeEventListener: function () {}
    };
  }
})();
</script>
<!-- ========= End Capacitor native-app bridge ========= -->
`;
}

function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  if (!fs.existsSync(SOURCE_HTML)) {
    console.error(`[sync-web] admin.html not found at ${SOURCE_HTML}`);
    process.exit(1);
  }

  let html = fs.readFileSync(SOURCE_HTML, "utf8");

  const prodOrigin = process.env.PROD_ORIGIN || readSiteConfigCanonicalUrl();
  if (!prodOrigin) {
    console.warn("[sync-web] WARNING: no PROD_ORIGIN found (env var or site.config.js canonicalUrl). " +
      "Relative fetch() calls (login, push notifications) will fail inside the app until this is set.");
  } else {
    console.log(`[sync-web] PROD_ORIGIN = ${prodOrigin}`);
  }

  const marker = '<script src="js/firebase-auth.js"></script>';
  if (!html.includes(marker)) {
    console.error(`[sync-web] could not find injection anchor (${marker}) in admin.html — aborting so we don't silently skip the fixes.`);
    process.exit(1);
  }
  html = html.replace(marker, marker + "\n" + buildInjectedScript(prodOrigin));

  fs.writeFileSync(path.join(OUT, "index.html"), html, "utf8");
  console.log("[sync-web] wrote www/index.html (from admin.html, unmodified + build-time injection)");

  ASSETS.forEach(copyFile);
}

main();
