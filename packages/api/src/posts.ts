import type { Comment, FeedPage, Post, PostType } from "@frennix/types";
import { normalizePostWorkoutFields } from "@frennix/types";
import { formatSupabaseError } from "./profile-utils";
import { normalizeMediaExt, isVideoMime } from "./media-utils";
import {
  readMediaUploadBody,
  VIDEO_UPLOAD_TIMEOUT_MS,
  IMAGE_UPLOAD_TIMEOUT_MS,
  withTimeout,
} from "./upload-utils";
import { enrichPostsWithReactions } from "./reactions";
import { getSupabase } from "./supabase";

const FEED_PAGE_SIZE = 20;

export async function enrichPostsWithSharedPosts(posts: Post[]): Promise<Post[]> {
  return attachSharedPosts(posts);
}

async function attachSharedPosts(posts: Post[]): Promise<Post[]> {
  const sharedIds = posts
    .map((p) => p.shared_post_id)
    .filter((id): id is string => Boolean(id));
  if (!sharedIds.length) return posts;

  const uniqueIds = [...new Set(sharedIds)];
  const { data, error } = await getSupabase()
    .from("posts")
    .select(`*, author:profiles!posts_author_id_fkey(*)`)
    .in("id", uniqueIds);

  if (error) throw error;

  const byId = new Map(
    (data ?? []).map((p) => [p.id, normalizePostWorkoutFields(p as Post)])
  );
  return posts.map((p) => ({
    ...p,
    shared_post: p.shared_post_id ? byId.get(p.shared_post_id) : undefined,
  }));
}

type InteractionStatsRow = {
  post_id: string;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  saved_by_me: boolean;
};

type PreviewCommentRow = Comment;

async function fetchInteractionStatsRpc(
  postIds: string[],
  userId: string
): Promise<Map<string, InteractionStatsRow> | null> {
  const { data, error } = await getSupabase().rpc("get_post_interaction_stats", {
    p_post_ids: postIds,
    p_viewer_id: userId,
  });

  if (error) {
    if (error.code !== "PGRST202") {
      console.warn("[posts] get_post_interaction_stats RPC unavailable, using fallback", error.message);
    }
    return null;
  }

  const map = new Map<string, InteractionStatsRow>();
  for (const row of (data ?? []) as InteractionStatsRow[]) {
    map.set(row.post_id, row);
  }
  return map;
}

async function fetchInteractionStatsFallback(
  postIds: string[],
  userId: string
): Promise<Map<string, InteractionStatsRow>> {
  const [{ data: likes }, { data: comments }, { data: myLikes }, { data: mySaves }] =
    await Promise.all([
      getSupabase().from("likes").select("post_id").in("post_id", postIds),
      getSupabase().from("comments").select("post_id").in("post_id", postIds),
      getSupabase().from("likes").select("post_id").eq("user_id", userId).in("post_id", postIds),
      getSupabase().from("saved_posts").select("post_id").eq("user_id", userId).in("post_id", postIds),
    ]);

  const likeCounts = new Map<string, number>();
  const commentCounts = new Map<string, number>();
  for (const l of likes ?? []) likeCounts.set(l.post_id, (likeCounts.get(l.post_id) ?? 0) + 1);
  for (const c of comments ?? []) commentCounts.set(c.post_id, (commentCounts.get(c.post_id) ?? 0) + 1);
  const likedSet = new Set((myLikes ?? []).map((l) => l.post_id));
  const savedSet = new Set((mySaves ?? []).map((s) => s.post_id));

  const map = new Map<string, InteractionStatsRow>();
  for (const postId of postIds) {
    map.set(postId, {
      post_id: postId,
      like_count: likeCounts.get(postId) ?? 0,
      comment_count: commentCounts.get(postId) ?? 0,
      liked_by_me: likedSet.has(postId),
      saved_by_me: savedSet.has(postId),
    });
  }
  return map;
}

