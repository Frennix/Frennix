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
const scrollPatch = `
    <style id="${patchId}">
      html {
        height: 100%;
        height: -webkit-fill-available;
        min-height: 100%;
        background-color: #0A0A0B;
      }
      body {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 100dvh;
        min-height: -webkit-fill-available;
        margin: 0;
        background-color: #0A0A0B;
        overflow: hidden;
      }
      #root {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        min-height: 100%;
        background-color: #0A0A0B;
        pointer-events: none;
      }
    </style>`;

if (html.includes(`id="${patchId}"`)) {
  html = html.replace(
    new RegExp(`<style id="${patchId}">[\\s\\S]*?</style>`),
    scrollPatch.trim()
  );
} else {
  html = html.replace("</style>", `</style>${scrollPatch}`);
}

const emergencyId = "frennix-emergency-html";
const emergencyBanner = `<div id="${emergencyId}" style="position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#b00020;color:#fff;font:bold 12px/1.4 system-ui,sans-serif;padding:10px 12px;border-bottom:4px solid #ffea00;pointer-events:none;">
      EMERGENCY DEBUG (pre-JS) — build 2025-06-25-safari-feed-overlay-fix — waiting for React
    </div>`;

if (html.includes(emergencyId)) {
  html = html.replace(
    new RegExp(`<div id="${emergencyId}"[\\s\\S]*?</div>`),
    emergencyBanner
  );
} else {
  html = html.replace("<body>", `<body>\n    ${emergencyBanner}`);
}

writeFileSync(indexPath, html);
console.log("[patch-web-html] dist/index.html updated for Safari scroll + emergency banner");
