/**
 * Expo static export does not merge app/+html.tsx into dist/index.html.
 * Patch the committed web shell for Safari flex-scroll + viewport fixes.
 */
const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { execSync } = require("node:child_process");
const {
  frennixWebDocumentCss,
  FRENNIX_WEB_BACKGROUND,
} = require("../lib/web-document-styles.js");

function loadEnvVar(name) {
  try {
    const envPath = join(__dirname, "..", ".env");
    const env = readFileSync(envPath, "utf8");
    const match = env.match(new RegExp(`^${name}=(.*)$`, "m"));
    return match?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
  } catch {
    return "";
  }
}

const PWA_PATCH_ID = "frennix-pwa-shell";
const SW_VERSION = "20260709-diag-v1";

function resolveBuildSha() {
  try {
    return execSync("git rev-parse HEAD", { cwd: join(__dirname, ".."), encoding: "utf8" }).trim();
  } catch {
    return process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "unknown";
  }
}

const buildSha = resolveBuildSha();
const pwaHeadTags = `
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Frennix" />
    <link rel="apple-touch-icon" href="/icons/icon-192.png" />`;

const pwaBootScript = `
    <script id="${PWA_PATCH_ID}">
      if ("serviceWorker" in navigator) {
        window.addEventListener("load", function () {
          navigator.serviceWorker.register("/sw.js?v=${buildSha.slice(0, 8)}", { scope: "/", updateViaCache: "none" }).catch(function (err) {
            console.warn("[frennix-pwa] SW register failed", err);
          });
        });
      }
    </script>`;

const bootShellCss = `
  #frennix-boot-shell {
    position: fixed;
    inset: 0;
    z-index: 2147483646;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    background: ${FRENNIX_WEB_BACKGROUND};
    color: #f5f5f5;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  #frennix-boot-shell .spinner {
    width: 28px;
    height: 28px;
    border: 3px solid rgba(255,255,255,0.15);
    border-top-color: #c8ff00;
    border-radius: 50%;
    animation: frennix-spin 0.9s linear infinite;
  }
  @keyframes frennix-spin { to { transform: rotate(360deg); } }
`;

const bootShellHtml = `
    <div id="frennix-boot-shell" aria-live="polite" aria-busy="true">
      <div class="spinner"></div>
      <div>Loading Frennix…</div>
      <div id="frennix-boot-shell-stalled" style="display:none;font-size:13px;opacity:0.75">
        Still loading — check your connection or reopen the app.
      </div>
    </div>`;

