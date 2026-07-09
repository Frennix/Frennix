import type { Message } from "@frennix/types";
import type { QueryClient } from "@tanstack/react-query";
import type { Conversation } from "@frennix/types";

/** Patch inbox cache when a new message arrives — avoids full conversations refetch. */
export function patchConversationOnNewMessage(
  queryClient: QueryClient,
  userId: string,
  message: Message
) {
  queryClient.setQueryData<Conversation[]>(["conversations", userId], (old = []) => {
    const idx = old.findIndex((c) => c.id === message.conversation_id);
    if (idx === -1) return old;

    const updated = [...old];
    const conv = { ...updated[idx] };
    conv.last_message = message;
    if (message.sender_id !== userId) {
      conv.unread_count = (conv.unread_count ?? 0) + 1;
    }
    updated.splice(idx, 1);
    updated.unshift(conv);
    return updated;
  });
}
