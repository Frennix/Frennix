import type { Post } from "@frennix/types";

export type FeedListRow =
  | { kind: "post"; id: string; post: Post }
  | { kind: "skeleton"; id: string };

const SKELETON_IDS = ["feed-skeleton-a", "feed-skeleton-b", "feed-skeleton-c", "feed-skeleton-d"] as const;

export function buildFeedListRows(
  posts: Post[],
  options: {
    hasNextPage: boolean;
    showTrailingSkeletons: boolean;
    skeletonCount?: number;
  }
): FeedListRow[] {
  const rows: FeedListRow[] = posts.map((post) => ({ kind: "post", id: post.id, post }));

  if (options.hasNextPage && options.showTrailingSkeletons) {
    const count = Math.min(Math.max(options.skeletonCount ?? 4, 2), SKELETON_IDS.length);
    for (let i = 0; i < count; i++) {
      rows.push({ kind: "skeleton", id: SKELETON_IDS[i] });
    }
  }

  return rows;
}
