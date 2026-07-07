/**
 * Expo static export does not merge app/+html.tsx into dist/index.html.
 * Patch the committed web shell for Safari flex-scroll + viewport fixes.
 */
const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
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
          navigator.serviceWorker.register("/sw.js").catch(function (err) {
            console.warn("[frennix-pwa] SW register failed", err);
          });
        });
      }
    </script>`;

const indexPath = join(__dirname, "..", "dist", "index.html");
let html = readFileSync(indexPath, "utf8");

const viewport =
  'content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"';
if (!html.includes("viewport-fit=cover")) {
  html = html.replace(
    /content="width=device-width, initial-scale=1, shrink-to-fit=no"/,
    viewport
  );
}

if (!html.includes('name="theme-color"')) {
  html = html.replace(
    "<title>Frennix</title>",
    `<title>Frennix</title>\n    <meta name="theme-color" content="${FRENNIX_WEB_BACKGROUND}" />\n    <meta name="color-scheme" content="dark" />`
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
}

const vapidPublicKey =
  process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY || loadEnvVar("EXPO_PUBLIC_VAPID_PUBLIC_KEY");
if (vapidPublicKey && !html.includes('name="frennix-vapid-public-key"')) {
  const vapidMeta = `    <meta name="frennix-vapid-public-key" content="${vapidPublicKey}" />\n`;
  html = html.replace("</head>", `${vapidMeta}  </head>`);
}

// Remove legacy pre-JS emergency banner if present from an older export.
html = html.replace(/\s*<div id="frennix-emergency-html"[\s\S]*?<\/div>\s*/g, "\n");

writeFileSync(indexPath, html);
console.log("[patch-web-html] dist/index.html updated for Safari scroll shell + PWA");
