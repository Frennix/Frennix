/**
 * Copy PWA assets (manifest, service worker, icons) into dist/ after expo export.
 * Icons are generated from assets/icon.png (sips on macOS, copy fallback elsewhere).
 */
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const PUBLIC_DIR = join(ROOT, "public");
const DIST_DIR = join(ROOT, "dist");
const ICON_SRC = join(ROOT, "assets", "icon.png");
const ICONS_OUT = join(PUBLIC_DIR, "icons");

function assertDistExists() {
  if (!existsSync(DIST_DIR)) {
    throw new Error("Missing dist/ — run expo export -p web first");
  }
}

function ensureIcons() {
  if (!existsSync(ICON_SRC)) {
    throw new Error(`Missing icon source: ${ICON_SRC}`);
  }

  mkdirSync(ICONS_OUT, { recursive: true });

  const sizes = [192, 512];
  const canResize = process.platform === "darwin";

  for (const size of sizes) {
    const dest = join(ICONS_OUT, `icon-${size}.png`);
    if (canResize) {
      execSync(`sips -z ${size} ${size} "${ICON_SRC}" --out "${dest}"`, { stdio: "pipe" });
    } else {
      copyFileSync(ICON_SRC, dest);
    }
  }

  copyFileSync(join(ICONS_OUT, "icon-512.png"), join(ICONS_OUT, "icon-512-maskable.png"));
}

function copyRecursive(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  for (const entry of readdirSync(srcDir)) {
    const srcPath = join(srcDir, entry);
    const destPath = join(destDir, entry);
    if (statSync(srcPath).isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

function main() {
  assertDistExists();
  ensureIcons();

  if (!existsSync(PUBLIC_DIR)) {
    throw new Error(`Missing public/ directory at ${PUBLIC_DIR}`);
  }

  copyRecursive(PUBLIC_DIR, DIST_DIR);

  const copied = readdirSync(PUBLIC_DIR, { recursive: true })
    .filter((entry) => !String(entry).includes("icons/"))
    .map((entry) => relative(PUBLIC_DIR, String(entry)));

  console.log("[copy-pwa-assets] copied public/ → dist/");
  console.log(`[copy-pwa-assets] icons: ${join(ICONS_OUT, "icon-192.png")}, icon-512.png`);
  if (copied.length) {
    console.log(`[copy-pwa-assets] files: ${copied.join(", ")}`);
  }
}

main();
