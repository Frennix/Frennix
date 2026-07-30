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
  const section = read("components/FeedSearchSection.tsx");
  const header = read("components/FeedHeader.tsx");
  const nav = read("lib/discover-navigation.ts");
  const api = read("packages/api/src/feed-search.ts");
  const controller = read("lib/feed-search-controller.ts");
  const webStyles = read("lib/web-document-styles.js");
  const index = read("app/(tabs)/index.tsx");
  const barrel = read("packages/ui/src/index.ts");

  record(results, "FeedSearchBar exported", barrel.includes('export * from "./FeedSearchBar"'));
  record(
    results,
    "Feed search uses TextInput",
    bar.includes("TextInput") && !bar.includes("onPress={() =>")
  );
  record(
    results,
    "Feed search placeholder",
    bar.includes("Search athletes, workouts, events")
  );
  record(results, "Feed search compact height", /BAR_HEIGHT = 48/.test(bar));
  record(results, "Feed search has filter icon", bar.includes("SlidersHorizontal"));
  record(results, "Feed search has clear button", bar.includes('accessibilityLabel="Clear search"'));
  record(results, "Feed search section exists", section.includes("FeedSearchSection"));
  record(results, "Feed search reuses searchProfiles", api.includes("searchProfiles("));
  record(
    results,
    "Feed search groups athletes/workouts/events",
    section.includes(">Athletes<") && section.includes(">Workouts<") && section.includes(">Events<")
  );
  record(results, "Feed search has cancel", section.includes("Cancel search"));
  record(results, "Feed search shows recent searches", section.includes("DiscoverRecentSearches"));
  record(results, "Feed search shows empty state", section.includes("No results found"));
  record(
    results,
    "FeedHeader places search before hero",
    header.indexOf("<FeedSearchSection") < header.indexOf("<FeedHeroBanner")
  );
  record(results, "FeedHeader hides chrome while searching", header.includes("searchActive"));
  record(
    results,
    "Filter icon opens Discover filters only",
    section.includes("openDiscoverSearch({ openFilters: true })") &&
      !section.includes("openDiscoverSearch({ focusSearch: true })")
  );
  record(results, "Navigation reuses Discover tab for filters", nav.includes('/(tabs)/discover') && nav.includes("openFilters"));
  record(results, "Feed search reset controller exists", controller.includes("resetFeedSearch"));
  record(results, "Feed search resets on blur/focus", section.includes("useFocusEffect") && section.includes("resetSearch"));
  record(results, "Feed search resets horizontal scroll", controller.includes("resetFeedScrollLayout"));
  record(results, "Feed screen resets search on scroll-to-top", index.includes("resetFeedSearch") && index.includes("scrollFeedToTop"));
  record(results, "Feed avoids keyboard inset drift", !index.includes("automaticallyAdjustKeyboardInsets"));
  record(results, "Web CSS clamps feed/search width", webStyles.includes("#feed-search-section") && webStyles.includes("overflow-x: hidden"));
  record(results, "Feed header uses overflow hidden", header.includes('overflow: "hidden"'));

  const failed = results.filter((r) => !r.ok);
  if (failed.length) process.exit(1);
  console.log("\nAll feed search bar checks passed.");
}

main();
