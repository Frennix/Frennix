import { useMutation, useQueryClient } from "@tanstack/react-query";
import { followUser, getErrorMessage, unfollowUser } from "@frennix/api";
import type { ProfileStats } from "@frennix/types";
import { showAlert } from "@/lib/alerts";

type FollowMutationVars = {
  targetUserId: string;
  isFollowing: boolean;
};

const EMPTY_PROFILE_STATS: ProfileStats = {
  posts: 0,
  followers: 0,
  following: 0,
  eventsJoined: 0,
  workoutStreak: 0,
};

function adjustProfileStats(
  stats: ProfileStats,
  delta: { followers?: number; following?: number }
): ProfileStats {
  return {
    ...stats,
    followers: Math.max(0, stats.followers + (delta.followers ?? 0)),
    following: Math.max(0, stats.following + (delta.following ?? 0)),
  };
}

export function useFollowUser(currentUserId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ targetUserId, isFollowing }: FollowMutationVars) => {
      if (!currentUserId) throw new Error("Sign in to follow people.");
      if (isFollowing) await unfollowUser(currentUserId, targetUserId);
      else await followUser(currentUserId, targetUserId);
    },
    onMutate: async ({ targetUserId, isFollowing }) => {
      const nextFollowing = !isFollowing;

      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["is-following", currentUserId, targetUserId] }),
        queryClient.cancelQueries({ queryKey: ["following-ids", currentUserId] }),
        queryClient.cancelQueries({ queryKey: ["profile-stats", targetUserId] }),
        queryClient.cancelQueries({ queryKey: ["profile-stats", currentUserId] }),
      ]);

      const previousIsFollowing = queryClient.getQueryData<boolean>([
        "is-following",
        currentUserId,
        targetUserId,
      ]);
      const previousFollowingIds = queryClient.getQueryData<string[]>([
        "following-ids",
        currentUserId,
      ]);
      const previousTargetStats = queryClient.getQueryData<ProfileStats>([
        "profile-stats",
        targetUserId,
      ]);
      const previousOwnStats = queryClient.getQueryData<ProfileStats>([
        "profile-stats",
        currentUserId,
      ]);

      queryClient.setQueryData(["is-following", currentUserId, targetUserId], nextFollowing);

      queryClient.setQueryData<string[]>(["following-ids", currentUserId], (old = []) => {
        if (nextFollowing) return old.includes(targetUserId) ? old : [...old, targetUserId];
        return old.filter((id) => id !== targetUserId);
      });

      queryClient.setQueryData<ProfileStats>(
        ["profile-stats", targetUserId],
        (old) =>
          adjustProfileStats(old ?? EMPTY_PROFILE_STATS, {
            followers: nextFollowing ? 1 : -1,
          })
      );

      queryClient.setQueryData<ProfileStats>(
        ["profile-stats", currentUserId],
        (old) =>
          adjustProfileStats(old ?? EMPTY_PROFILE_STATS, {
            following: nextFollowing ? 1 : -1,
          })
      );

      return {
        previousIsFollowing,
        previousFollowingIds,
        previousTargetStats,
        previousOwnStats,
      };
    },
    onError: (error, { isFollowing, targetUserId }, context) => {
      if (context) {
        queryClient.setQueryData(
          ["is-following", currentUserId, targetUserId],
          context.previousIsFollowing
        );
        if (context.previousFollowingIds !== undefined) {
          queryClient.setQueryData(["following-ids", currentUserId], context.previousFollowingIds);
        }
        if (context.previousTargetStats) {
          queryClient.setQueryData(["profile-stats", targetUserId], context.previousTargetStats);
        }
        if (context.previousOwnStats) {
          queryClient.setQueryData(["profile-stats", currentUserId], context.previousOwnStats);
        }
      }
      showAlert(
        isFollowing ? "Unfollow failed" : "Follow failed",
        getErrorMessage(error)
      );
    },
    onSettled: (_data, error, { targetUserId }) => {
      if (error) {
        queryClient.invalidateQueries({ queryKey: ["is-following", currentUserId, targetUserId] });
        queryClient.invalidateQueries({ queryKey: ["following-ids", currentUserId] });
        queryClient.invalidateQueries({ queryKey: ["profile-stats", targetUserId] });
        queryClient.invalidateQueries({ queryKey: ["profile-stats", currentUserId] });
      }
      queryClient.invalidateQueries({ queryKey: ["suggested-athletes", currentUserId] });
      queryClient.invalidateQueries({ queryKey: ["discover-suggestions", currentUserId] });
    },
  });
}
