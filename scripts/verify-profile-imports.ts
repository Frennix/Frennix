/**
 * Ensures every @frennix/ui symbol used by Profile screens is exported from the barrel.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const UI_INDEX = join(ROOT, "packages/ui/src/index.ts");

const PROFILE_UI_SYMBOLS = [
  "Button",
  "CachedImage",
  "Chip",
  "EditableAvatar",
  "PostGrid",
  "ProfileAchievementBadges",
  "ProfileContentTabs",
  "WorkoutStreakBadge",
  "colors",
  "formatPresenceStatus",
  "isProfileOnline",
  "isVideoMedia",
  "radius",
  "spacing",
  "typography",
  "Skeleton",
] as const;

function readExportSources(): string[] {
  const index = readFileSync(UI_INDEX, "utf8");
  const sources: string[] = [];
  for (const m of index.matchAll(/export \* from "\.\/(.+?)"/g)) {
    sources.push(m[1]);
  }
  for (const m of index.matchAll(/export\s*\{[\s\S]*?\}\s*from\s*"\.\/(.+?)"/g)) {
    sources.push(m[1]);
  }
  return sources;
}

function fileExportsSymbol(filePath: string, symbol: string): boolean {
  const source = readFileSync(filePath, "utf8");
  const patterns = [
    new RegExp(`export\\s+(?:function|const|class|type|interface|enum)\\s+${symbol}\\b`),
    new RegExp(`export\\s*\\{[\\s\\S]*?\\b${symbol}\\b`),
    new RegExp(`export\\s*\\{[\\s\\S]*?\\b${symbol}\\s+as\\s+\\w+`),
  ];
  return patterns.some((p) => p.test(source));
}

const uiDir = join(ROOT, "packages/ui/src");
const exportSources = readExportSources();
const missing: string[] = [];

for (const symbol of PROFILE_UI_SYMBOLS) {
  let found = false;
  for (const src of exportSources) {
    const candidates = [join(uiDir, `${src}.tsx`), join(uiDir, `${src}.ts`)];
    for (const filePath of candidates) {
      if (!existsSync(filePath)) continue;
      if (fileExportsSymbol(filePath, symbol)) {
        found = true;
        break;
      }
    }
    if (found) break;
  }
  if (!found) missing.push(symbol);
}

if (missing.length) {
  console.error("Missing @frennix/ui exports for Profile:", missing.join(", "));
  process.exit(1);
}

console.log("All Profile @frennix/ui imports resolve from barrel exports.");
