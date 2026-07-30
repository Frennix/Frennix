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
const {
  bootShellCss,
  bootShellHtml,
  buildBootShellScript,
  splashHeadTags,
} = require("../lib/boot-shell-document.js");

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
const SW_VERSION = "20260727-pwa-auto-update-v1";

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
    <meta name="apple-mobile-web-app-status-bar-style" content="black" />
    <meta name="apple-mobile-web-app-title" content="Frennix" />
    <link rel="apple-touch-icon" href="/icons/icon-192.png" />`;

/** Early standalone PWA update — runs before the JS bundle so stale shells self-reload. */
const earlyPwaUpdateScript = `
    <script id="frennix-pwa-early-update">
(function () {
  var RELOAD_KEY = "frennix:pwa-update-reload";
  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.navigator.standalone === true
    );
  }
  function localSha() {
    var stamp = document.getElementById("frennix-build-stamp");
    if (stamp && stamp.getAttribute("data-sha")) return stamp.getAttribute("data-sha");
    var meta = document.querySelector('meta[name="frennix-build-sha"]');
    return meta ? meta.getAttribute("content") : null;
  }
  function remoteSha(html) {
    var m =
      html.match(/data-sha="([^"]+)"/) ||
      html.match(/name="frennix-build-sha"\\s+content="([^"]+)"/);
    return m ? m[1] : null;
  }
  if (!isStandalone()) return;
  var current = localSha();
  if (!current) return;
  var url = window.location.href.split("#")[0];
  url += (url.indexOf("?") >= 0 ? "&" : "?") + "frennix_build_check=" + Date.now();
  fetch(url, { cache: "no-store", credentials: "same-origin" })
    .then(function (res) { return res.text(); })
    .then(function (html) {
      var latest = remoteSha(html);
      if (!latest || latest === current) return;
      if (sessionStorage.getItem(RELOAD_KEY) === latest) return;
      sessionStorage.setItem(RELOAD_KEY, latest);
      window.location.reload();
    })
    .catch(function () {});
})();
    </script>`;

const bootShellScript = buildBootShellScript({
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || loadEnvVar("EXPO_PUBLIC_SUPABASE_URL"),
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || loadEnvVar("EXPO_PUBLIC_SUPABASE_ANON_KEY"),
});

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

if (!html.includes('id="frennix-pwa-early-update"')) {
  html = html.replace(buildStampHtml, `${buildStampHtml}\n    ${earlyPwaUpdateScript.trim()}`);
} else {
  html = html.replace(
    /<script id="frennix-pwa-early-update">[\s\S]*?<\/script>/,
    earlyPwaUpdateScript.trim()
  );
}

// Legacy inline SW registration removed — PwaBootstrap registers /sw.js once.
html = html.replace(new RegExp(`<script id="${PWA_PATCH_ID}">[\\s\\S]*?</script>\\s*`, "g"), "");

const vapidPublicKey =
  process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY || loadEnvVar("EXPO_PUBLIC_VAPID_PUBLIC_KEY");
if (vapidPublicKey && !html.includes('name="frennix-vapid-public-key"')) {
  const vapidMeta = `    <meta name="frennix-vapid-public-key" content="${vapidPublicKey}" />\n`;
  html = html.replace("</head>", `${vapidMeta}  </head>`);
}

if (!html.includes('rel="preload"') || !html.includes("frennix-splash-logo")) {
  html = html.replace("</head>", `    ${splashHeadTags}\n  </head>`);
}

if (html.includes('id="frennix-boot-shell-css"')) {
  html = html.replace(
    /<style id="frennix-boot-shell-css">[\s\S]*?<\/style>/,
    `<style id="frennix-boot-shell-css">${bootShellCss}\n    </style>`
  );
} else {
  html = html.replace(
    "</head>",
    `    <style id="frennix-boot-shell-css">${bootShellCss}\n    </style>\n  </head>`
  );
}

if (html.includes('id="frennix-boot-shell"')) {
  html = html.replace(/<div id="frennix-boot-shell"[\s\S]*?<\/div>/, bootShellHtml.trim());
} else {
  html = html.replace("<body>", `<body>\n${bootShellHtml}`);
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
