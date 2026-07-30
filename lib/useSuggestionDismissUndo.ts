import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Profile, SuggestedAthlete } from "@frennix/types";
import { dismissSuggestion, getErrorMessage, getSuggestedAthletes } from "@frennix/api";
import { showAlert } from "@/lib/alerts";

export const SUGGESTION_DISMISS_UNDO_MS = 7000;
const MAX_VISIBLE_SUGGESTIONS = 10;

type PendingDismiss = {
  athlete: SuggestedAthlete;
  index: number;
};

export function useSuggestionDismissUndo(userId: string, viewerProfile: Profile | null | undefined) {
  const queryClient = useQueryClient();
  const [pendingDismiss, setPendingDismiss] = useState<PendingDismiss | null>(null);
  const pendingIdsRef = useRef<Set<string>>(new Set());
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<PendingDismiss | null>(null);

  pendingRef.current = pendingDismiss;

  const clearTimer = useCallback(() => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }, []);

  const patchSuggestions = useCallback(
    (updater: (current: SuggestedAthlete[]) => SuggestedAthlete[]) => {
      queryClient.setQueryData<SuggestedAthlete[]>(["discover-suggestions", userId], (current) => {
        const next = updater(current ?? []);
        const deduped: SuggestedAthlete[] = [];
        const seen = new Set<string>();
        for (const item of next) {
          if (seen.has(item.profile.id)) continue;
          seen.add(item.profile.id);
          deduped.push(item);
        }
        return deduped.slice(0, MAX_VISIBLE_SUGGESTIONS);
      });
    },
    [queryClient, userId]
  );

  const backfillSuggestion = useCallback(async () => {
    const current = queryClient.getQueryData<SuggestedAthlete[]>(["discover-suggestions", userId]) ?? [];
    if (current.length >= MAX_VISIBLE_SUGGESTIONS) return;

    const followingIds = queryClient.getQueryData<string[]>(["following-ids", userId]) ?? [];
    const dismissedIds = queryClient.getQueryData<string[]>(["dismissed-suggestion-ids", userId]) ?? [];
    const extraExcludedIds = [...pendingIdsRef.current];

    try {
      const fresh = await getSuggestedAthletes(userId, 20, {
        viewer: viewerProfile ?? undefined,
        followingIds,
        dismissedIds,
        extraExcludedIds,
      });
      const existing = new Set(current.map((item) => item.profile.id));
      const replacement = fresh.find((item) => !existing.has(item.profile.id));
      if (!replacement) return;
      patchSuggestions((list) => [...list, replacement]);
    } catch {
      // Backfill is best-effort; dismissal UX should still succeed.
    }
  }, [patchSuggestions, queryClient, userId, viewerProfile]);

  const commitDismiss = useCallback(
    async (dismissedId: string, restore?: PendingDismiss) => {
      try {
        await dismissSuggestion(userId, dismissedId);
        void queryClient.invalidateQueries({ queryKey: ["dismissed-suggestion-ids", userId] });
        void queryClient.invalidateQueries({ queryKey: ["discover-suggestions", userId] });
      } catch (error) {
        if (restore) {
          patchSuggestions((current) => {
            if (current.some((item) => item.profile.id === restore.athlete.profile.id)) return current;
            const next = [...current];
            next.splice(Math.min(restore.index, next.length), 0, restore.athlete);
            return next;
          });
        }
        showAlert("Could not remove suggestion", getErrorMessage(error));
      }
    },
    [patchSuggestions, queryClient, userId]
  );

  const dismissSuggestionRequest = useCallback(
    (athlete: SuggestedAthlete) => {
      const existing = pendingRef.current;
      if (existing) {
        clearTimer();
        setPendingDismiss(null);
        pendingIdsRef.current.delete(existing.athlete.profile.id);
        void commitDismiss(existing.athlete.profile.id);
      }

      const current = queryClient.getQueryData<SuggestedAthlete[]>(["discover-suggestions", userId]) ?? [];
      const index = current.findIndex((item) => item.profile.id === athlete.profile.id);
      const pending: PendingDismiss = {
        athlete,
        index: index >= 0 ? index : current.length,
      };

      pendingIdsRef.current.add(athlete.profile.id);
      patchSuggestions((list) => list.filter((item) => item.profile.id !== athlete.profile.id));
      void backfillSuggestion();

      setPendingDismiss(pending);
      undoTimerRef.current = setTimeout(() => {
        pendingIdsRef.current.delete(athlete.profile.id);
        setPendingDismiss(null);
        void commitDismiss(athlete.profile.id);
      }, SUGGESTION_DISMISS_UNDO_MS);
    },
    [backfillSuggestion, clearTimer, commitDismiss, patchSuggestions, queryClient, userId]
  );

  const undoDismiss = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimer();
    pendingIdsRef.current.delete(pending.athlete.profile.id);
    patchSuggestions((current) => {
      if (current.some((item) => item.profile.id === pending.athlete.profile.id)) return current;
      const next = [...current];
      next.splice(Math.min(pending.index, next.length), 0, pending.athlete);
      return next.slice(0, MAX_VISIBLE_SUGGESTIONS);
    });
    setPendingDismiss(null);
  }, [clearTimer, patchSuggestions]);

  useEffect(() => clearTimer, [clearTimer]);

  return {
    pendingDismiss,
    dismissSuggestionRequest,
    undoDismiss,
  };
}
