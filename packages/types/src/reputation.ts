/** Reputation dimensions — recorded in background, no public UI yet. */
export type ReputationDimension =
  | "consistency"
  | "reliability"
  | "community"
  | "partnership";

export interface UserReputationScore {
  user_id: string;
  consistency_score: number;
  reliability_score: number;
  community_score: number;
  partnership_score: number;
  total_score: number;
  events_recorded_count: number;
  last_event_at: string | null;
  updated_at: string;
}

export interface ReputationEventWeight {
  event_type: string;
  consistency_weight: number;
  reliability_weight: number;
  community_weight: number;
  partnership_weight: number;
  description: string | null;
}
