export const REACTION_EMOJIS = ["❤️", "😂", "🔥", "👏", "💪"] as const;

import type { WorkoutStoryMetrics, WorkoutStoryMilestone, StoryAudience } from "./workout-story";
export type { WorkoutStoryMetrics, WorkoutStoryMilestone, StoryAudience } from "./workout-story";

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
  | "story_train_invite";

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
  last_workout: FeedStoryLastWorkout | null;
  is_self: boolean;
  viewer_follows: boolean;
  /** True when the viewer has seen the current last_workout post. */
  viewed?: boolean;
}

export interface SuggestedAthlete {
  profile: Profile;
  score: number;
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
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  media_url: string | null;
  post_id?: string | null;
  created_at: string;
  read_at: string | null;
  shared_post?: Post;
  reactions?: ReactionSummary[];
  my_reaction?: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
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

export type FeedbackType = "bug" | "feature" | "general" | "rating";
export type FeedbackStatus = "open" | "resolved";

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
  feature_area: string | null;
  screen_path: string | null;
  app_version: string | null;
  platform: string | null;
  metadata: Record<string, unknown>;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  user?: Profile;
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
export * from "./workout-types";
export * from "./post-media";
export * from "./story-engagement";
export * from "./workout-story";
