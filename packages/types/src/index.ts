export const REACTION_EMOJIS = ["❤️", "😂", "🔥", "👏", "💪"] as const;

import type { WorkoutStoryMetrics, WorkoutStoryMilestone, StoryAudience } from "./workout-story";
import type { FrennixStory } from "./dedicated-story";
import type { SkillLevel, TrainingEnvironment, TrainingScheduleSlot } from "./matching";
import type {
  ChildrenAgeGroup,
  LifestyleProfileFields,
  ParentStatus,
  ParentType,
  PreferredWorkoutTime,
} from "./lifestyle";
export type { WorkoutStoryMetrics, WorkoutStoryMilestone, StoryAudience } from "./workout-story";
export * from "./dedicated-story";
export * from "./training-calendar";
export * from "./achievements";
export * from "./reputation";
export * from "./platform-activity";

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export interface ReactionSummary {
  emoji: string;
  count: number;
  reacted_by_me: boolean;
}

export interface PostReaction {
  post_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface MessageReaction {
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export type ProfileVisibility = "public" | "followers" | "private";

export type PostType = "workout_update" | "text" | "photo" | "video";

export type GroupMemberRole = "owner" | "admin" | "member";

export type ChallengeParticipantStatus = "active" | "completed" | "left";

export type NotificationType =
  | "follow"
  | "message"
  | "like"
  | "reaction"
  | "comment"
  | "comment_reply"
  | "match"
  | "trainer_connection_request"
  | "trainer_connection_accepted"
  | "group_invite"
  | "challenge_reminder"
  | "challenge_join"
  | "challenge_invite"
  | "event_join"
  | "event_invite"
  | "post_share"
  | "story_train_invite"
  | "story_reaction"
  | "story_reply"
  | "story_mention"
  | "story_challenge_join"
  | "training_session_invite"
  | "training_session_accepted"
  | "training_session_reminder";

export type ChallengeInvitationStatus = "pending" | "declined";

export interface ChallengeInvitation {
  challenge_id: string;
  inviter_id: string;
  invitee_id: string;
  status: ChallengeInvitationStatus;
  created_at: string;
  updated_at: string;
}

export type MatchPreference = "same" | "opposite" | "any";

export type SwipeDirection = "left" | "right";

export type MatchStatus = "pending" | "matched" | "unmatched";

export interface MatchSwipe {
  swiper_id: string;
  swipee_id: string;
  direction: SwipeDirection;
  created_at: string;
}

export interface Match {
  id: string;
  user_a: string;
  user_b: string;
  status: MatchStatus;
  created_at: string;
  other_user?: Profile;
}

export interface RecordMatchSwipeResult {
  swipe: MatchSwipe;
  match: Match | null;
  is_mutual: boolean;
}

export type NotificationPreferenceKey =
  | "follow"
  | "like"
  | "comment"
  | "comment_reply"
  | "message"
  | "match"
  | "trainer_connection_request"
  | "trainer_connection_accepted"
  | "event_join"
  | "event_invite"
  | "challenge_join"
  | "challenge_invite"
  | "post_share";

export interface NotificationPreferences {
  follow: boolean;
  like: boolean;
  comment: boolean;
  comment_reply: boolean;
  message: boolean;
  match: boolean;
  trainer_connection_request: boolean;
  trainer_connection_accepted: boolean;
  event_join: boolean;
  event_invite: boolean;
  challenge_join: boolean;
  challenge_invite: boolean;
  post_share: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  follow: true,
  like: true,
  comment: true,
  comment_reply: true,
  message: true,
  match: true,
  trainer_connection_request: true,
  trainer_connection_accepted: true,
  event_join: true,
  event_invite: true,
  challenge_join: true,
  challenge_invite: true,
  post_share: true,
};

/** Dedicated notification_preferences table (engine v2). */
export type UserNotificationPreferenceKey =
  | "push_enabled"
  | "messages"
  | "likes"
  | "comments"
  | "replies"
  | "mentions"
  | "followers"
  | "matches"
  | "events"
  | "challenges"
  | "stories"
  | "run_clubs"
  | "groups"
  | "system_announcements"
  | "marketing"
  | "quiet_hours_enabled"
  | "quiet_hours_start"
  | "quiet_hours_end"
  | "timezone";

export interface UserNotificationPreferences {
  push_enabled: boolean;
  messages: boolean;
  likes: boolean;
  comments: boolean;
  replies: boolean;
  mentions: boolean;
  followers: boolean;
  matches: boolean;
  events: boolean;
  challenges: boolean;
  stories: boolean;
  run_clubs: boolean;
  groups: boolean;
  system_announcements: boolean;
  marketing: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  timezone: string;
}

export const DEFAULT_USER_NOTIFICATION_PREFERENCES: UserNotificationPreferences = {
  push_enabled: true,
  messages: true,
  likes: true,
  comments: true,
  replies: true,
  mentions: true,
  followers: true,
  matches: true,
  events: true,
  challenges: true,
  stories: true,
  run_clubs: true,
  groups: true,
  system_announcements: true,
  marketing: false,
  quiet_hours_enabled: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "07:00",
  timezone: "UTC",
};

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  cover_image_url?: string | null;
  bio: string | null;
  fitness_goals: string[];
  activities: string[];
  city: string | null;
  visibility: ProfileVisibility;
  matching_enabled: boolean;
  gender: string | null;
  match_preference: MatchPreference | null;
  is_premium: boolean;
  onboarding_complete: boolean;
  referral_code?: string;
  notification_preferences?: NotificationPreferences;
  is_admin?: boolean;
  is_trainer?: boolean;
  is_banned?: boolean;
  last_seen_at?: string | null;
  is_online?: boolean;
  /** When false, presence is hidden from other users. Only present on the signed-in user's profile. */
  show_online_status?: boolean | null;
  /** Matching engine — optional until collected in profile settings. */
  skill_level?: SkillLevel | null;
  training_schedules?: TrainingScheduleSlot[];
  home_gym?: string | null;
  training_environment?: TrainingEnvironment | null;
  discovery_radius_miles?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Lifestyle Matching — optional parent / schedule fields. */
  parent_status?: ParentStatus | null;
  parent_type?: ParentType | null;
  children_age_groups?: ChildrenAgeGroup[];
  preferred_workout_times?: PreferredWorkoutTime[];
  kid_friendly_workouts?: boolean | null;
  looking_for_parent_partner?: boolean | null;
  /** Extensible lifestyle tags — see LIFESTYLE_TAG_CATALOG. */
  lifestyle_tags?: import("./lifestyle").LifestyleTagId[];
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  author_id: string;
  content: string | null;
  media_urls: string[];
  thumbnail_url?: string | null;
  post_type: PostType;
  /** @deprecated Use workout_types. Kept for legacy rows and first-type display. */
  workout_type: string | null;
  workout_types: string[];
  group_id: string | null;
  challenge_id?: string | null;
  event_id?: string | null;
  shared_post_id?: string | null;
  created_at: string;
  updated_at: string;
  author?: Profile;
  shared_post?: Post;
  like_count?: number;
  comment_count?: number;
  liked_by_me?: boolean;
  saved_by_me?: boolean;
  reactions?: ReactionSummary[];
  my_reaction?: string | null;
  preview_comments?: Comment[];
  /** Optional workout stats for story completion card (wearable-ready). */
  workout_metrics?: WorkoutStoryMetrics | null;
  /** Story highlight flags, e.g. personal_record, goal_completed. */
  story_milestones?: string[];
  /** Workout Story audience when this post appears in stories. */
  story_audience?: StoryAudience;
}

export interface SavedPost {
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface FeedPage {
  posts: Post[];
  nextCursor: string | null;
}

export interface FeedStoryLastWorkout {
  post_id: string;
  post_type: PostType;
  workout_type: string | null;
  workout_types: string[];
  media_urls: string[];
  thumbnail_url?: string | null;
  content: string | null;
  created_at: string;
  metrics?: WorkoutStoryMetrics | null;
  milestones?: WorkoutStoryMilestone[];
  story_audience?: StoryAudience;
}

export interface FeedStory {
  user_id: string;
  profile: Profile;
  workout_streak: number;
  workout_count: number;
  has_recent_workout: boolean;
  /** Active dedicated stories (24h window). */
  active_stories: FrennixStory[];
  /** @deprecated Post-derived story — kept for migration fallback. */
  last_workout: FeedStoryLastWorkout | null;
  is_self: boolean;
  viewer_follows: boolean;
  /** True when the viewer has seen all active stories. */
  viewed?: boolean;
}

export interface SuggestedAthlete {
  profile: Profile;
  /** Sort key — same as compatibility_score when engine is used. */
  score: number;
  /** Unified fitness + lifestyle compatibility (0–100). */
  compatibility_score: number;
  match_reasons: MatchReason[];
  reason: string;
  mutual_count: number;
  shared_activities: string[];
  shared_goals: string[];
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  parent_id?: string | null;
  content: string;
  created_at: string;
  author?: Profile;
  like_count?: number;
  liked_by_me?: boolean;
  replies?: Comment[];
}

export interface Follow {
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  sport_tags: string[];
  cover_image_url: string | null;
  owner_id: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  member_count?: number;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: GroupMemberRole;
  joined_at: string;
  profile?: Profile;
}

export interface Challenge {
  id: string;
  title: string;
  description: string | null;
  rules: string | null;
  cover_image_url: string | null;
  start_date: string;
  end_date: string;
  created_by: string;
  group_id: string | null;
  created_at: string;
  participant_count?: number;
}

export interface ChallengeParticipant {
  challenge_id: string;
  user_id: string;
  status: ChallengeParticipantStatus;
  joined_at: string;
  profile?: Profile;
}

export type EventStatus = "active" | "cancelled";

export interface WorkoutEvent {
  id: string;
  title: string;
  description: string | null;
  workout_type: string | null;
  starts_at: string;
  location: string | null;
  max_attendees: number | null;
  status: EventStatus;
  created_by: string;
  group_id: string | null;
  created_at: string;
  updated_at: string;
  creator?: Profile;
  attendee_count?: number;
  joined_by_me?: boolean;
  is_full?: boolean;
}

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  last_message?: Message;
  other_participant?: Profile;
  unread_count?: number;
  /** Pinned conversation — stays below favorites in inbox (max 3). */
  is_pinned?: boolean;
  pinned_at?: string | null;
  /** Favorite training partner — top Messages section (max 5). */
  is_favorite?: boolean;
  favorited_at?: string | null;
  /** Muted conversations skip push notifications. */
  is_muted?: boolean;
  /** User-marked unread indicator independent of message read state. */
  marked_unread?: boolean;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  media_url: string | null;
  post_id?: string | null;
  story_reply_id?: string | null;
  reply_to_message_id?: string | null;
  reply_to?: Pick<Message, "id" | "content" | "sender_id" | "media_url" | "sender"> | null;
  created_at: string;
  read_at: string | null;
  /** Set when sender deletes for everyone — content hidden for all members. */
  deleted_for_everyone_at?: string | null;
  shared_post?: Post;
  reactions?: ReactionSummary[];
  my_reaction?: string | null;
  sender?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
  /** Soft-delete — set when user dismisses from notification center. History row retained. */
  deleted_at?: string | null;
  /** Engine v2 — denormalized for fast center render and push deep links. */
  actor_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  title?: string;
  body?: string;
  deep_link?: string;
  category?: string;
  dedupe_key?: string | null;
  delivered_at?: string | null;
  expires_at?: string | null;
  metadata?: Record<string, unknown>;
  actor?: Profile;
}

export interface Block {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface ProfileStats {
  posts: number;
  followers: number;
  following: number;
  eventsJoined: number;
  workoutStreak: number;
}

export interface ProfileAchievement {
  id: string;
  emoji: string;
  label: string;
  description: string;
}

export interface ReferralStats {
  friendsJoined: number;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  created_at: string;
}

export type FeedbackType = "bug" | "feature" | "general" | "rating" | "crash";
export type FeedbackStatus = "new" | "in_progress" | "fixed" | "released" | "closed";
export type FeedbackPriority = "critical" | "high" | "medium" | "low";

export type FeedbackFeatureArea =
  | "training_partners"
  | "trainer_matching"
  | "messages"
  | "events"
  | "notifications"
  | "general";

export interface BetaFeedback {
  id: string;
  user_id: string;
  type: FeedbackType;
  message: string | null;
  rating: number | null;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  feature_area: string | null;
  screen_path: string | null;
  app_version: string | null;
  platform: string | null;
  os_version: string | null;
  browser: string | null;
  build_number: string | null;
  screenshot_url: string | null;
  milestone_code: string | null;
  release_version: string | null;
  github_issue_url: string | null;
  github_commit_sha: string | null;
  notify_tester_when_resolved: boolean;
  tester_notified_at: string | null;
  metadata: Record<string, unknown>;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
  user?: Profile;
  username?: string;
  display_name?: string;
  avatar_url?: string | null;
}

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  reported_post_id: string | null;
  reported_comment_id?: string | null;
  reported_challenge_id?: string | null;
  reported_event_id?: string | null;
  reported_group_id?: string | null;
  reason: string;
  status?: ReportStatus;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  admin_notes?: string | null;
  created_at: string;
}

export type ReportStatus = "pending" | "reviewed" | "dismissed" | "action_taken";

export interface ModerationReport extends Report {
  status: ReportStatus;
  reporter?: Profile;
  reported_user?: Profile;
}

export const REPORT_REASONS = [
  "Spam or misleading",
  "Harassment or bullying",
  "Hate speech",
  "Violence or dangerous content",
  "Nudity or sexual content",
  "Other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const FITNESS_GOALS = [
  "lose_weight",
  "build_muscle",
  "run_marathon",
  "stay_active",
  "improve_endurance",
  "flexibility",
  "mental_wellness",
  "accountability_partner",
  "find_training_partner",
] as const;

export const SPORTS = ["football", "soccer", "basketball", "martial_arts"] as const;

export const WORKOUT_INTERESTS = [
  "running",
  "cycling",
  "weightlifting",
  "yoga",
  "swimming",
  "crossfit",
  "hiking",
  "other",
] as const;

export const ACTIVITIES = [...SPORTS, ...WORKOUT_INTERESTS] as const;

export type FitnessGoal = (typeof FITNESS_GOALS)[number];
export type Sport = (typeof SPORTS)[number];
export type WorkoutInterest = (typeof WORKOUT_INTERESTS)[number];
export type Activity = (typeof ACTIVITIES)[number];

export * from "./trainer";
export * from "./analytics";
export * from "./founder-dashboard";
export * from "./workout-types";
export * from "./post-media";
export * from "./story-engagement";
export * from "./workout-story";
export * from "./matching";
export * from "./lifestyle";
