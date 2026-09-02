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
  var usbPolyfillInstalled = false; // set below, in section 3 — read here via closure once DOMContentLoaded fires

  // 0) Always-on debug badge, visible the instant the app loads — no login attempt
  //    needed. Confirms unambiguously whether this build's injected script is even
  //    running, decoupled from the fetch/login-specific diagnostic below.
  document.addEventListener("DOMContentLoaded", function () {
    var badge = document.createElement("div");
    badge.id = "capacitor-debug-badge";
    badge.style.cssText = "position:fixed;bottom:6px;right:6px;z-index:2147483647;" +
      "background:#000;color:#0f0;font-size:10px;line-height:1.4;padding:4px 8px;" +
      "border-radius:6px;direction:ltr;text-align:left;font-family:monospace;" +
      "opacity:0.9;pointer-events:none;max-width:90vw;word-break:break-all;";
    badge.textContent = "build=2026-09-02g native=" + IS_NATIVE +
      " origin=" + ${JSON.stringify(prodOrigin || "(empty)")} +
      " Capacitor=" + !!window.Capacitor +
      " NativeHttp=" + !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.NativeHttp) +
      " usbPolyfill=" + usbPolyfillInstalled;
    document.body.appendChild(badge);
  });

  // 1) fetch() replacement. Two problems solved together:
  //    a) Relative-URL rewrite: /.netlify/functions/... resolves against
  //       https://localhost inside the app, not the real site. PROD_ORIGIN is baked
  //       in at build time from site.config.js's canonicalUrl.
  //    b) CORS: on-device testing showed the rewritten fetch() failing with
  //       "Failed to fetch" (no HTTP status ever received) even though the exact
  //       same URL/request works fine from a regular browser — i.e. a real CORS
  //       rejection at the WebView level that couldn't be resolved or verified
  //       from the server side alone. Routing the request through the native
  //       NativeHttpPlugin (Kotlin, HttpURLConnection) instead of the WebView's own
  //       fetch sidesteps CORS entirely — it's not a browser, so there's no origin
  //       for CORS to apply to. Falls back to the WebView's own fetch if that
  //       native plugin isn't available for any reason.
  var PROD_ORIGIN = ${JSON.stringify(prodOrigin || "")};
  var lastLoginFetchDiag = null; // human-readable outcome of the most recent admin-login fetch
  if (IS_NATIVE) {
    var origFetch = window.fetch.bind(window);
    var NativeHttp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.NativeHttp;

    function headersToPlainObject(h) {
      var out = {};
      if (!h) return out;
      if (typeof Headers !== "undefined" && h instanceof Headers) {
        h.forEach(function (v, k) { out[k] = v; });
      } else if (Array.isArray(h)) {
        h.forEach(function (pair) { out[pair[0]] = pair[1]; });
      } else {
        for (var k in h) if (Object.prototype.hasOwnProperty.call(h, k)) out[k] = h[k];
      }
      return out;
    }

    window.fetch = function (input, init) {
      var rewritten = null;
      try {
        if (PROD_ORIGIN && typeof input === "string" && input.charAt(0) === "/" && input.charAt(1) !== "/") {
          rewritten = PROD_ORIGIN + input;
          input = rewritten;
        } else if (PROD_ORIGIN && input && typeof input.url === "string" && input.url.charAt(0) === "/" && input.url.charAt(1) !== "/") {
          rewritten = PROD_ORIGIN + input.url;
          input = rewritten;
        }
      } catch (e) { console.error("[capacitor-bridge] fetch rewrite threw:", e); }

      var method = (init && init.method) || "GET";
      var url = rewritten || (typeof input === "string" ? input : (input && input.url) || String(input));
      var isLoginCall = url.indexOf("/admin-login") !== -1;

      if (NativeHttp && (url.indexOf("http://") === 0 || url.indexOf("https://") === 0)) {
        var headers = headersToPlainObject(init && init.headers);
        var body = init && init.body != null ? (typeof init.body === "string" ? init.body : JSON.stringify(init.body)) : null;
        return NativeHttp.request({ url: url, method: method, headers: headers, body: body }).then(
          function (r) {
            if (isLoginCall) lastLoginFetchDiag = "בקשה נשלחה (נייטיבי, בלי CORS) ל-" + url + " — סטטוס " + r.status;
            return new Response(r.body, { status: r.status, headers: r.headers || {} });
          },
          function (err) {
            console.error("[capacitor-bridge] NativeHttp FAILED:", method, url, err);
            if (isLoginCall) lastLoginFetchDiag = "בקשה נייטיבית ל-" + url + " נכשלה: " + (err && (err.message || String(err)));
            throw err;
          }
        );
      }

      // Diagnostic — covers every fetch() call so a silent failure is visible
      // instead of guessed at. Logged to console AND (for admin-login) surfaced
      // directly on screen below, since devtools access isn't always practical.
      return origFetch(input, init).then(
        function (res) {
          if (!res.ok) console.warn("[capacitor-bridge] fetch", method, url, "-> status", res.status);
          if (isLoginCall) lastLoginFetchDiag = "בקשה נשלחה ל-" + url + " — קיבלנו תשובה, סטטוס " + res.status;
          return res;
        },
        function (err) {
          console.error("[capacitor-bridge] fetch FAILED (network/CORS):", method, url, err);
          if (isLoginCall) lastLoginFetchDiag = "הבקשה ל-" + url + " נכשלה ברמת הרשת/CORS: " + (err && (err.message || err.name || String(err)));
          throw err;
        }
      );
    };
  }
  if (IS_NATIVE && !PROD_ORIGIN) {
    console.error("[capacitor-bridge] IS_NATIVE but PROD_ORIGIN is empty — relative fetch() calls will hit https://localhost and fail.");
  }

  // Surface the diagnostic directly under the login error message on screen — no
  // devtools/chrome://inspect needed to read it, just look at the app.
  document.addEventListener("DOMContentLoaded", function () {
    var lerr = document.getElementById("lerr");
    if (!lerr || !lerr.parentNode) return;
    var diag = document.createElement("div");
    diag.id = "capacitor-login-diag";
    diag.style.cssText = "font-size:12px;font-weight:bold;margin-top:6px;direction:ltr;text-align:center;word-break:break-all;color:#facc15;background:#000;padding:4px;border-radius:4px;";
    lerr.parentNode.insertBefore(diag, lerr.nextSibling);
    var mo = new MutationObserver(function () {
      var visible = lerr.style.display && lerr.style.display !== "none";
      if (!visible) { diag.textContent = ""; return; }
      diag.textContent = lastLoginFetchDiag || (IS_NATIVE
        ? "לא זוהתה קריאת רשת ל-admin-login כלל (בדוק IS_NATIVE=" + IS_NATIVE + " PROD_ORIGIN=" + PROD_ORIGIN + ")"
        : "");
    });
    mo.observe(lerr, { attributes: true, attributeFilter: ["style"] });
  });

  // 1b) A small always-visible-when-active status pill (#kitchen-status-bar, from
  //    admin.html's existing Kitchen Mode feature) is fixed-positioned with a very
  //    high z-index at the same screen corner where the topbar's action buttons
  //    (incl. "🔌 חבר מדפסת USB") wrap to on a narrow/tablet viewport, and has no
  //    interactive children — so it can silently eat clicks meant for whatever
  //    renders underneath it. Made click-through here (not in admin.html) since
  //    it's cosmetic-only either way and this only matters in the packaged app's
  //    fixed viewport.
  var style = document.createElement("style");
  style.textContent = "#kitchen-status-bar{pointer-events:none}";
  document.head.appendChild(style);

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

    // navigator.usb is a real, read-only getter-only accessor in Chromium/Android
    // WebView (native WebUSB support is present even though it can't claim a
    // USB-printer-class interface behind the kernel's usblp driver — that's the
    // whole reason this plugin exists). A plain assignment ("navigator.usb = ...")
    // throws under 'use strict' ("Cannot set property usb of #<Navigator> which has
    // only a getter") and — since this whole block is one IIFE — SILENTLY aborted
    // this entire polyfill installation, leaving the real (broken) WebUSB API in
    // place. That's what made the connect button appear to do nothing at all.
    // Object.defineProperty bypasses the missing setter and replaces the accessor
    // outright (works because Navigator's own IDL-defined properties are configurable).
    var usbPolyfill = {
      // Called from the explicit "🔌 חבר מדפסת USB" button (user gesture) — may
      // show the native Android USB-permission dialog once.
      // admin.html's own escposConnect() only console.warn()s on a rejection here
      // (unless e.name === "NotFoundError") — nothing visible happens on screen, so
      // a real connect failure looks identical to the click not registering at all.
      // Surface the actual native reason on screen so the two are distinguishable.
      requestDevice: function () {
        return Native.connect({}).then(function () {
          lastDevice = makeFakeDevice();
          return lastDevice;
        }, function (err) {
          var reason = (err && (err.message || err.errorMessage || String(err))) || "סיבה לא ידועה";
          console.error("[capacitor-bridge] native USB connect failed:", err);
          alert("🔌 חיבור מדפסת USB נכשל: " + reason);
          throw err;
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

    try {
      Object.defineProperty(navigator, "usb", { value: usbPolyfill, configurable: true, writable: true });
      usbPolyfillInstalled = true;
    } catch (e) {
      console.error("[capacitor-bridge] could not override navigator.usb — USB printer button will not work:", e);
    }
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
