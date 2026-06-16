import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { followUser, unfollowUser } from "@frennix/api";
import type { Profile } from "@frennix/types";
import { formatActivity } from "@/lib/labels";
import { UserRow } from "@frennix/ui";

interface UserFollowRowProps {
  profile: Profile;
  currentUserId: string;
  isFollowing: boolean;
  onFollowChange?: () => void;
}

export function UserFollowRow({
  profile,
  currentUserId,
  isFollowing,
  onFollowChange,
}: UserFollowRowProps) {
  const queryClient = useQueryClient();
  const isSelf = profile.id === currentUserId;

  const followMutation = useMutation({
    mutationFn: async () => {
      if (isFollowing) await unfollowUser(currentUserId, profile.id);
      else await followUser(currentUserId, profile.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["is-following"] });
      queryClient.invalidateQueries({ queryKey: ["following-ids", currentUserId] });
      queryClient.invalidateQueries({ queryKey: ["profile-stats"] });
      queryClient.invalidateQueries({ queryKey: ["followers"] });
      queryClient.invalidateQueries({ queryKey: ["following"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
      onFollowChange?.();
    },
  });

  const subtitle = profile.activities?.length
    ? profile.activities.slice(0, 2).map(formatActivity).join(" · ")
    : profile.city ?? undefined;

  return (
    <UserRow
      profile={profile}
      subtitle={subtitle}
      actionLabel={!isSelf ? (isFollowing ? "Following" : "Follow") : undefined}
      onAction={!isSelf ? () => followMutation.mutate() : undefined}
      actionLoading={followMutation.isPending}
      onPress={() => router.push(`/user/${profile.username}`)}
    />
  );
}
