/**
 * Static verification for Discover user search (RPC, API, UI wiring).
 *
 * Usage: node scripts/verify-discover-search.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function mustInclude(file, ...needles) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) throw new Error(`Missing file: ${file}`);
  const text = fs.readFileSync(abs, "utf8");
  for (const needle of needles) {
    if (!text.includes(needle)) {
      throw new Error(`${file} must include: ${needle}`);
    }
  }
}

function main() {
  mustInclude(
    "supabase/migrations/20260708160000_discover_user_search.sql",
    "search_discover_profiles",
    "users_are_blocked",
    "visibility = 'public'",
    "has_more"
  );

  mustInclude(
    "packages/api/src/profiles.ts",
    "searchDiscoverProfiles",
    "getDiscoverSuggestedSections",
    "search_discover_profiles",
    "hasMore"
  );

  mustInclude(
    "packages/types/src/lifestyle.ts",
    "DiscoverSearchFilters",
    "hasActiveDiscoverSearchFilters"
  );

  mustInclude(
    "components/DiscoverSearchFilters.tsx",
    "DiscoverSearchFiltersBar",
    "nearby",
    "sameGoals",
    "trainingPartners"
  );

  mustInclude(
    "app/(tabs)/discover.tsx",
    "useInfiniteQuery",
    "searchDiscoverProfiles",
    "DiscoverSearchFiltersBar",
    "debouncedPeopleSearch.length >= 2",
    "fetchNextPage",
    "No users found",
    "Try another name, username, goal, or interest",
    "handleMessageUser",
    "onEndReached"
  );

  mustInclude(
    "packages/ui/src/DiscoverProfileCard.tsx",
    "goalLabels",
    "locationLabel",
    "onMessage",
    "onPress"
  );

  console.log("PASS  Discover user search wiring verified");
}

main();
