/**
 * Expo static export does not merge app/+html.tsx into dist/index.html.
 * Patch the committed web shell for Safari flex-scroll + viewport fixes.
 */
const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

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

const patchId = "frennix-web-scroll";
if (!html.includes(patchId)) {
  html = html.replace(
    "</style>",
    `</style>
    <style id="${patchId}">
      html {
        height: 100%;
        height: -webkit-fill-available;
      }
      body {
        height: 100%;
        min-height: 100dvh;
        min-height: -webkit-fill-available;
      }
      #root {
        min-height: 0;
      }
    </style>`
  );
}

writeFileSync(indexPath, html);
console.log("[patch-web-html] dist/index.html updated for Safari scroll");
