/**
 * Verifies expo-image is installed and all UI image paths use CachedImage/ProgressiveImage.
 * Run: pnpm verify:expo-image
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry === "dist" || entry === ".git") continue;
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (/\.(tsx|ts)$/.test(entry)) files.push(full);
  }
  return files;
}

function fail(message: string): never {
  console.error(`[verify:expo-image] FAIL: ${message}`);
  process.exit(1);
}

function ok(message: string) {
  console.log(`[verify:expo-image] OK: ${message}`);
}

// 1. expo-image must resolve from mobile app
try {
  const pkg = join(ROOT, "node_modules", "expo-image", "package.json");
  if (!existsSync(pkg)) fail("expo-image is not installed in node_modules");
  const version = JSON.parse(readFileSync(pkg, "utf8")).version as string;
  ok(`expo-image@${version} installed`);
} catch {
  fail("could not read expo-image package.json — run pnpm install");
}

// 2. CachedImage must import expo-image directly (no RN fallback)
const cachedImageSrc = readFileSync(join(ROOT, "packages/ui/src/CachedImage.tsx"), "utf8");
if (!cachedImageSrc.includes('from "expo-image"')) {
  fail("CachedImage.tsx must import from expo-image");
}
if (cachedImageSrc.includes("react-native") && cachedImageSrc.includes("Image as")) {
  fail("CachedImage.tsx must not fall back to react-native Image");
}
ok("CachedImage uses expo-image directly");

const progressiveSrc = readFileSync(join(ROOT, "packages/ui/src/ProgressiveImage.tsx"), "utf8");
if (progressiveSrc.includes("react-native") && progressiveSrc.includes("RNImage")) {
  fail("ProgressiveImage.tsx must not fall back to react-native Image");
}
ok("ProgressiveImage has no RN Image fallback");

// 3. No remote <Image source={{ uri in app/components/packages (except dimension helpers)
const allowedRnImage = new Set([
  "packages/ui/src/useImageDimensions.ts",
  "packages/ui/src/CachedImage.tsx",
  "lib/photo-adjustment.ts",
]);

const offenders: string[] = [];
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file);
  if (!rel.startsWith("app/") && !rel.startsWith("components/") && !rel.startsWith("packages/ui/src/")) {
    continue;
  }
  if (allowedRnImage.has(rel)) continue;
  const src = readFileSync(file, "utf8");
  if (/<Image[^>]*source=\{\{\s*uri/.test(src)) offenders.push(rel);
  if (/Image,\s*Pressable/.test(src) && src.includes('source={{ uri')) offenders.push(rel);
}

if (offenders.length) {
  fail(`react-native Image still used for remote URIs:\n  ${[...new Set(offenders)].join("\n  ")}`);
}
ok("No remote react-native Image usages in UI surfaces");

console.log("[verify:expo-image] All checks passed.");
