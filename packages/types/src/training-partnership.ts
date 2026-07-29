/** Partnership progression tiers — distinct from Frennix Match compatibility levels. */
export type PartnershipLevelId =
  | "new_partners"
  | "consistent_partners"
  | "dedicated_partners"
  | "elite_partners"
  | "legendary_partners";

/** Milestone codes — extend this union as new story beats ship. */
export type PartnershipMilestoneCode =
  | "partnership_started"
  | "first_workout_together"
  | "first_shared_streak_7"
  | "first_conversation"
  | "first_event_together"
  | "first_challenge_together"
  | "workouts_together_10"
  | "encouragements_100"
  | "partnership_30_days"
  | "top_training_partners"
  | "match_score_improved";

export interface PartnershipLevelDefinition {
  id: PartnershipLevelId;
  emoji: string;
  label: string;
  minEngagementPoints: number;
  description: string;
}

export interface PartnershipMilestoneDefinition {
  code: PartnershipMilestoneCode;
  emoji: string;
  label: string;
  /** Narrative copy for the compatibility timeline. */
  storyLabel: string;
  /** Teaser when the milestone is still ahead. */
  futureHint: string;
  sortOrder: number;
  /** Engagement points granted when achieved — levels require meaningful activity. */
  engagementPoints: number;
}

/** Extensible milestone metadata for timeline history and future features. */
export interface PartnershipMilestoneLinks {
  workout_id?: string | null;
  challenge_id?: string | null;
  event_id?: string | null;
  photo_url?: string | null;
}

export interface PartnershipMilestoneMetadata {
  trigger_source?: string;
  location_label?: string | null;
  links?: PartnershipMilestoneLinks;
  celebration?: string | null;
  [key: string]: unknown;
}

export interface TrainingPartnershipRecord {
  match_id: string;
  engagement_points: number;
  level_id: PartnershipLevelId;
  match_score_at_start: number | null;
  match_score_current: number | null;
  created_at: string;
  updated_at: string;
}

export interface PartnershipMilestoneRecord {
  id: string;
  match_id: string;
  milestone_code: PartnershipMilestoneCode;
  occurred_at: string;
  metadata: PartnershipMilestoneMetadata;
}

/** Single beat on the living compatibility timeline. */
export interface PartnershipTimelineEntry {
  code: PartnershipMilestoneCode;
  emoji: string;
  label: string;
  storyText: string;
  sortOrder: number;
  status: "achieved" | "upcoming";
  occurred_at: string | null;
  /** Formatted "Month D, YYYY • h:mm AM/PM" when achieved. */
  occurredAtLabel?: string | null;
  locationLabel?: string | null;
  triggerSource?: string | null;
  metadata?: PartnershipMilestoneMetadata;
}

export interface TrainingPartnershipJourney {
  partnership: TrainingPartnershipRecord;
  partner: {
    id: string;
    display_name: string;
    username: string | null;
    avatar_url: string | null;
  };
  level: PartnershipLevelDefinition;
  nextLevel: PartnershipLevelDefinition | null;
  timeline: PartnershipTimelineEntry[];
  /** Per-user intro completion — each partner sees intro once independently. */
  introCompleted: boolean;
}

export type TrainingPartnerJourneyRouteResult =
  | {
      accessible: true;
      route: "intro" | "timeline";
      href: string;
    }
  | {
      accessible: false;
      fallbackHref: string;
      message: string;
    };
