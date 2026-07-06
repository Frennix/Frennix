import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { deleteConversationForUser, getErrorMessage } from "@frennix/api";
import type { Conversation } from "@frennix/types";
import { confirmDeleteConversation, showAlert } from "@/lib/alerts";

const DISMISS_ANIMATION_MS = 280;
export const CONVERSATION_DELETE_UNDO_MS = 7000;

type PendingDelete = {
  conversation: Conversation;
  index: number;
};

type UseConversationDeleteUndoOptions = {
  userId: string;
  patchConversations: (updater: (current: Conversation[]) => Conversation[]) => void;
  getConversationsList: () => Conversation[];
};

export function useConversationDeleteUndo({
  userId,
  patchConversations,
  getConversationsList,
}: UseConversationDeleteUndoOptions) {
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(() => new Set());
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<PendingDelete | null>(null);

  pendingRef.current = pendingDelete;

  const clearTimers = useCallback(() => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    if (animTimerRef.current) {
      clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }
  }, []);

  const commitDelete = useCallback(
    async (conversationId: string, restore?: PendingDelete) => {
      try {
        await deleteConversationForUser(conversationId, userId);
        void queryClient.invalidateQueries({ queryKey: ["unread-messages", userId] });
      } catch (error) {
        if (restore) {
          patchConversations((current) => {
            if (current.some((item) => item.id === restore.conversation.id)) return current;
            const next = [...current];
            next.splice(Math.min(restore.index, next.length), 0, restore.conversation);
            return next;
          });
        }
        showAlert("Could not delete conversation", getErrorMessage(error));
      }
    },
    [patchConversations, queryClient, userId]
  );

  const flushPendingDelete = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimers();
    setPendingDelete(null);
    void commitDelete(pending.conversation.id);
  }, [clearTimers, commitDelete]);

  const undoDelete = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimers();
    patchConversations((current) => {
      if (current.some((item) => item.id === pending.conversation.id)) return current;
      const next = [...current];
      next.splice(Math.min(pending.index, next.length), 0, pending.conversation);
      return next;
    });
    setPendingDelete(null);
  }, [clearTimers, patchConversations]);

  const requestDelete = useCallback(
    (conversation: Conversation) => {
      confirmDeleteConversation(() => {
        const existing = pendingRef.current;
        if (existing) {
          clearTimers();
          setPendingDelete(null);
          void commitDelete(existing.conversation.id);
        }

        const list = getConversationsList();
        const index = list.findIndex((item) => item.id === conversation.id);
        const pending: PendingDelete = { conversation, index: index >= 0 ? index : list.length };

        setDismissingIds((current) => new Set(current).add(conversation.id));
        animTimerRef.current = setTimeout(() => {
          patchConversations((current) => current.filter((item) => item.id !== conversation.id));
          setDismissingIds((current) => {
            const next = new Set(current);
            next.delete(conversation.id);
            return next;
          });

          setPendingDelete(pending);
          undoTimerRef.current = setTimeout(() => {
            setPendingDelete(null);
            void commitDelete(conversation.id);
          }, CONVERSATION_DELETE_UNDO_MS);
        }, DISMISS_ANIMATION_MS);
      });
    },
    [clearTimers, commitDelete, getConversationsList, patchConversations]
  );

  useEffect(() => clearTimers, [clearTimers]);

  const isDismissing = useCallback((id: string) => dismissingIds.has(id), [dismissingIds]);

  return {
    pendingDelete,
    requestDelete,
    undoDelete,
    flushPendingDelete,
    isDismissing,
  };
}
