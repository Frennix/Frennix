/**
 * Ensure @frennix/api barrel has no duplicate export names (causes web black screen).
 * Run: npx tsx scripts/verify-api-exports.ts
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const API_SRC = join(__dirname, "../packages/api/src");

function collectFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) files.push(...collectFiles(full));
    else if (entry.endsWith(".ts")) files.push(full);
  }
  return files;
}

const exportPattern =
  /^export (?:async )?function ([A-Za-z0-9_]+)|^export const ([A-Za-z0-9_]+)/gm;

const names = new Map<string, string[]>();

for (const file of collectFiles(API_SRC)) {
  if (file.endsWith("index.ts")) continue;
  const src = readFileSync(file, "utf8");
  for (const match of src.matchAll(exportPattern)) {
    const name = match[1] ?? match[2];
    if (!name) continue;
    const list = names.get(name) ?? [];
    list.push(file.replace(API_SRC + "/", ""));
    names.set(name, list);
  }
}

const duplicates = [...names.entries()].filter(([, files]) => files.length > 1);

console.log("\nAPI export verification\n");
if (!duplicates.length) {
  console.log("✅ No duplicate exported function names in packages/api/src");
  process.exit(0);
}

for (const [name, files] of duplicates) {
  console.log(`❌ duplicate export: ${name}`);
  for (const file of files) console.log(`   - ${file}`);
}
console.log(`\n${duplicates.length} duplicate(s) found\n`);
process.exit(1);