const bootShellScript = `
    <script id="frennix-boot-shell-script">
(function () {
  var STALL_MS = 5000;
  var cfg = {
    supabaseUrl: ${JSON.stringify(process.env.EXPO_PUBLIC_SUPABASE_URL || loadEnvVar("EXPO_PUBLIC_SUPABASE_URL"))},
    anonKey: ${JSON.stringify(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || loadEnvVar("EXPO_PUBLIC_SUPABASE_ANON_KEY"))}
  };

  function readAuth() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf("auth-token") !== -1) {
          var data = JSON.parse(localStorage.getItem(key) || "{}");
          return {
            hasToken: !!data.access_token,
            userId: data.user && data.user.id,
            email: data.user && data.user.email,
            accessToken: data.access_token
          };
        }
      }
    } catch (e) {}
    return { hasToken: false };
  }

  function feedDestinationReady() {
    var feedRoot = document.getElementById("feed-root-container");
    var feedRootH = feedRoot ? Math.round(feedRoot.getBoundingClientRect().height) : -1;
    if (feedRootH > 80) return true;
    var bodyText = String(document.body.innerText || "").replace(/\\s+/g, " ").trim();
    if (/STORIES|Share workout|Your feed is ready|Could not load feed|This section could not load/i.test(bodyText)) {
      return true;
    }
    return false;
  }

  function visibleDestination() {
    if (feedDestinationReady()) return true;
    var ids = [
      "auth-login-screen",
      "startup-retry-screen",
      "login-failure-screen",
      "authenticated-startup-fallback",
      "startup-diagnostic-panel",
      "onboarding-screen"
    ];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el && String(el.textContent || "").replace(/\\s+/g, "").length > 0) return true;
    }
    return false;
  }

  function collectInlineDiag(reason) {
    var auth = readAuth();
    var trace = window.__FRENNIX_MOUNT_TRACE__ || [];
    return {
      at: new Date().toISOString(),
      reason: reason,
      route: location.pathname,
      href: location.href,
      auth: { hasToken: auth.hasToken, userId: auth.userId, email: auth.email },
      mount_trace_tail: trace.slice(-12).map(function (e) { return e.id; }),
      body_preview: String(document.body.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 240),
      user_agent: navigator.userAgent
    };
  }

  function sendInlineReport(diag) {
    if (!cfg.supabaseUrl || !cfg.anonKey || !diag.auth.userId || !diag.auth.hasToken) return;
    var token = readAuth().accessToken;
    if (!token) return;
    var payload = {
      user_id: diag.auth.userId,
      type: "crash",
      status: "new",
      priority: "critical",
      message: "[inline-startup] " + diag.reason,
      screen_path: diag.route,
      metadata: diag
    };
    fetch(cfg.supabaseUrl + "/rest/v1/beta_feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: cfg.anonKey,
        Authorization: "Bearer " + token,
        Prefer: "return=minimal"
      },
      body: JSON.stringify(payload)
    }).catch(function () {});
  }

  function showInlineFailure(diag) {
    var shell = document.getElementById("frennix-boot-shell");
    if (!shell) return;
    shell.style.display = "flex";
    shell.setAttribute("aria-busy", "false");
    shell.innerHTML =
      '<div id="authenticated-startup-fallback" style="max-width:360px;text-align:center;padding:20px;display:flex;flex-direction:column;align-items:center;gap:12px">' +
      '<div style="font-size:18px;font-weight:700">Account loading stalled</div>' +
      '<div style="font-size:14px;opacity:0.85;line-height:20px">We\\'re having trouble loading your account. Please retry or log out.</div>' +
      '<div id="startup-diagnostic-panel" style="font-size:12px;opacity:0.75">Diagnostic report sent automatically. Tap Copy report to share with support.</div>' +
      '<button id="frennix-inline-copy" style="padding:10px 16px;border-radius:8px;border:none;background:#c8ff00;color:#0a0a0b;font-weight:700">Copy report</button>' +
      '<button id="frennix-inline-retry" style="padding:10px 16px;border-radius:8px;border:1px solid #444;background:transparent;color:#f5f5f5">Retry</button>' +
      "</div>";
    var copyBtn = document.getElementById("frennix-inline-copy");
    if (copyBtn) {
      copyBtn.onclick = function () {
        var text = JSON.stringify(diag, null, 2);
        if (navigator.clipboard) navigator.clipboard.writeText(text);
      };
    }
    var retryBtn = document.getElementById("frennix-inline-retry");
    if (retryBtn) retryBtn.onclick = function () { location.reload(); };
  }

  function hideBootShell() {
    var el = document.getElementById("frennix-boot-shell");
    if (el) el.style.display = "none";
  }

  function signedOutReady() {
    if (document.getElementById("auth-login-screen")) return true;
    if (document.getElementById("startup-retry-screen")) return true;
    if (document.getElementById("login-failure-screen")) return true;
    var trace = window.__FRENNIX_MOUNT_TRACE__;
    if (!trace || !trace.length) return false;
    return trace.some(function (e) {
      return e.id === "stack:mounted" || e.id === "index-route:mounted" || e.id === "auth-login:mounted";
    });
  }

  function startupReady() {
    if (visibleDestination()) return true;
    if (readAuth().hasToken) return false;
    return signedOutReady();
  }

  var stallTimer = setTimeout(function () {
    var auth = readAuth();
    if (!auth.hasToken) return;
    if (visibleDestination()) return;
    var diag = collectInlineDiag("post-login black screen before React destination");
    try { sessionStorage.setItem("frennix:inline-startup-diag", JSON.stringify(diag)); } catch (e) {}
    sendInlineReport(diag);
    showInlineFailure(diag);
  }, STALL_MS);

  var iv = setInterval(function () {
    if (startupReady()) {
      hideBootShell();
      clearInterval(iv);
      clearTimeout(stallTimer);
    }
  }, 150);

  window.addEventListener("load", function () {
    setTimeout(function () {
      if (!startupReady()) {
        var stalled = document.getElementById("frennix-boot-shell-stalled");
        if (stalled) stalled.style.display = "block";
      }
    }, 15000);
  });
})();</script>`;

const indexPath = join(__dirname, "..", "dist", "index.html");
let html = readFileSync(indexPath, "utf8");

const bundleMatch = html.match(/\/_expo\/static\/js\/web\/(index-[a-f0-9]+\.js)/);
const buildBundle = bundleMatch?.[1] ?? "unknown";
const buildAt = new Date().toISOString();
const swVersion = SW_VERSION;

const buildMetaTags = `
    <meta name="frennix-build-sha" content="${buildSha}" />
    <meta name="frennix-build-bundle" content="${buildBundle}" />
    <meta name="frennix-build-at" content="${buildAt}" />
    <meta name="frennix-sw-version" content="${swVersion}" />`;

