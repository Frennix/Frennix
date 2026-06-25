import type { FeedPage, Post } from "@frennix/types";
import { getSupabase } from "./supabase";
import { enrichPostsWithInteractions } from "./posts";

const SAVED_PAGE_SIZE = 20;

export async function toggleSave(postId: string, userId: string, saved: boolean) {
  if (saved) {
    const { error } = await getSupabase()
      .from("saved_posts")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await getSupabase()
      .from("saved_posts")
      .insert({ post_id: postId, user_id: userId });
    if (error) throw error;
  }
}

export async function getSavedPosts(
  userId: string,
  cursor?: string,
  limit = SAVED_PAGE_SIZE
): Promise<FeedPage> {
  let q = getSupabase()
    .from("saved_posts")
    .select("created_at, post:posts(*, author:profiles!posts_author_id_fkey(*))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    q = q.lt("created_at", cursor);
  }

  const { data, error } = await q;
  if (error) throw error;
  if (!data?.length) return { posts: [], nextCursor: null };

  const rows = data as { created_at: string; post: Post | null }[];
  const posts = rows.map((row) => row.post).filter((post): post is Post => Boolean(post));
  const enriched = await enrichPostsWithInteractions(posts, userId);
  const nextCursor = data.length === limit ? data[data.length - 1].created_at : null;

  return { posts: enriched, nextCursor };
}
