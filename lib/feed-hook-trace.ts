import { markFeedRender } from "@/lib/feed-render-trace";

/** One-shot sync mark after a feed hook group completes (shows in banner trail). */
export function markFeedHook(id: string) {
  markFeedRender(`feed:hook:${id}`, "sync");
}