async function fetchPreviewCommentsRpc(postIds: string[]): Promise<Map<string, Comment[]> | null> {
  const { data, error } = await getSupabase().rpc("get_post_preview_comments", {
    p_post_ids: postIds,
  });

  if (error) {
    if (error.code !== "PGRST202") {
      console.warn("[posts] get_post_preview_comments RPC unavailable, using fallback", error.message);
    }
    return null;
  }

  const previewByPost = new Map<string, Comment[]>();
  for (const row of (data ?? []) as PreviewCommentRow[]) {
    const comment: Comment = {
      id: row.id,
      post_id: row.post_id,
      author_id: row.author_id,
      parent_id: row.parent_id,
      content: row.content,
      created_at: row.created_at,
      author: row.author,
    };
    const existing = previewByPost.get(comment.post_id) ?? [];
    if (existing.length < 2) {
      existing.push(comment);
      previewByPost.set(comment.post_id, existing);
    }
  }
  return previewByPost;
}

async function fetchPreviewCommentsFallback(postIds: string[]): Promise<Map<string, Comment[]>> {
  const { data: recentComments } = await getSupabase()
    .from("comments")
    .select(`*, author:profiles!comments_author_id_fkey(*)`)
    .in("post_id", postIds)
    .is("parent_id", null)
    .order("created_at", { ascending: true })
    .limit(postIds.length * 2);

  const previewByPost = new Map<string, Comment[]>();
  for (const comment of (recentComments ?? []) as Comment[]) {
    const existing = previewByPost.get(comment.post_id) ?? [];
    if (existing.length < 2) {
      existing.push(comment);
      previewByPost.set(comment.post_id, existing);
    }
  }
  return previewByPost;
}

async function enrichPosts(posts: Post[], userId: string): Promise<Post[]> {
  if (!posts.length) return [];

  const postIds = posts.map((p) => p.id);

  const [statsRpc, previewRpc] = await Promise.all([
    fetchInteractionStatsRpc(postIds, userId),
    fetchPreviewCommentsRpc(postIds),
  ]);

  const [statsByPost, previewByPost] = await Promise.all([
    statsRpc ?? fetchInteractionStatsFallback(postIds, userId),
    previewRpc ?? fetchPreviewCommentsFallback(postIds),
  ]);

  const withInteractions = posts.map((p) => {
    const stats = statsByPost.get(p.id);
    return normalizePostWorkoutFields({
      ...p,
      like_count: Number(stats?.like_count ?? 0),
      comment_count: Number(stats?.comment_count ?? 0),
      liked_by_me: stats?.liked_by_me ?? false,
      saved_by_me: stats?.saved_by_me ?? false,
      preview_comments: previewByPost.get(p.id) ?? [],
    });
  });

  const [withShared, withReactions] = await Promise.all([
    attachSharedPosts(withInteractions),
    enrichPostsWithReactions(withInteractions, userId),
  ]);

  const reactionsById = new Map(withReactions.map((post) => [post.id, post]));

  return withShared.map((post) => {
    const reactions = reactionsById.get(post.id);
    return reactions
      ? {
          ...post,
          reactions: reactions.reactions,
          my_reaction: reactions.my_reaction,
        }
      : post;
  });
}

export async function enrichPostsWithInteractions(
  posts: Post[],
  userId: string
): Promise<Post[]> {
  return enrichPosts(posts, userId);
}

export async function getFeed(
  userId: string,
  cursor?: string,
  limit = FEED_PAGE_SIZE
): Promise<FeedPage> {
  const [{ data: following }, { data: groups }, { data: challenges }] = await Promise.all([
    getSupabase().from("follows").select("following_id").eq("follower_id", userId),
    getSupabase().from("group_members").select("group_id").eq("user_id", userId),
    getSupabase()
      .from("challenge_participants")
      .select("challenge_id")
      .eq("user_id", userId)
      .eq("status", "active"),
  ]);

  const authorIds = [...new Set([userId, ...(following ?? []).map((f) => f.following_id)])];
  const groupIds = [...new Set((groups ?? []).map((g) => g.group_id))];
  const challengeIds = [...new Set((challenges ?? []).map((c) => c.challenge_id))];

  const orParts = [`author_id.in.(${authorIds.join(",")})`];
  if (groupIds.length) orParts.push(`group_id.in.(${groupIds.join(",")})`);
  if (challengeIds.length) orParts.push(`challenge_id.in.(${challengeIds.join(",")})`);

  let q = getSupabase()
    .from("posts")
    .select(`*, author:profiles!posts_author_id_fkey(*)`)
    .or(orParts.join(","))
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    q = q.lt("created_at", cursor);
  }

  const { data, error } = await q;
  if (error) throw error;
  if (!data?.length) return { posts: [], nextCursor: null };

  const posts = await enrichPosts(data as Post[], userId);
  const nextCursor = data.length === limit ? data[data.length - 1].created_at : null;

  return { posts, nextCursor };
}

