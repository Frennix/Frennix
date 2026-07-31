/**
 * Adds uniform transparent padding around frennix-logo-icon.png so symbol
 * artwork does not touch the PNG canvas edges (prevents subpixel/header clipping).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICON_PATH = path.resolve(__dirname, "../assets/brand/frennix-logo-icon.png");
const PAD_RATIO = 0.1;

function contentBounds(png) {
  let minX = png.width;
  let minY = png.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (png.width * y + x) * 4;
      const r = png.data[i];
      const g = png.data[i + 1];
      const b = png.data[i + 2];
      const lum = (r + g + b) / 3;
      if (lum > 20) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  return { minX, minY, maxX, maxY };
}

const src = PNG.sync.read(fs.readFileSync(ICON_PATH));
const bounds = contentBounds(src);
const contentW = bounds.maxX - bounds.minX + 1;
const contentH = bounds.maxY - bounds.minY + 1;
const pad = Math.max(24, Math.round(Math.max(contentW, contentH) * PAD_RATIO));
const newSize = src.width + pad * 2;

const out = new PNG({ width: newSize, height: newSize });
for (let i = 0; i < out.data.length; i += 4) {
  out.data[i] = 0;
  out.data[i + 1] = 0;
  out.data[i + 2] = 0;
  out.data[i + 3] = 0;
}

PNG.bitblt(src, out, 0, 0, src.width, src.height, pad, pad);
fs.writeFileSync(ICON_PATH, PNG.sync.write(out));

const padded = PNG.sync.read(fs.readFileSync(ICON_PATH));
const next = contentBounds(padded);
console.log(
  `[pad-brand-icon] ${path.basename(ICON_PATH)} ${src.width}→${newSize}px pad=${pad} margins L=${next.minX} T=${next.minY} R=${padded.width - next.maxX - 1} B=${padded.height - next.maxY - 1}`,
);
