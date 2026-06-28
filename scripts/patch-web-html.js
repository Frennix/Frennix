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

// Remove legacy pre-JS emergency banner if present from an older export.
html = html.replace(/\s*<div id="frennix-emergency-html"[\s\S]*?<\/div>\s*/g, "\n");

writeFileSync(indexPath, html);
console.log("[patch-web-html] dist/index.html updated for Safari scroll shell");
