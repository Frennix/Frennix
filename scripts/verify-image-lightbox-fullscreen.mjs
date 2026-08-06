#!/usr/bin/env node
/**
 * Full-screen image lightbox checks (source + optional production bundle).
 * Usage: node scripts/verify-image-lightbox-fullscreen.mjs [baseUrl]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(ROOT, "..");
const BASE = (process.argv[2] ?? "").replace(/\/$/, "");

function read(rel) {
  return fs.readFileSync(path.join(ROOT_DIR, rel), "utf8");
}

function pass(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

const lightbox = read("components/ImageLightbox.tsx");
const tabs = read("app/(tabs)/_layout.tsx");
const feed = read("app/(tabs)/index.tsx");
const overlay = read("lib/lightbox-overlay-state.ts");

let ok = true;
ok = pass("Lightbox renders through web portal", lightbox.includes("createPortal") && lightbox.includes("document.body")) && ok;
ok = pass("Web root uses fixed full viewport", lightbox.includes("100dvh") && lightbox.includes("100vw")) && ok;
ok = pass("Solid black full-screen backdrop", lightbox.includes("colors.black")) && ok;
ok = pass("Images use cover fit", lightbox.includes('contentFit="cover"') && lightbox.includes('objectFit: "cover"')) && ok;
ok = pass("Close button above gallery chrome", lightbox.includes("chromeLayer") && lightbox.includes("zIndex: 31")) && ok;
ok = pass("Swipe-down dismiss when not zoomed", lightbox.includes("panResponder") && lightbox.includes("gesture.dy > 120")) && ok;
ok = pass("Escape closes on web", lightbox.includes('event.key === "Escape"')) && ok;
ok = pass("Body scroll lock while open", lightbox.includes("document.body.style.overflow = \"hidden\"")) && ok;
ok = pass("Tab bar hides while lightbox open", tabs.includes("useLightboxOverlayOpen") && tabs.includes("lightboxOpen")) && ok;
ok = pass("Feed scroll disabled while lightbox open", feed.includes("lightboxVisible")) && ok;
ok = pass("Overlay state module", overlay.includes("setLightboxOverlayOpen")) && ok;
ok = pass("Native modal uses fullScreen presentation", lightbox.includes('presentationStyle="fullScreen"')) && ok;
ok = pass("Pinch and double-tap zoom preserved", lightbox.includes("Gesture.Pinch()") && lightbox.includes("numberOfTaps(2)")) && ok;

if (BASE) {
  (async () => {
    const html = await (await fetch(`${BASE}/`)).text();
    const bundleMatch = html.match(/index-[a-f0-9]+\.js/);
    ok = pass("Production HTML exposes bundle", Boolean(bundleMatch), bundleMatch?.[0] ?? "missing") && ok;
    if (bundleMatch) {
      const bundle = await (await fetch(`${BASE}/_expo/static/js/web/${bundleMatch[0]}`)).text();
      ok = pass("Production bundle includes portal lightbox", bundle.includes("createPortal") || bundle.includes("100dvh")) && ok;
    }
    console.log(`\n=== Image lightbox fullscreen check: ${ok ? "PASS" : "FAIL"} ===`);
    if (!ok) process.exit(1);
  })().catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else {
  console.log(`\n=== Image lightbox fullscreen check: ${ok ? "PASS" : "FAIL"} ===`);
  if (!ok) process.exit(1);
}
