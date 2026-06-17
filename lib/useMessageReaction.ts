import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage, toggleMessageReaction } from "@frennix/api";
import type { Message } from "@frennix/types";
import { showAlert } from "@/lib/alerts";
import { patchMessagesArray } from "@/lib/reaction-utils";

type MessageReactionVars = {
  conversationId: string;
  messageId: string;
  emoji: string;
  currentEmoji?: string | null;
};

export function useMessageReaction(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId, emoji, currentEmoji }: MessageReactionVars) =>
      toggleMessageReaction(messageId, userId, emoji, currentEmoji),
    onMutate: async ({ conversationId, messageId, emoji, currentEmoji }) => {
      await queryClient.cancelQueries({ queryKey: ["messages", conversationId] });
      const previous = queryClient.getQueryData<Message[]>(["messages", conversationId]);

      queryClient.setQueryData<Message[]>(["messages", conversationId], (old = []) =>
        patchMessagesArray(old, messageId, emoji, currentEmoji)
      );

      return { previous, conversationId };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["messages", context.conversationId], context.previous);
      }
      showAlert("Reaction failed", getErrorMessage(error));
    },
    onSettled: (_data, _error, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    },
  });
}
