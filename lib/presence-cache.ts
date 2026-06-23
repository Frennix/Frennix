import type { QueryClient } from "@tanstack/react-query";
import type { Conversation, Match, Profile } from "@frennix/types";
import type { ProfilePresenceUpdate } from "@frennix/api";

type PresenceFields = Pick<Profile, "is_online" | "last_seen_at">;

function patchPresenceFields<T extends PresenceFields>(
  profile: T,
  fields: PresenceFields
): T {
  return {
    ...profile,
    is_online: fields.is_online ?? profile.is_online,
    last_seen_at: fields.last_seen_at ?? profile.last_seen_at,
  };
}

export function applyProfilePresenceToCaches(
  queryClient: QueryClient,
  userId: string,
  update: ProfilePresenceUpdate
) {
  const fields: PresenceFields = {
    is_online: update.is_online,
    last_seen_at: update.last_seen_at,
  };

  queryClient.setQueryData<Match[]>(["training-matches", userId], (old) => {
    if (!old?.length) return old;
    let changed = false;
    const next = old.map((match) => {
      if (match.other_user?.id !== update.id) return match;
      changed = true;
      return { ...match, other_user: patchPresenceFields(match.other_user, fields) };
    });
    return changed ? next : old;
  });

  queryClient.setQueriesData<Record<string, Profile>>(
    { queryKey: ["conversation-profiles"] },
    (old) => {
      if (!old?.[update.id]) return old;
      return { ...old, [update.id]: patchPresenceFields(old[update.id], fields) };
    }
  );

  queryClient.setQueryData<Conversation[]>(["conversations", userId], (old) => {
    if (!old?.length) return old;
    let changed = false;
    const next = old.map((conversation) => {
      if (conversation.other_participant?.id !== update.id) return conversation;
      changed = true;
      return {
        ...conversation,
        other_participant: patchPresenceFields(conversation.other_participant, fields),
      };
    });
    return changed ? next : old;
  });
}
