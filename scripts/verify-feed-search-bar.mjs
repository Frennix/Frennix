#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function record(results, name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function main() {
  const results = [];
  const bar = read("packages/ui/src/FeedSearchBar.tsx");
  const header = read("components/FeedHeader.tsx");
  const nav = read("lib/discover-navigation.ts");
  const discover = read("app/(tabs)/discover.tsx");
  const barrel = read("packages/ui/src/index.ts");

  record(results, "FeedSearchBar exported", barrel.includes('export * from "./FeedSearchBar"'));
  record(
    results,
    "Feed search placeholder",
    bar.includes("Search athletes, workouts, events")
  );
  record(results, "Feed search compact height", /BAR_HEIGHT = 48/.test(bar));
  record(results, "Feed search has filter icon", bar.includes("SlidersHorizontal"));
  record(
    results,
    "FeedHeader places search before hero",
    header.indexOf("<FeedSearchBar") < header.indexOf("<FeedHeroBanner")
  );
  record(results, "Navigation reuses Discover tab", nav.includes('/(tabs)/discover') && nav.includes("focusSearch"));
  record(results, "Discover focuses search from feed", discover.includes("peopleSearchRef") && discover.includes("focusSearch"));

  const failed = results.filter((r) => !r.ok);
  if (failed.length) process.exit(1);
  console.log("\nAll feed search bar checks passed.");
}

main();
