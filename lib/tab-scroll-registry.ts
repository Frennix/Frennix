export type TabScrollKey = "feed" | "discover" | "events" | "messages" | "profile";

type TabScrollController = {
  scrollToTop: () => void;
};

const controllers = new Map<TabScrollKey, TabScrollController>();

export function registerTabScrollController(
  key: TabScrollKey,
  controller: TabScrollController
): () => void {
  controllers.set(key, controller);
  return () => {
    if (controllers.get(key) === controller) {
      controllers.delete(key);
    }
  };
}

/** Smoothly scroll the active tab content to its top without refetching data. */
export function scrollTabToTop(key: TabScrollKey) {
  controllers.get(key)?.scrollToTop();
}

/** Re-tap active tab: refresh when already at top, otherwise scroll to top. */
export function handleTabRetap(options: {
  isAtTop: () => boolean;
  scrollToTop: () => void;
  refresh?: () => void;
}) {
  if (options.isAtTop()) {
    options.refresh?.();
    return;
  }
  options.scrollToTop();
}

export function scrollFlatListToTop(
  listRef: { scrollToOffset?: (options: { offset: number; animated?: boolean }) => void } | null
) {
  listRef?.scrollToOffset?.({ offset: 0, animated: true });
}

export function scrollScrollViewToTop(
  scrollRef: { scrollTo?: (options: { y: number; animated?: boolean }) => void } | null
) {
  scrollRef?.scrollTo?.({ y: 0, animated: true });
}
