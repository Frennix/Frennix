import type { DiscoverProfileItem } from "@frennix/types";

export function buildMutualConnectionsCopy(item: Pick<
  DiscoverProfileItem,
  "mutualFollowers" | "mutualFriends" | "mutualTrainingPartners" | "mutualGroups" | "mutualChallenges"
>): string | null {
  const parts: string[] = [];

  if ((item.mutualFriends ?? 0) > 0) {
    parts.push(
      item.mutualFriends === 1
        ? "1 mutual friend"
        : `${item.mutualFriends} mutual friends`
    );
  }

  if (item.mutualFollowers > 0) {
    parts.push(
      item.mutualFollowers === 1
        ? "1 mutual follower"
        : `${item.mutualFollowers} mutual followers`
    );
  }

  if (item.mutualTrainingPartners > 0) {
    parts.push(
      item.mutualTrainingPartners === 1
        ? "1 mutual training partner"
        : `${item.mutualTrainingPartners} mutual training partners`
    );
  }

  if (item.mutualGroups > 0) {
    parts.push(item.mutualGroups === 1 ? "1 mutual group" : `${item.mutualGroups} mutual groups`);
  }

  if (item.mutualChallenges > 0) {
    parts.push(
      item.mutualChallenges === 1
        ? "1 mutual challenge"
        : `${item.mutualChallenges} mutual challenges`
    );
  }

  return parts.length ? parts.join(" · ") : null;
}
