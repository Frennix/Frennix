import { Image, Platform } from "react-native";
import type { Post } from "@frennix/types";

function prefetchUri(uri: string) {
  if (Platform.OS === "web") {
    if (typeof globalThis.Image === "undefined") return;
    const img = new globalThis.Image();
    img.decoding = "async";
    img.src = uri;
    return;
  }
  void Image.prefetch(uri);
}

/** Warm image/thumbnail caches for upcoming feed rows. */
export function prefetchPostImages(posts: Post[], maxPosts = 12) {
  for (const post of posts.slice(0, maxPosts)) {
    if (post.thumbnail_url) prefetchUri(post.thumbnail_url);
    for (const url of post.media_urls ?? []) {
      if (url) prefetchUri(url);
    }
    const shared = post.shared_post;
    if (shared?.thumbnail_url) prefetchUri(shared.thumbnail_url);
    for (const url of shared?.media_urls ?? []) {
      if (url) prefetchUri(url);
    }
  }
}