if (html.includes('name="frennix-build-sha"')) {
  html = html.replace(/<meta name="frennix-build-sha" content="[^"]*" \/>/g, `<meta name="frennix-build-sha" content="${buildSha}" />`);
  html = html.replace(/<meta name="frennix-build-bundle" content="[^"]*" \/>/g, `<meta name="frennix-build-bundle" content="${buildBundle}" />`);
  html = html.replace(/<meta name="frennix-build-at" content="[^"]*" \/>/g, `<meta name="frennix-build-at" content="${buildAt}" />`);
  html = html.replace(/<meta name="frennix-sw-version" content="[^"]*" \/>/g, `<meta name="frennix-sw-version" content="${swVersion}" />`);
} else {
  html = html.replace("</head>", `${buildMetaTags}\n  </head>`);
}

if (bundleMatch) {
  const shortSha = buildSha.slice(0, 8);
  html = html.replace(
    new RegExp(`/_expo/static/js/web/${buildBundle.replace(".", "\\.")}(?![?])`, "g"),
    `/_expo/static/js/web/${buildBundle}?v=${shortSha}`
  );
}

html = html.replace(
  /\s*<div id="frennix-build-stamp"[^>]*><\/div>\s*/g,
  "\n"
);

html = html.replace(/<title>[^<]*<\/title>/, `<title>Frennix · ${buildSha.slice(0, 8)}</title>`);

const buildStampHtml = `<div id="frennix-build-stamp" style="display:none" data-sha="${buildSha}" data-bundle="${buildBundle}" data-sw="${swVersion}"></div>`;
if (!html.includes("frennix-build-stamp")) {
  html = html.replace("<body>", `<body>\n    ${buildStampHtml}`);
} else {
  html = html.replace(
    /<div id="frennix-build-stamp"[^>]*><\/div>/,
    buildStampHtml
  );
}

if (!html.includes('name="theme-color"')) {
  html = html.replace(
    /<title>[^<]*<\/title>/,
    (title) =>
      `${title}\n    <meta name="theme-color" content="${FRENNIX_WEB_BACKGROUND}" />\n    <meta name="color-scheme" content="dark" />`
  );
}

const viewport =
  'content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"';
if (!html.includes("viewport-fit=cover")) {
  html = html.replace(
    /content="width=device-width, initial-scale=1, shrink-to-fit=no"/,
    viewport
  );
}

const patchId = "frennix-web-scroll";
const scrollPatch = `<style id="${patchId}">${frennixWebDocumentCss}\n    </style>`;

if (html.includes(`id="${patchId}"`)) {
  html = html.replace(
    new RegExp(`<style id="${patchId}">[\\s\\S]*?</style>`),
    scrollPatch
  );
} else {
  html = html.replace("</head>", `    ${scrollPatch}\n  </head>`);
}

if (!html.includes('rel="manifest"')) {
  html = html.replace("</head>", `    ${pwaHeadTags}\n  </head>`);
}

if (!html.includes(`id="${PWA_PATCH_ID}"`)) {
  html = html.replace("</body>", `    ${pwaBootScript}\n  </body>`);
} else {
  html = html.replace(
    new RegExp(`<script id="${PWA_PATCH_ID}">[\\s\\S]*?</script>`),
    pwaBootScript.trim()
  );
}

const vapidPublicKey =
  process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY || loadEnvVar("EXPO_PUBLIC_VAPID_PUBLIC_KEY");
if (vapidPublicKey && !html.includes('name="frennix-vapid-public-key"')) {
  const vapidMeta = `    <meta name="frennix-vapid-public-key" content="${vapidPublicKey}" />\n`;
  html = html.replace("</head>", `${vapidMeta}  </head>`);
}

if (!html.includes('id="frennix-boot-shell"')) {
  html = html.replace("<body>", `<body>\n${bootShellHtml}`);
  html = html.replace(
    "</head>",
    `    <style id="frennix-boot-shell-css">${bootShellCss}\n    </style>\n  </head>`
  );
}

if (!html.includes('id="frennix-boot-shell-script"')) {
  html = html.replace("</body>", `${bootShellScript}\n  </body>`);
} else {
  html = html.replace(
    /<script id="frennix-boot-shell-script">[\s\S]*?<\/script>/,
    bootShellScript.trim()
  );
}

// Remove legacy pre-JS emergency banner if present from an older export.
html = html.replace(/\s*<div id="frennix-emergency-html"[\s\S]*?<\/div>\s*/g, "\n");

writeFileSync(indexPath, html);
console.log(`[patch-web-html] dist/index.html updated — sha ${buildSha.slice(0, 8)} bundle ${buildBundle} sw ${swVersion}`);
