import { router } from "expo-router";
import type { Profile } from "@frennix/types";
import { formatActivity } from "@/lib/labels";
import { useFollowUser } from "@/lib/useFollowUser";
import { UserRow } from "@frennix/ui";

interface UserFollowRowProps {
  profile: Profile;
  currentUserId: string;
  isFollowing: boolean;
}

export function UserFollowRow({ profile, currentUserId, isFollowing }: UserFollowRowProps) {
  const followMutation = useFollowUser(currentUserId);
  const isSelf = profile.id === currentUserId;

  const subtitle = profile.activities?.length
    ? profile.activities.slice(0, 2).map(formatActivity).join(" · ")
    : profile.city ?? undefined;

  return (
    <UserRow
      profile={profile}
      subtitle={subtitle}
      actionLabel={!isSelf ? (isFollowing ? "Following" : "Follow") : undefined}
      onAction={
        !isSelf
          ? () => followMutation.mutate({ targetUserId: profile.id, isFollowing })
          : undefined
      }
      actionLoading={followMutation.isPending}
      onPress={() => router.push(`/user/${profile.username}`)}
    />
  );
}
