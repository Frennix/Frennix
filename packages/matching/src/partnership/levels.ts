import type { PartnershipLevelDefinition, PartnershipLevelId } from "@frennix/types";

export const PARTNERSHIP_LEVELS: readonly PartnershipLevelDefinition[] = [
  {
    id: "new_partners",
    emoji: "🤝",
    label: "New Partners",
    minEngagementPoints: 0,
    description: "Your training story is just beginning.",
  },
  {
    id: "consistent_partners",
    emoji: "💪",
    label: "Consistent Partners",
    minEngagementPoints: 50,
    description: "You show up for each other and build momentum together.",
  },
  {
    id: "dedicated_partners",
    emoji: "🔥",
    label: "Dedicated Partners",
    minEngagementPoints: 150,
    description: "Shared workouts, streaks, and accountability keep you aligned.",
  },
  {
    id: "elite_partners",
    emoji: "⭐",
    label: "Elite Partners",
    minEngagementPoints: 350,
    description: "A deep training bond built through real engagement.",
  },
  {
    id: "legendary_partners",
    emoji: "👑",
    label: "Legendary Partners",
    minEngagementPoints: 700,
    description: "One of the strongest partnerships on Frennix.",
  },
] as const;

export function getPartnershipLevel(
  engagementPoints: number
): PartnershipLevelDefinition {
  let current = PARTNERSHIP_LEVELS[0]!;
  for (const level of PARTNERSHIP_LEVELS) {
    if (engagementPoints >= level.minEngagementPoints) {
      current = level;
    }
  }
  return current;
}

export function getNextPartnershipLevel(
  engagementPoints: number
): PartnershipLevelDefinition | null {
  const current = getPartnershipLevel(engagementPoints);
  const index = PARTNERSHIP_LEVELS.findIndex((level) => level.id === current.id);
  return PARTNERSHIP_LEVELS[index + 1] ?? null;
}

export function resolvePartnershipLevelId(
  levelId: string | null | undefined,
  engagementPoints: number
): PartnershipLevelId {
  const known = PARTNERSHIP_LEVELS.find((level) => level.id === levelId);
  if (known) return known.id;
  return getPartnershipLevel(engagementPoints).id;
}

export function engagementPointsForLevel(levelId: PartnershipLevelId): number {
  return PARTNERSHIP_LEVELS.find((level) => level.id === levelId)?.minEngagementPoints ?? 0;
}
