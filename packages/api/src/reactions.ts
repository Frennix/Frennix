import type { Message, Post, ReactionSummary } from "@frennix/types";
import { REACTION_EMOJIS } from "@frennix/types";
import { getSupabase } from "./supabase";
import { subscribePostgresChanges, type RealtimeSubscription } from "./realtime-utils";

type RawReactionRow = {
  emoji: string;
  user_id: string;
};

export function buildReactionSummaries(
  reactions: RawReactionRow[],
  userId: string
): ReactionSummary[] {
  const counts = new Map<string, { count: number; reacted_by_me: boolean }>();

  for (const reaction of reactions) {
    const entry = counts.get(reaction.emoji) ?? { count: 0, reacted_by_me: false };
    entry.count += 1;
    if (reaction.user_id === userId) entry.reacted_by_me = true;
    counts.set(reaction.emoji, entry);
  }

  return REACTION_EMOJIS.filter((emoji) => counts.has(emoji)).map((emoji) => ({
    emoji,
    count: counts.get(emoji)!.count,
    reacted_by_me: counts.get(emoji)!.reacted_by_me,
  }));
}

export function getMyReaction(reactions: ReactionSummary[]): string | null {
  return reactions.find((reaction) => reaction.reacted_by_me)?.emoji ?? null;
}

export async function togglePostReaction(
  postId: string,
  userId: string,
  emoji: string,
  currentEmoji?: string | null
): Promise<string | null> {
  if (currentEmoji === emoji) {
    const { error } = await getSupabase()
      .from("post_reactions")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);
    if (error) throw error;
    return null;
  }

  const { error } = await getSupabase()
    .from("post_reactions")
    .upsert({ post_id: postId, user_id: userId, emoji }, { onConflict: "post_id,user_id" });

  if (error) throw error;
  return emoji;
}

export async function toggleMessageReaction(
  messageId: string,
  userId: string,
  emoji: string,
  currentEmoji?: string | null
): Promise<string | null> {
  if (currentEmoji === emoji) {
    const { error } = await getSupabase()
      .from("message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", userId);
    if (error) throw error;
    return null;
  }

  const { error } = await getSupabase()
    .from("message_reactions")
    .upsert({ message_id: messageId, user_id: userId, emoji }, { onConflict: "message_id,user_id" });

  if (error) throw error;
  return emoji;
}

export async function enrichPostsWithReactions(posts: Post[], userId: string): Promise<Post[]> {
  if (!posts.length) return posts;

  const postIds = posts.map((post) => post.id);
  const { data, error } = await getSupabase()
    .from("post_reactions")
    .select("post_id, user_id, emoji")
    .in("post_id", postIds);

  if (error) throw error;

  const byPost = new Map<string, RawReactionRow[]>();
  for (const row of data ?? []) {
    const list = byPost.get(row.post_id as string) ?? [];
    list.push({ emoji: row.emoji as string, user_id: row.user_id as string });
    byPost.set(row.post_id as string, list);
  }

  return posts.map((post) => {
    const reactions = buildReactionSummaries(byPost.get(post.id) ?? [], userId);
    return {
      ...post,
      reactions,
      my_reaction: getMyReaction(reactions),
    };
  });
}

export async function enrichMessagesWithReactions(
  messages: Message[],
  userId: string
): Promise<Message[]> {
  if (!messages.length) return messages;

  const messageIds = messages.map((message) => message.id);
  const { data, error } = await getSupabase()
    .from("message_reactions")
    .select("message_id, user_id, emoji")
    .in("message_id", messageIds);

  if (error) throw error;

  const byMessage = new Map<string, RawReactionRow[]>();
  for (const row of data ?? []) {
    const list = byMessage.get(row.message_id as string) ?? [];
    list.push({ emoji: row.emoji as string, user_id: row.user_id as string });
    byMessage.set(row.message_id as string, list);
  }

  return messages.map((message) => {
    const reactions = buildReactionSummaries(byMessage.get(message.id) ?? [], userId);
    return {
      ...message,
      reactions,
      my_reaction: getMyReaction(reactions),
    };
  });
}

export type MessageReactionsSubscription = RealtimeSubscription & {
  ok: boolean;
};

export function subscribeToMessageReactions(
  conversationId: string,
  onChange: () => void
): MessageReactionsSubscription {
  const subscription = subscribePostgresChanges("message-reactions", conversationId, [
    {
      config: { event: "*", schema: "public", table: "message_reactions" },
      callback: () => onChange(),
    },
  ]);

  return {
    ...subscription,
    ok: subscription.channel != null,
  };
}