export async function getPostsByUser(
  authorId: string,
  viewerId: string,
  cursor?: string,
  limit = 21
): Promise<FeedPage> {
  let q = getSupabase()
    .from("posts")
    .select(`*, author:profiles!posts_author_id_fkey(*)`)
    .eq("author_id", authorId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    q = q.lt("created_at", cursor);
  }

  const { data, error } = await q;
  if (error) throw error;
  if (!data?.length) return { posts: [], nextCursor: null };

  const posts = await enrichPosts(data as Post[], viewerId);
  const nextCursor = data.length === limit ? data[data.length - 1].created_at : null;

  return { posts, nextCursor };
}

export async function createPost(input: {
  author_id: string;
  content?: string;
  media_urls?: string[];
  thumbnail_url?: string | null;
  post_type: PostType;
  workout_types?: string[];
  /** @deprecated Prefer workout_types */
  workout_type?: string | null;
  group_id?: string | null;
  challenge_id?: string | null;
  event_id?: string | null;
  shared_post_id?: string | null;
  story_audience?: import("@frennix/types").StoryAudience;
}) {
  const workout_types =
    input.workout_types?.length
      ? input.workout_types
      : input.workout_type
        ? [input.workout_type]
        : [];

  const { workout_type: _legacy, workout_types: _ignored, story_audience, ...rest } = input;

  const { data, error } = await getSupabase()
    .from("posts")
    .insert({
      ...rest,
      workout_types,
      ...(story_audience ? { story_audience } : {}),
    })
    .select(`*, author:profiles!posts_author_id_fkey(*)`)
    .single();
  if (error) throw formatSupabaseError(error, "Failed to create post");
  if (!data) throw new Error("Post created but no data returned");
  return normalizePostWorkoutFields(data as Post);
}

export async function uploadPostMedia(
  userId: string,
  uri: string,
  mimeType: string,
  file?: File | null
) {
  const ext = normalizeMediaExt(mimeType);
  const fileName = `${userId}/${Date.now()}.${ext}`;
  const body = await readMediaUploadBody(uri, mimeType, file);
  const contentType = mimeType.includes("/")
    ? mimeType
    : ext === "mov" || ext === "mp4" || ext === "webm"
      ? "video/mp4"
      : "image/jpeg";

  const timeoutMs = isVideoMime(mimeType) ? VIDEO_UPLOAD_TIMEOUT_MS : IMAGE_UPLOAD_TIMEOUT_MS;

  const { error } = await withTimeout(
    getSupabase().storage.from("posts").upload(fileName, body, { contentType, upsert: false }),
    timeoutMs,
    "Post media upload"
  );

  if (error) throw formatSupabaseError(error, "Post media upload failed");

  const { data } = getSupabase().storage.from("posts").getPublicUrl(fileName);
  if (!data.publicUrl) throw new Error("Upload succeeded but public URL was not returned");
  return data.publicUrl;
}

export async function uploadPostThumbnail(userId: string, bytes: Uint8Array) {
  const fileName = `${userId}/${Date.now()}-thumb.jpg`;
  const { error } = await withTimeout(
    getSupabase().storage.from("posts").upload(fileName, bytes, { contentType: "image/jpeg", upsert: false }),
    IMAGE_UPLOAD_TIMEOUT_MS,
    "Video thumbnail upload"
  );

  if (error) throw formatSupabaseError(error, "Video thumbnail upload failed");

  const { data } = getSupabase().storage.from("posts").getPublicUrl(fileName);
  if (!data.publicUrl) throw new Error("Thumbnail upload succeeded but public URL was not returned");
  return data.publicUrl;
}

export async function toggleLike(postId: string, userId: string, liked: boolean) {
  if (liked) {
    const { error } = await getSupabase().from("likes").delete().eq("post_id", postId).eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await getSupabase().from("likes").insert({ post_id: postId, user_id: userId });
    if (error) throw error;
  }
}

