import { filterImagePrefetchUris, isImageMediaUri } from "@frennix/types";
import { prefetchCachedImages } from "../packages/ui/src/CachedImage";
import { feedDisplayImageUri } from "../packages/ui/src/feedMediaDelivery";
import type { Post } from "@frennix/types";
import { isFeedIsolateDisabled } from "@/lib/feed-isolate";

/** Warm resized feed images for upcoming rows. Skips original multi-megabyte files and videos. */
export function prefetchPostImages(posts: Post[], maxPosts = 12) {
  if (isFeedIsolateDisabled("image-preload")) return;
  const uris: string[] = [];
  for (const post of posts.slice(0, maxPosts)) {
    const display = post.shared_post ?? post;
    const firstImage = (display.media_urls ?? []).find((url) => isImageMediaUri(url));
    if (firstImage) uris.push(feedDisplayImageUri(firstImage));
    if (display.thumbnail_url) uris.push(feedDisplayImageUri(display.thumbnail_url));
  }
  const imageUris = filterImagePrefetchUris(uris);
  if (imageUris.length) void prefetchCachedImages(imageUris);
}
