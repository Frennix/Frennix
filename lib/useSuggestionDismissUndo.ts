import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Profile, SuggestedAthlete } from "@frennix/types";
import {
  dismissSuggestion,
  getSuggestedAthletes,
  getSuggestionDismissErrorMessage,
  undoDismissSuggestion,
} from "@frennix/api";
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

  const patchDismissedIds = useCallback(
    (updater: (current: string[]) => string[]) => {
      queryClient.setQueryData<string[]>(["dismissed-suggestion-ids", userId], (current) => {
        const next = updater(current ?? []);
        return [...new Set(next)];
      });
    },
    [queryClient, userId]
  );

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
    } catch (error) {
      console.warn("[suggestion-dismiss] backfill failed", error);
    }
  }, [patchSuggestions, queryClient, userId, viewerProfile]);

  const persistDismiss = useCallback(
    async (athlete: SuggestedAthlete, restore?: PendingDismiss) => {
      const dismissedId = athlete.profile.id;
      try {
        await dismissSuggestion(userId, dismissedId);
        patchDismissedIds((ids) => [...ids, dismissedId]);
        void queryClient.invalidateQueries({ queryKey: ["dismissed-suggestion-ids", userId] });
        void queryClient.invalidateQueries({ queryKey: ["discover-suggestions", userId] });
      } catch (error) {
        pendingIdsRef.current.delete(dismissedId);
        if (restore) {
          patchSuggestions((current) => {
            if (current.some((item) => item.profile.id === dismissedId)) return current;
            const next = [...current];
            next.splice(Math.min(restore.index, next.length), 0, athlete);
            return next;
          });
          patchDismissedIds((ids) => ids.filter((id) => id !== dismissedId));
        }
        showAlert("Could not remove suggestion", getSuggestionDismissErrorMessage(error));
        setPendingDismiss(null);
      }
    },
    [patchDismissedIds, patchSuggestions, queryClient, userId]
  );

  const dismissSuggestionRequest = useCallback(
    (athlete: SuggestedAthlete) => {
      const existing = pendingRef.current;
      if (existing) {
        clearTimer();
        setPendingDismiss(null);
      }

      const current = queryClient.getQueryData<SuggestedAthlete[]>(["discover-suggestions", userId]) ?? [];
      const index = current.findIndex((item) => item.profile.id === athlete.profile.id);
      const pending: PendingDismiss = {
        athlete,
        index: index >= 0 ? index : current.length,
      };

      pendingIdsRef.current.add(athlete.profile.id);
      patchSuggestions((list) => list.filter((item) => item.profile.id !== athlete.profile.id));
      patchDismissedIds((ids) => [...ids, athlete.profile.id]);
      void backfillSuggestion();
      void persistDismiss(athlete, pending);

      setPendingDismiss(pending);
      undoTimerRef.current = setTimeout(() => {
        setPendingDismiss(null);
      }, SUGGESTION_DISMISS_UNDO_MS);
    },
    [backfillSuggestion, clearTimer, patchDismissedIds, patchSuggestions, persistDismiss, queryClient, userId]
  );

  const undoDismiss = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimer();

    const dismissedId = pending.athlete.profile.id;
    pendingIdsRef.current.delete(dismissedId);
    patchSuggestions((current) => {
      if (current.some((item) => item.profile.id === dismissedId)) return current;
      const next = [...current];
      next.splice(Math.min(pending.index, next.length), 0, pending.athlete);
      return next.slice(0, MAX_VISIBLE_SUGGESTIONS);
    });
    patchDismissedIds((ids) => ids.filter((id) => id !== dismissedId));
    setPendingDismiss(null);

    void undoDismissSuggestion(userId, dismissedId)
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ["dismissed-suggestion-ids", userId] });
        void queryClient.invalidateQueries({ queryKey: ["discover-suggestions", userId] });
      })
      .catch((error) => {
        showAlert("Could not undo", getSuggestionDismissErrorMessage(error));
      });
  }, [clearTimer, patchDismissedIds, patchSuggestions, queryClient, userId]);

  useEffect(() => clearTimer, [clearTimer]);

  return {
    pendingDismiss,
    dismissSuggestionRequest,
    undoDismiss,
  };
}
