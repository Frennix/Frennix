import type { Comment } from "@frennix/types";
import { formatSupabaseError } from "./profile-utils";
import { getSupabase } from "./supabase";

function buildCommentTree(flat: Comment[]): Comment[] {
  const byId = new Map<string, Comment>();
  for (const comment of flat) {
    byId.set(comment.id, { ...comment, replies: [] });
  }

  const roots: Comment[] = [];
  for (const comment of byId.values()) {
    if (comment.parent_id && byId.has(comment.parent_id)) {
      byId.get(comment.parent_id)!.replies!.push(comment);
    } else {
      roots.push(comment);
    }
  }

  return roots;
}

async function enrichComments(comments: Comment[], userId: string): Promise<Comment[]> {
  if (!comments.length) return [];

  const commentIds = comments.map((c) => c.id);
  const [{ data: likes }, { data: myLikes }] = await Promise.all([
    getSupabase().from("comment_likes").select("comment_id").in("comment_id", commentIds),
    getSupabase()
      .from("comment_likes")
      .select("comment_id")
      .eq("user_id", userId)
      .in("comment_id", commentIds),
  ]);

  const likeCounts = new Map<string, number>();
  for (const like of likes ?? []) {
    likeCounts.set(like.comment_id, (likeCounts.get(like.comment_id) ?? 0) + 1);
  }
  const likedSet = new Set((myLikes ?? []).map((l) => l.comment_id));

  return comments.map((comment) => ({
    ...comment,
    parent_id: comment.parent_id ?? null,
    like_count: likeCounts.get(comment.id) ?? 0,
    liked_by_me: likedSet.has(comment.id),
  }));
}

export async function getComments(postId: string, userId: string): Promise<Comment[]> {
  const { data, error } = await getSupabase()
    .from("comments")
    .select(`*, author:profiles!comments_author_id_fkey(*)`)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const enriched = await enrichComments((data ?? []) as Comment[], userId);
  return buildCommentTree(enriched);
}

export async function addComment(
  postId: string,
  authorId: string,
  content: string,
  parentId?: string | null
) {
  const { data, error } = await getSupabase()
    .from("comments")
    .insert({
      post_id: postId,
      author_id: authorId,
      content,
      parent_id: parentId ?? null,
    })
    .select(`*, author:profiles!comments_author_id_fkey(*)`)
    .single();

  if (error) throw formatSupabaseError(error, "Failed to add comment");
  return data as Comment;
}

export async function deleteComment(commentId: string, userId: string) {
  const { error } = await getSupabase()
    .from("comments")
    .delete()
    .eq("id", commentId)
    .eq("author_id", userId);

  if (error) throw formatSupabaseError(error, "Failed to delete comment");
}

export async function toggleCommentLike(commentId: string, userId: string, liked: boolean) {
  if (liked) {
    const { error } = await getSupabase()
      .from("comment_likes")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await getSupabase()
      .from("comment_likes")
      .insert({ comment_id: commentId, user_id: userId });
    if (error) throw error;
  }
}
