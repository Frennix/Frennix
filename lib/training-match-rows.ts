import type { Conversation, Match } from "@frennix/types";

export type TrainingMatchListItem = Match & {
  other_user?: Match["other_user"];
  conversation?: Conversation;
};

export function indexConversationsByPartnerId(conversations: Conversation[]) {
  const map = new Map<string, Conversation>();
  for (const conversation of conversations) {
    const partnerId = conversation.other_participant?.id;
    if (partnerId) {
      map.set(partnerId, conversation);
    }
  }
  return map;
}

export function enrichTrainingMatches(
  matches: Match[],
  conversations: Conversation[]
): TrainingMatchListItem[] {
  const conversationByPartnerId = indexConversationsByPartnerId(conversations);

  return matches
    .filter((match) => match.other_user)
    .map((match) => ({
      ...match,
      conversation: conversationByPartnerId.get(match.other_user!.id),
    }))
    .sort((a, b) => {
      const aUnread = a.conversation?.unread_count ?? 0;
      const bUnread = b.conversation?.unread_count ?? 0;
      if (aUnread !== bUnread) return bUnread - aUnread;

      const aTime =
        a.conversation?.last_message?.created_at ??
        a.conversation?.updated_at ??
        a.created_at;
      const bTime =
        b.conversation?.last_message?.created_at ??
        b.conversation?.updated_at ??
        b.created_at;

      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
}

export function formatTrainingMatchDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
