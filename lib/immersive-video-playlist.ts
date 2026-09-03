import { normalizePostMediaItems, type Post, type PostMediaItem } from "@frennix/types";
import { buildFeedVideoPlaybackId } from "@frennix/ui";

export type ImmersiveVideoPlaylistEntry = {
  postId: string;
  mediaIndex: number;
  item: PostMediaItem;
  playbackId: string;
};

export type ImmersiveVideoPlaylistSnapshot = {
  entries: ImmersiveVideoPlaylistEntry[];
  initialIndex: number;
};

function resolveDisplayPost(post: Post): Post {
  return post.shared_post ?? post;
}

export function extractVideoMediaIndex(
  post: Post,
  preferredIndex = 0
): { mediaIndex: number; item: PostMediaItem } | null {
  const displayPost = resolveDisplayPost(post);
  const items = normalizePostMediaItems(displayPost.media_urls ?? [], {
    postType: displayPost.post_type,
    thumbnailUrl: displayPost.thumbnail_url,
  });
  if (items[preferredIndex]?.kind === "video") {
    return { mediaIndex: preferredIndex, item: items[preferredIndex] };
  }
  const fallbackIndex = items.findIndex((item) => item.kind === "video");
  if (fallbackIndex < 0) return null;
  return { mediaIndex: fallbackIndex, item: items[fallbackIndex]! };
}

export function postHasFeedVideo(post: Post): boolean {
  return extractVideoMediaIndex(post, 0) != null;
}

export function buildFeedVideoPlaylistFromPosts(
  posts: Post[],
  startPostId: string,
  startMediaIndex = 0
): ImmersiveVideoPlaylistSnapshot {
  const entries: ImmersiveVideoPlaylistEntry[] = [];

  for (const post of posts) {
    const video = extractVideoMediaIndex(post, post.id === startPostId ? startMediaIndex : 0);
    if (!video) continue;
    const displayPost = resolveDisplayPost(post);
    entries.push({
      postId: displayPost.id,
      mediaIndex: video.mediaIndex,
      item: video.item,
      playbackId: buildFeedVideoPlaybackId(displayPost.id, video.mediaIndex),
    });
  }

  const initialIndex = Math.max(
    0,
    entries.findIndex((entry) => entry.postId === startPostId)
  );

  return { entries, initialIndex: initialIndex >= 0 ? initialIndex : 0 };
}

export function mergeUniquePlaylistEntries(
  existing: ImmersiveVideoPlaylistEntry[],
  additional: ImmersiveVideoPlaylistEntry[]
): ImmersiveVideoPlaylistEntry[] {
  const seen = new Set(existing.map((entry) => entry.playbackId));
  const merged = [...existing];
  for (const entry of additional) {
    if (seen.has(entry.playbackId)) continue;
    seen.add(entry.playbackId);
    merged.push(entry);
  }
  return merged;
}

export function buildPlaylistEntriesFromPosts(posts: Post[]): ImmersiveVideoPlaylistEntry[] {
  return buildFeedVideoPlaylistFromPosts(posts, posts[0]?.id ?? "", 0).entries;
}
