import { scoreProfileCompatibility } from "@frennix/api";
import type { DiscoverProfileItem, Profile, SuggestedAthlete } from "@frennix/types";
import { buildMutualConnectionsCopy } from "@/lib/discover-mutual-copy";

export function discoverItemToAthlete(
  item: DiscoverProfileItem,
  viewer?: Profile | null
): SuggestedAthlete {
  const enrichment = {
    mutual_count: item.mutualFollowers,
    mutualFriends: item.mutualFriends,
    badges: item.badges,
    mutualTrainingPartners: item.mutualTrainingPartners,
    mutualGroups: item.mutualGroups,
    mutualChallenges: item.mutualChallenges,
  };

  if (viewer) {
    const scored = scoreProfileCompatibility(viewer, item.profile);
    const mutualCopy = buildMutualConnectionsCopy(item);
    return {
      ...scored,
      ...enrichment,
      reason: mutualCopy || scored.reason,
    };
  }

  return {
    profile: item.profile,
    score: 0,
    compatibility_score: 0,
    match_reasons: [],
    shared_activities: item.profile.activities ?? [],
    shared_goals: item.profile.fitness_goals ?? [],
    reason: buildMutualConnectionsCopy(item) ?? "",
    ...enrichment,
  };
}

export const DISCOVER_SUGGESTED_SECTIONS: Array<{
  key: keyof import("@frennix/types").DiscoverSuggestedSections;
  title: string;
  subtitle: string;
}> = [
  {
    key: "peopleYouMayKnow",
    title: "People you may know",
    subtitle: "Athletes connected through mutual friends, goals, and events.",
  },
  {
    key: "recommendedForYou",
    title: "Recommended for you",
    subtitle: "Profiles aligned with your interests and fitness goals.",
  },
  {
    key: "trendingAthletes",
    title: "Trending athletes",
    subtitle: "Popular, active members gaining momentum this week.",
  },
  {
    key: "activeThisWeek",
    title: "Active this week",
    subtitle: "Athletes who posted or checked in recently.",
  },
  {
    key: "trainersNearYou",
    title: "Trainers near you",
    subtitle: "Verified coaches in your area.",
  },
  {
    key: "nearby",
    title: "Nearby athletes",
    subtitle: "Discoverable athletes in your area.",
  },
  {
    key: "trainingPartners",
    title: "Suggested training partners",
    subtitle: "Athletes open to training together near your goals.",
  },
  {
    key: "newMembers",
    title: "New members",
    subtitle: "Recently joined athletes on Frennix.",
  },
  {
    key: "similarGoals",
    title: "Similar fitness goals",
    subtitle: "People working toward goals like yours.",
  },
  {
    key: "popular",
    title: "Popular profiles",
    subtitle: "Active community members other athletes follow.",
  },
];
