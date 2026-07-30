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
  const overlay = read("components/FeedSearchOverlay.tsx");
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
    "Feed search bar supports trigger mode",
    bar.includes("onBarPress") && bar.includes("showSoftInputOnFocus={!isTrigger}")
  );
  record(
    results,
    "Feed search placeholder",
    bar.includes("Search athletes, workouts, events")
  );
  record(results, "Feed search compact height", /BAR_HEIGHT = 48/.test(bar));
  record(results, "Feed search has filter icon", bar.includes("SlidersHorizontal"));
  record(results, "Feed search section is trigger-only", section.includes("onBarPress={openFeedSearch}") && !section.includes("DiscoverRecentSearches"));
  record(results, "Feed search overlay exists", overlay.includes("FeedSearchOverlay"));
  record(results, "Feed search reuses searchProfiles", api.includes("searchProfiles("));
  record(
    results,
    "Feed search groups athletes/workouts/events",
    overlay.includes(">Athletes<") && overlay.includes(">Workouts<") && overlay.includes(">Events<")
  );
  record(results, "Feed search has cancel", overlay.includes("Cancel search"));
  record(results, "Feed search shows recent searches", overlay.includes("DiscoverRecentSearches"));
  record(results, "Feed search shows empty state", overlay.includes("No results found"));
  record(
    results,
    "FeedHeader places search before hero",
    header.indexOf("<FeedSearchSection") < header.indexOf("<FeedHeroBanner")
  );
  record(results, "FeedHeader always shows chrome", !header.includes("searchActive"));
  record(
    results,
    "Filter icon opens Discover filters only",
    section.includes("openDiscoverSearch({ openFilters: true })") &&
      !section.includes("openDiscoverSearch({ focusSearch: true })")
  );
  record(results, "Navigation reuses Discover tab for filters", nav.includes('/(tabs)/discover') && nav.includes("openFilters"));
  record(results, "Feed search reset controller exists", controller.includes("resetFeedSearch"));
  record(results, "Feed search resets on blur/focus", overlay.includes("useFocusEffect") && overlay.includes("resetSearch"));
  record(results, "Feed search resets horizontal scroll", controller.includes("resetFeedHorizontalScroll"));
  record(results, "Feed search overlay mounted on feed screen", index.includes("<FeedSearchOverlay"));
  record(results, "Feed search restores scroll on close", index.includes("restoreFeedScrollPosition") && controller.includes("consumeFeedScrollY"));
  record(results, "Feed search overlay uses fixed web positioning", overlay.includes('position: "fixed"') && webStyles.includes("#feed-search-overlay"));
  record(results, "Feed search overlay header fits one row", overlay.includes("searchHeader") && overlay.includes("flexShrink: 0"));
  record(results, "Feed shortcuts use equal flex columns", read("packages/ui/src/FeedQuickActionCards.tsx").includes("flex: 1"));
  record(results, "Post actions use flexible equal items", read("packages/ui/src/feed-layout/FeedPostActionBar.tsx").includes("flex: 1") && !read("packages/ui/src/feed-layout/FeedPostActionBar.tsx").includes("onMore"));
  record(results, "Post cards avoid width 100% margin overflow", !/root:[\s\S]*width:\s*"100%"[\s\S]*marginHorizontal/.test(read("packages/ui/src/feed-layout/tokens.ts")));
  record(results, "More action lives in post header", read("packages/ui/src/FeedPostCard.tsx").includes("headerMoreButton"));
  record(results, "Feed avoids keyboard inset drift", !index.includes("automaticallyAdjustKeyboardInsets"));
  record(results, "Web CSS clamps feed/search width", webStyles.includes("#feed-search-section") && webStyles.includes("overflow-x: hidden"));
  record(results, "Feed header uses overflow hidden", header.includes('overflow: "hidden"'));

  const failed = results.filter((r) => !r.ok);
  if (failed.length) process.exit(1);
  console.log("\nAll feed search bar checks passed.");
}

main();
