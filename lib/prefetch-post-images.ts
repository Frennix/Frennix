import { filterImagePrefetchUris } from "@frennix/types";
import { prefetchCachedImages } from "../packages/ui/src/CachedImage";
import type { Post } from "@frennix/types";
import { isFeedIsolateDisabled } from "@/lib/feed-isolate";

/** Warm image/thumbnail caches for upcoming feed rows — thumbnails only to avoid blocking UI. */
export function prefetchPostImages(posts: Post[], maxPosts = 12) {
  if (isFeedIsolateDisabled("image-preload")) return;
  for (const post of posts.slice(0, maxPosts)) {
    const uris: string[] = [];
    if (post.thumbnail_url) uris.push(post.thumbnail_url);
    const shared = post.shared_post;
    if (shared?.thumbnail_url) uris.push(shared.thumbnail_url);
    const imageUris = filterImagePrefetchUris(uris);
    if (imageUris.length) void prefetchCachedImages(imageUris);
  }
}