export async function getPost(postId: string, userId: string): Promise<Post | null> {
  const { data, error } = await getSupabase()
    .from("posts")
    .select(`*, author:profiles!posts_author_id_fkey(*)`)
    .eq("id", postId)
    .single();
  if (error) throw error;

  const [{ count: likeCount }, { count: commentCount }, { data: like }, { data: save }] =
    await Promise.all([
      getSupabase().from("likes").select("*", { count: "exact", head: true }).eq("post_id", postId),
      getSupabase().from("comments").select("*", { count: "exact", head: true }).eq("post_id", postId),
      getSupabase().from("likes").select("id").eq("post_id", postId).eq("user_id", userId).maybeSingle(),
      getSupabase()
        .from("saved_posts")
        .select("post_id")
        .eq("post_id", postId)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

  const enriched = await attachSharedPosts([
    normalizePostWorkoutFields({
      ...(data as Post),
      like_count: likeCount ?? 0,
      comment_count: commentCount ?? 0,
      liked_by_me: !!like,
      saved_by_me: !!save,
    }),
  ]);

  const withReactions = await enrichPostsWithReactions(enriched, userId);
  return withReactions[0] ?? null;
}

/** Extract storage object path from a public posts bucket URL. */
export function extractPostsStoragePath(publicUrl: string): string | null {
  const markers = ["/storage/v1/object/public/posts/", "/object/public/posts/"];
  for (const marker of markers) {
    const idx = publicUrl.indexOf(marker);
    if (idx !== -1) {
      return decodeURIComponent(publicUrl.slice(idx + marker.length).split("?")[0] ?? "");
    }
  }
  return null;
}

export type UpdatePostPatch = {
  content?: string | null;
  workout_types?: string[];
  /** @deprecated Prefer workout_types */
  workout_type?: string | null;
  media_urls?: string[];
  thumbnail_url?: string | null;
  post_type?: Post["post_type"];
};

export async function removePostsStorageFiles(urls: string[]) {
  const paths = urls
    .map(extractPostsStoragePath)
    .filter((path): path is string => Boolean(path));

  if (!paths.length) return;

  const { error } = await getSupabase().storage.from("posts").remove(paths);
  if (error) throw formatSupabaseError(error, "Failed to delete post media");
}

export async function updatePost(
  postId: string,
  userId: string,
  patch: UpdatePostPatch,
  options?: { removedMediaUrls?: string[]; removedThumbnailUrl?: string | null }
) {
  const storageUrls = [...(options?.removedMediaUrls ?? [])];
  if (options?.removedThumbnailUrl) storageUrls.push(options.removedThumbnailUrl);

  if (storageUrls.length) {
    await removePostsStorageFiles(storageUrls);
  }

  const workout_types =
    patch.workout_types !== undefined
      ? patch.workout_types
      : patch.workout_type !== undefined
        ? patch.workout_type
          ? [patch.workout_type]
          : []
        : undefined;

  const { workout_type: _legacy, workout_types: _ignored, ...rest } = patch;
  const updatePayload =
    workout_types !== undefined ? { ...rest, workout_types } : rest;

  const { data, error } = await getSupabase()
    .from("posts")
    .update(updatePayload)
    .eq("id", postId)
    .eq("author_id", userId)
    .select(`*, author:profiles!posts_author_id_fkey(*)`)
    .single();

  if (error) throw formatSupabaseError(error, "Failed to update post");
  if (!data) throw new Error("Post update did not return a row");
  return normalizePostWorkoutFields(data as Post);
}

export async function deletePost(postId: string, userId: string) {
  const { data: post, error: fetchError } = await getSupabase()
    .from("posts")
    .select("id, author_id, media_urls, thumbnail_url")
    .eq("id", postId)
    .single();

  if (fetchError) throw formatSupabaseError(fetchError, "Failed to load post");
  if (!post) throw new Error("Post not found");
  if (post.author_id !== userId) throw new Error("You can only delete your own posts");

  const mediaUrls = (post.media_urls ?? []) as string[];
  const storageUrls = [...mediaUrls];
  if (post.thumbnail_url) storageUrls.push(post.thumbnail_url as string);

  const paths = storageUrls
    .map(extractPostsStoragePath)
    .filter((path): path is string => Boolean(path));

  if (paths.length) {
    const { error: storageError } = await getSupabase().storage.from("posts").remove(paths);
    if (storageError) throw formatSupabaseError(storageError, "Failed to delete post media");
  }

  const { error: deleteError } = await getSupabase()
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("author_id", userId);

  if (deleteError) throw formatSupabaseError(deleteError, "Failed to delete post");
}
