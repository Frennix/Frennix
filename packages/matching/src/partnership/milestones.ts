import type {
  PartnershipMilestoneCode,
  PartnershipMilestoneDefinition,
  PartnershipMilestoneMetadata,
  PartnershipMilestoneRecord,
  PartnershipTimelineEntry,
} from "@frennix/types";

export function formatPartnershipTimelineTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const dateLabel = date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeLabel = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${dateLabel} • ${timeLabel}`;
}

function readMilestoneMetadata(value: unknown): PartnershipMilestoneMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as PartnershipMilestoneMetadata;
}

export const PARTNERSHIP_MILESTONE_DEFINITIONS: readonly PartnershipMilestoneDefinition[] = [
  {
    code: "partnership_started",
    emoji: "🤝",
    label: "Training Partners",
    storyLabel: "Became Training Partners",
    futureHint: "Your partnership begins when you connect",
    sortOrder: 10,
    engagementPoints: 10,
  },
  {
    code: "first_conversation",
    emoji: "💬",
    label: "First conversation",
    storyLabel: "Started planning together",
    futureHint: "Send a message to break the ice",
    sortOrder: 20,
    engagementPoints: 15,
  },
  {
    code: "first_workout_together",
    emoji: "🏋️",
    label: "First workout together",
    storyLabel: "First Workout Together",
    futureHint: "Log a shared workout to unlock this moment",
    sortOrder: 30,
    engagementPoints: 25,
  },
  {
    code: "first_shared_streak_7",
    emoji: "🔥",
    label: "First 7-day shared streak",
    storyLabel: "First Shared 7-Day Streak",
    futureHint: "Train together consistently to build a shared streak",
    sortOrder: 40,
    engagementPoints: 30,
  },
  {
    code: "first_event_together",
    emoji: "📅",
    label: "First event together",
    storyLabel: "You showed up at an event as partners",
    futureHint: "Attend a Frennix event together",
    sortOrder: 50,
    engagementPoints: 20,
  },
  {
    code: "first_challenge_together",
    emoji: "🏆",
    label: "First challenge together",
    storyLabel: "You tackled a challenge side by side",
    futureHint: "Join a challenge together",
    sortOrder: 60,
    engagementPoints: 25,
  },
  {
    code: "workouts_together_10",
    emoji: "💪",
    label: "10 workouts together",
    storyLabel: "Ten workouts logged together — real consistency",
    futureHint: "Keep training together to reach ten shared workouts",
    sortOrder: 70,
    engagementPoints: 40,
  },
  {
    code: "encouragements_100",
    emoji: "❤️",
    label: "100 encouragements",
    storyLabel: "You exchanged 100 encouragements",
    futureHint: "Support each other with likes, comments, and accountability",
    sortOrder: 80,
    engagementPoints: 35,
  },
  {
    code: "partnership_30_days",
    emoji: "🤝",
    label: "30 days as partners",
    storyLabel: "Thirty days of showing up together",
    futureHint: "Stay active together over the next month",
    sortOrder: 90,
    engagementPoints: 30,
  },
  {
    code: "match_score_improved",
    emoji: "🎯",
    label: "Frennix Match evolved",
    storyLabel: "Your Frennix Match score grew together",
    futureHint: "Keep engaging — your compatibility score can evolve",
    sortOrder: 100,
    engagementPoints: 20,
  },
  {
    code: "top_training_partners",
    emoji: "🌟",
    label: "Top Training Partners",
    storyLabel: "You became top Training Partners in your community",
    futureHint: "Build one of the strongest partnerships on Frennix",
    sortOrder: 110,
    engagementPoints: 50,
  },
] as const;

const definitionByCode = new Map(
  PARTNERSHIP_MILESTONE_DEFINITIONS.map((definition) => [definition.code, definition])
);

export function getPartnershipMilestoneDefinition(
  code: PartnershipMilestoneCode
): PartnershipMilestoneDefinition | undefined {
  return definitionByCode.get(code);
}

export function buildPartnershipTimeline(
  achieved: PartnershipMilestoneRecord[]
): PartnershipTimelineEntry[] {
  const metadataByCode = new Map(
    achieved.map((record) => [record.milestone_code, readMilestoneMetadata(record.metadata)])
  );

  return PARTNERSHIP_MILESTONE_DEFINITIONS.map((definition) => {
    const record = achieved.find((item) => item.milestone_code === definition.code);
    const occurredAt = record?.occurred_at ?? null;
    const isAchieved = occurredAt != null;
    const metadata = metadataByCode.get(definition.code);
    const locationLabel =
      typeof metadata?.location_label === "string" ? metadata.location_label : null;
    const triggerSource =
      typeof metadata?.trigger_source === "string" ? metadata.trigger_source : null;

    return {
      code: definition.code,
      emoji: definition.emoji,
      label: definition.label,
      storyText: isAchieved ? definition.storyLabel : definition.futureHint,
      sortOrder: definition.sortOrder,
      status: isAchieved ? "achieved" : "upcoming",
      occurred_at: occurredAt,
      occurredAtLabel: occurredAt ? formatPartnershipTimelineTimestamp(occurredAt) : null,
      locationLabel,
      triggerSource,
      metadata,
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function sumMilestoneEngagementPoints(
  achievedCodes: Iterable<PartnershipMilestoneCode>
): number {
  let total = 0;
  for (const code of achievedCodes) {
    total += definitionByCode.get(code)?.engagementPoints ?? 0;
  }
  return total;
}

export function formatMatchScoreImprovementStory(
  fromScore: number,
  toScore: number
): string {
  return `Your Frennix Match evolved from ${fromScore}% to ${toScore}%`;
}
