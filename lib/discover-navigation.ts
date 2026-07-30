import { switchTab } from "@/lib/press-utils";

type OpenDiscoverSearchOptions = {
  focusSearch?: boolean;
  openFilters?: boolean;
};

/** Reuses the Discover tab search UI — no duplicate search implementation. */
export function openDiscoverSearch(options: OpenDiscoverSearchOptions = {}) {
  switchTab({
    pathname: "/(tabs)/discover",
    params: {
      tab: "people",
      ...(options.focusSearch ? { focusSearch: "1" } : {}),
      ...(options.openFilters ? { openFilters: "1" } : {}),
    },
  });
}
