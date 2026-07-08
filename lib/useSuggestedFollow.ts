import { useQuery } from "@tanstack/react-query";
import { getFollowingIds } from "@frennix/api";
import { useFollowUser } from "@/lib/useFollowUser";

export function useSuggestedFollow(userId: string, options?: { enabled?: boolean }) {
  const followMutation = useFollowUser(userId);
  const enabled = options?.enabled ?? !!userId;

  const { data: followingIds = [] } = useQuery({
    queryKey: ["following-ids", userId],
    queryFn: () => getFollowingIds(userId),
    enabled: enabled && !!userId,
    staleTime: 120_000,
  });

  function isFollowing(profileId: string) {
    return followingIds.includes(profileId);
  }

  function toggleFollow(profileId: string) {
    followMutation.mutate({
      targetUserId: profileId,
      isFollowing: isFollowing(profileId),
    });
  }

  return {
    followingIds,
    isFollowing,
    toggleFollow,
    followMutation,
  };
}
