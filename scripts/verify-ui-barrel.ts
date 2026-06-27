/**
 * Ensures the web bundle includes performance-optimization UI modules and
 * Profile can resolve CachedImage through @frennix/ui (tsconfig must point at ./packages/ui).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const distDir = join(ROOT, "dist/_expo/static/js/web");
const bundles = readdirSync(distDir).filter((f) => f.startsWith("entry-") && f.endsWith(".js"));

if (bundles.length === 0) {
  console.error("[verify:ui-barrel] No web bundle — run build:web first");
  process.exit(1);
}

const bundle = readFileSync(join(distDir, bundles[0]!), "utf8");

const checks: Array<{ name: string; test: () => boolean; hint?: string }> = [
  {
    name: "CachedImage exported in bundle",
    test: () => /e\.CachedImage=function/.test(bundle),
  },
  {
    name: "ScalePressable exported in bundle",
    test: () => /e\.ScalePressable=function/.test(bundle),
  },
  {
    name: "ProgressiveImage exported in bundle",
    test: () => /e\.ProgressiveImage=function/.test(bundle),
  },
  {
    name: "QueryErrorState exported in bundle",
    test: () => /e\.QueryErrorState=function/.test(bundle),
  },
  {
    name: "PostGrid uses ProgressiveImage + ScalePressable",
    test: () => {
      const chunk = bundle.match(/e\.PostGrid=function[\s\S]{0,1200}/)?.[0] ?? "";
      return chunk.includes("ProgressiveImage") && chunk.includes("ScalePressable");
    },
    hint: "Metro may be resolving stale ../../packages/ui — check tsconfig paths",
  },
  {
    name: "ProfileScreenContent renders CachedImage from @frennix/ui barrel",
    test: () => {
      const chunk = bundle.match(/e\.ProfileScreenContent=function[\s\S]{0,2000}/)?.[0] ?? "";
      return chunk.includes("CachedImage");
    },
  },
  {
    name: "No Reanimated FadeInDown entering on web feed rows",
    test: () => !bundle.includes("FadeInDown.duration(260).springify().damping(22)"),
  },
];

let failed = 0;
for (const check of checks) {
  if (check.test()) {
    console.log(`[verify:ui-barrel] OK  ${check.name}`);
  } else {
    failed += 1;
    console.error(`[verify:ui-barrel] FAIL ${check.name}`);
    if (check.hint) console.error(`              ${check.hint}`);
  }
}

if (failed > 0) process.exit(1);
console.log(`[verify:ui-barrel] Bundle: ${bundles[0]}`);
