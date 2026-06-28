import { filterImagePrefetchUris } from "@frennix/types";
import { prefetchCachedImages } from "../packages/ui/src/CachedImage";
import type { Post } from "@frennix/types";

/** Warm image/thumbnail caches for upcoming feed rows — thumbnails first to save bandwidth. */
export function prefetchPostImages(posts: Post[], maxPosts = 12) {
  for (const post of posts.slice(0, maxPosts)) {
    const uris: string[] = [];
    if (post.thumbnail_url) uris.push(post.thumbnail_url);
    const shared = post.shared_post;
    if (shared?.thumbnail_url) uris.push(shared.thumbnail_url);
    uris.push(...(post.media_urls ?? []));
    uris.push(...(shared?.media_urls ?? []));
    const imageUris = filterImagePrefetchUris(uris);
    if (imageUris.length) void prefetchCachedImages(imageUris);
  }
}
