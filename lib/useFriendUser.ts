import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addFriendDirect,
  cancelFriendRequest,
  getErrorMessage,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
} from "@frennix/api";
import type { ProfileSocialContext, ProfileStats } from "@frennix/types";
import { showAlert } from "@/lib/alerts";
import { hapticFollow } from "@/lib/haptics";

type FriendMutationVars = {
  targetUserId: string;
  social: ProfileSocialContext;
};

const EMPTY_STATS: ProfileStats = {
  posts: 0,
  followers: 0,
  following: 0,
  friends: 0,
  eventsJoined: 0,
  workoutStreak: 0,
};

function nextFriendStatus(
  current: ProfileSocialContext["friendStatus"],
  action: "add" | "accept" | "decline" | "cancel" | "remove"
): ProfileSocialContext["friendStatus"] {
  switch (action) {
    case "add":
      return "pending_outgoing";
    case "accept":
      return "friends";
    case "decline":
    case "cancel":
    case "remove":
      return "none";
    default:
      return current;
  }
}

export function useFriendUser(currentUserId: string) {
  const queryClient = useQueryClient();

  const invalidateSocial = (targetUserId: string) => {
    void queryClient.invalidateQueries({
      queryKey: ["profile-social", currentUserId, targetUserId],
    });
    void queryClient.invalidateQueries({ queryKey: ["profile-stats", targetUserId] });
    void queryClient.invalidateQueries({ queryKey: ["profile-stats", currentUserId] });
    void queryClient.invalidateQueries({ queryKey: ["friends", targetUserId] });
    void queryClient.invalidateQueries({ queryKey: ["friend-requests", currentUserId] });
  };

  const patchSocial = (
    targetUserId: string,
    patch: Partial<ProfileSocialContext>
  ) => {
    queryClient.setQueryData<ProfileSocialContext>(
      ["profile-social", currentUserId, targetUserId],
      (old) => (old ? { ...old, ...patch } : old)
    );
  };

  const patchFriendsCount = (targetUserId: string, delta: number) => {
    queryClient.setQueryData<ProfileStats>(["profile-stats", targetUserId], (old) => ({
      ...(old ?? EMPTY_STATS),
      friends: Math.max(0, (old?.friends ?? 0) + delta),
    }));
    queryClient.setQueryData<ProfileStats>(["profile-stats", currentUserId], (old) => ({
      ...(old ?? EMPTY_STATS),
      friends: Math.max(0, (old?.friends ?? 0) + delta),
    }));
  };

  return useMutation({
    mutationFn: async ({ targetUserId, social }: FriendMutationVars) => {
      if (!currentUserId) throw new Error("Sign in to manage friends.");

      switch (social.friendStatus) {
        case "none":
          if (social.friendMode === "request_required") {
            await sendFriendRequest(currentUserId, targetUserId);
          } else {
            await addFriendDirect(currentUserId, targetUserId);
          }
          return { action: "add" as const };
        case "pending_outgoing":
          await cancelFriendRequest(currentUserId, targetUserId);
          return { action: "cancel" as const };
        case "pending_incoming":
          await respondFriendRequest(currentUserId, targetUserId, true);
          return { action: "accept" as const };
        case "friends":
          await removeFriend(currentUserId, targetUserId);
          return { action: "remove" as const };
        default:
          throw new Error("Unsupported friend action");
      }
    },
    onMutate: async ({ targetUserId, social }) => {
      await queryClient.cancelQueries({
        queryKey: ["profile-social", currentUserId, targetUserId],
      });

      const previous = queryClient.getQueryData<ProfileSocialContext>([
        "profile-social",
        currentUserId,
        targetUserId,
      ]);

      let action: "add" | "accept" | "cancel" | "remove" = "add";
      if (social.friendStatus === "pending_outgoing") action = "cancel";
      else if (social.friendStatus === "pending_incoming") action = "accept";
      else if (social.friendStatus === "friends") action = "remove";
      else action = "add";

      if (action === "add" || action === "accept") hapticFollow();

      const nextStatus =
        action === "add"
          ? social.friendMode === "request_required"
            ? "pending_outgoing"
            : "friends"
          : nextFriendStatus(social.friendStatus, action);
      patchSocial(targetUserId, { friendStatus: nextStatus });

      if (action === "add" || action === "accept") {
        patchFriendsCount(targetUserId, 1);
        patchFriendsCount(currentUserId, 1);
      } else if (action === "remove") {
        patchFriendsCount(targetUserId, -1);
        patchFriendsCount(currentUserId, -1);
      }

      return { previous, targetUserId };
    },
    onError: (error, { targetUserId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["profile-social", currentUserId, targetUserId],
          context.previous
        );
      }
      showAlert("Friend action failed", getErrorMessage(error));
    },
    onSettled: (_data, _error, { targetUserId }) => {
      invalidateSocial(targetUserId);
    },
  });
}

export function useDeclineFriendRequest(currentUserId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requesterId: string) => {
      await respondFriendRequest(currentUserId, requesterId, false);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["friend-requests", currentUserId] });
    },
    onError: (error) => showAlert("Could not decline request", getErrorMessage(error)),
  });
}

export function useAcceptFriendRequest(currentUserId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requesterId: string) => {
      await respondFriendRequest(currentUserId, requesterId, true);
    },
    onSuccess: () => {
      hapticFollow();
      void queryClient.invalidateQueries({ queryKey: ["friend-requests", currentUserId] });
      void queryClient.invalidateQueries({ queryKey: ["profile-stats", currentUserId] });
    },
    onError: (error) => showAlert("Could not accept request", getErrorMessage(error)),
  });
}
