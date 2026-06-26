import { prefetchCachedImage } from "../packages/ui/src/CachedImage";
import type { Post } from "@frennix/types";

/** Warm image/thumbnail caches for upcoming feed rows — thumbnails first to save bandwidth. */
export function prefetchPostImages(posts: Post[], maxPosts = 12) {
  for (const post of posts.slice(0, maxPosts)) {
    if (post.thumbnail_url) void prefetchCachedImage(post.thumbnail_url);
    const shared = post.shared_post;
    if (shared?.thumbnail_url) void prefetchCachedImage(shared.thumbnail_url);
    for (const url of post.media_urls ?? []) {
      if (url) void prefetchCachedImage(url);
    }
    for (const url of shared?.media_urls ?? []) {
      if (url) void prefetchCachedImage(url);
    }
  }
}
