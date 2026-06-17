import type { Message, Post, ReactionSummary } from "@frennix/types";

export function toggleReactionSummaries(
  reactions: ReactionSummary[] | undefined,
  emoji: string,
  currentEmoji: string | null | undefined
): { reactions: ReactionSummary[]; my_reaction: string | null } {
  let next = [...(reactions ?? [])];

  const applyDelta = (targetEmoji: string, delta: number, mine: boolean) => {
    const index = next.findIndex((reaction) => reaction.emoji === targetEmoji);
    if (index === -1) {
      if (delta > 0) {
        next.push({
          emoji: targetEmoji,
          count: delta,
          reacted_by_me: mine,
        });
      }
      return;
    }

    const count = Math.max(0, next[index].count + delta);
    if (count === 0) {
      next.splice(index, 1);
      return;
    }

    next[index] = {
      ...next[index],
      count,
      reacted_by_me: mine ? delta > 0 : delta < 0 ? false : next[index].reacted_by_me,
    };
  };

  if (currentEmoji === emoji) {
    applyDelta(emoji, -1, true);
    return { reactions: next, my_reaction: null };
  }

  if (currentEmoji) applyDelta(currentEmoji, -1, true);
  applyDelta(emoji, 1, true);
  return { reactions: next, my_reaction: emoji };
}

export function applyPostReactionOptimistic(
  post: Post,
  emoji: string,
  currentEmoji: string | null | undefined
): Post {
  const { reactions, my_reaction } = toggleReactionSummaries(post.reactions, emoji, currentEmoji);
  return { ...post, reactions, my_reaction };
}

export function applyMessageReactionOptimistic(
  message: Message,
  emoji: string,
  currentEmoji: string | null | undefined
): Message {
  const { reactions, my_reaction } = toggleReactionSummaries(message.reactions, emoji, currentEmoji);
  return { ...message, reactions, my_reaction };
}

export function patchPostsInFeedPage<T extends { posts: Post[] }>(
  page: T,
  postId: string,
  emoji: string,
  currentEmoji: string | null | undefined
): T {
  return {
    ...page,
    posts: page.posts.map((post) =>
      post.id === postId ? applyPostReactionOptimistic(post, emoji, currentEmoji) : post
    ),
  };
}

export function patchMessagesArray(
  messages: Message[],
  messageId: string,
  emoji: string,
  currentEmoji: string | null | undefined
): Message[] {
  return messages.map((message) =>
    message.id === messageId
      ? applyMessageReactionOptimistic(message, emoji, currentEmoji)
      : message
  );
}
