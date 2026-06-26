import type { QueryClient } from "@tanstack/react-query";
import type { Challenge, Group, WorkoutEvent } from "@frennix/types";

/** Remove a challenge from discover and my-challenge lists immediately after delete. */
export function removeChallengeFromLists(
  queryClient: QueryClient,
  challengeId: string,
  userId: string
) {
  queryClient.setQueriesData<Challenge[]>({ queryKey: ["discover-challenges"] }, (old) => {
    if (!old) return old;
    return old.filter((challenge) => challenge.id !== challengeId);
  });

  queryClient.setQueriesData<Challenge[]>({ queryKey: ["my-challenges", userId] }, (old) => {
    if (!old) return old;
    return old.filter((challenge) => challenge.id !== challengeId);
  });
}

/** Patch a challenge in discover/detail caches immediately after edit. */
export function updateChallengeInLists(
  queryClient: QueryClient,
  updated: Challenge,
  userId: string
) {
  queryClient.setQueriesData<Challenge[]>({ queryKey: ["discover-challenges"] }, (old) => {
    if (!old) return old;
    return old.map((challenge) => (challenge.id === updated.id ? { ...challenge, ...updated } : challenge));
  });

  queryClient.setQueriesData<Challenge[]>({ queryKey: ["my-challenges", userId] }, (old) => {
    if (!old) return old;
    return old.map((challenge) => (challenge.id === updated.id ? { ...challenge, ...updated } : challenge));
  });

  queryClient.setQueriesData<Challenge | null>({ queryKey: ["challenge", updated.id] }, (old) =>
    old ? { ...old, ...updated } : updated
  );
}

/** Remove a group from discover lists immediately after delete. */
export function removeGroupFromLists(queryClient: QueryClient, groupId: string) {
  queryClient.setQueriesData<Group[]>({ queryKey: ["discover-groups"] }, (old) => {
    if (!old) return old;
    return old.filter((group) => group.id !== groupId);
  });
}

/** Remove a cancelled event from the upcoming events tab immediately. */
export function removeEventFromLists(
  queryClient: QueryClient,
  eventId: string,
  userId: string
) {
  queryClient.setQueriesData<WorkoutEvent[]>({ queryKey: ["workout-events", userId] }, (old) => {
    if (!old) return old;
    return old.filter((event) => event.id !== eventId);
  });
}

/** Mark an event cancelled in detail cache when the user remains on the screen. */
export function markEventCancelledInCache(
  queryClient: QueryClient,
  eventId: string,
  userId: string
) {
  queryClient.setQueriesData<WorkoutEvent | null>(
    { queryKey: ["workout-event", eventId, userId] },
    (old) => (old ? { ...old, status: "cancelled" } : old)
  );
}
