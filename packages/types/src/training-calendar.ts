export type TrainingCalendarItemType =
  | "solo_workout"
  | "partner_workout"
  | "run_walk"
  | "gym_session"
  | "event"
  | "challenge"
  | "rest_day";

export type TrainingCalendarPrivacy = "private" | "friends" | "public";

export type TrainingCalendarStatus = "scheduled" | "completed" | "missed" | "rescheduled";

export type TrainingSessionInviteStatus = "pending" | "accepted" | "declined" | "maybe_later";

/** Where a native calendar row originated — single hub, many entry points. */
export type TrainingCalendarSourceType =
  | "native"
  | "story_invite"
  | "story_commitment"
  | "message_invite"
  | "event_mirror"
  | "challenge_mirror"
  | "group_workout"
  | "run_club"
  | "coaching_session"
  | "nutrition_challenge"
  | "ai_recommendation"
  | "external_import";

/** Future wearable / calendar providers (schema reserved, not integrated). */
export type TrainingCalendarExternalProvider =
  | "google_calendar"
  | "apple_calendar"
  | "outlook_calendar"
  | "garmin_connect"
  | "apple_health"
  | "google_fit"
  | "strava"
  | "fitbit";

export type CalendarVirtualKind = "event" | "challenge" | "story_commitment";

export type WorkoutActivitySource = "calendar" | "post" | "story" | "commitment";

export const TRAINING_CALENDAR_ITEM_TYPES: Array<{
  value: TrainingCalendarItemType;
  label: string;
  icon: string;
}> = [
  { value: "solo_workout", label: "Solo workout", icon: "💪" },
  { value: "partner_workout", label: "Workout with partner", icon: "🤝" },
  { value: "run_walk", label: "Run / walk", icon: "🏃" },
  { value: "gym_session", label: "Gym session", icon: "🏋️" },
  { value: "event", label: "Event", icon: "📅" },
  { value: "challenge", label: "Challenge", icon: "🎯" },
  { value: "rest_day", label: "Rest day", icon: "🧘" },
];

export const TRAINING_CALENDAR_PRIVACY_OPTIONS: Array<{
  value: TrainingCalendarPrivacy;
  label: string;
}> = [
  { value: "private", label: "Private" },
  { value: "friends", label: "Friends" },
  { value: "public", label: "Public" },
];

export interface TrainingCalendarItem {
  id: string;
  user_id: string;
  title: string;
  item_type: TrainingCalendarItemType;
  scheduled_date: string;
  starts_at: string;
  ends_at: string | null;
  workout_type: string | null;
  location: string | null;
  notes: string | null;
  privacy: TrainingCalendarPrivacy;
  status: TrainingCalendarStatus;
  linked_event_id: string | null;
  linked_challenge_id: string | null;
  rescheduled_to_id: string | null;
  source_type: TrainingCalendarSourceType;
  source_id: string | null;
  completed_post_id: string | null;
  completed_story_id: string | null;
  completed_at: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
  is_owner?: boolean;
}

/** Unified calendar row — native DB item or virtual projection from events/challenges/stories. */
export interface CalendarViewItem extends TrainingCalendarItem {
  is_virtual: boolean;
  virtual_kind?: CalendarVirtualKind;
  /** Route to open when tapping a virtual item (event/challenge/story). */
  deep_link?: string;
}

export interface TrainingSessionInvite {
  id: string;
  calendar_item_id: string;
  inviter_id: string;
  invitee_id: string;
  status: TrainingSessionInviteStatus;
  created_at: string;
  responded_at: string | null;
  session_title?: string;
  session_starts_at?: string;
  inviter?: { id: string; display_name: string; username: string; avatar_url: string | null };
}

export interface TrainingSessionParticipant {
  calendar_item_id: string;
  user_id: string;
  role: "owner" | "partner";
  joined_at: string;
}

export interface WorkoutActivityDay {
  date: string;
  sources: WorkoutActivitySource[];
  primary_id?: string;
}

export interface CalendarView {
  items: CalendarViewItem[];
  activity: WorkoutActivityDay[];
  pending_invites: TrainingSessionInvite[];
  streak: number;
  weekly_consistency: {
    scheduled: number;
    completed: number;
    missed: number;
  };
}

export interface TrainingCalendarExternalLink {
  id: string;
  calendar_item_id: string;
  provider: TrainingCalendarExternalProvider;
  external_id: string;
  external_calendar_id: string | null;
  sync_direction: "import" | "export" | "bidirectional";
  last_synced_at: string | null;
  metadata: Record<string, unknown>;
}

export type CreateTrainingCalendarItemInput = {
  user_id: string;
  title: string;
  item_type: TrainingCalendarItemType;
  scheduled_date: string;
  starts_at: string;
  ends_at?: string | null;
  workout_type?: string | null;
  location?: string | null;
  notes?: string | null;
  privacy?: TrainingCalendarPrivacy;
  linked_event_id?: string | null;
  linked_challenge_id?: string | null;
  invitee_id?: string | null;
  source_type?: TrainingCalendarSourceType;
  source_id?: string | null;
};

export type UpdateTrainingCalendarItemInput = Partial<
  Omit<CreateTrainingCalendarItemInput, "user_id">
>;
