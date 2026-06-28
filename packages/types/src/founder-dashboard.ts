export type StaffRole =
  | "owner"
  | "founder"
  | "admin"
  | "moderator"
  | "support"
  | "ambassador_manager"
  | "content_manager"
  | "analyst";

export type StaffCapability =
  | "capability_access_dashboard"
  | "capability_manage_staff"
  | "capability_manage_flags"
  | "capability_manage_roadmap"
  | "capability_manage_releases"
  | "capability_manage_ambassadors"
  | "capability_moderate"
  | "capability_support"
  | "capability_view_executive"
  | "capability_view_community"
  | "capability_view_platform"
  | "capability_view_analytics"
  | "capability_view_activity"
  | "capability_view_inbox"
  | "capability_view_audit"
  | "capability_assign_owner";

/** Standard list query params — every dashboard table/widget uses this shape. */
export type FounderListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  filters?: Record<string, string | string[] | undefined>;
};

export type FounderPaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export type FounderExportFormat = "csv" | "json";

export type FounderWidgetRefreshMode = "poll" | "realtime" | "manual";

export type FounderDatePreset = "15m" | "today" | "week" | "month" | "custom";

export type ActivityCategory =
  | "user"
  | "messaging"
  | "stories"
  | "posts"
  | "events"
  | "challenges"
  | "matches"
  | "notifications"
  | "deployments"
  | "errors"
  | "security"
  | "growth"
  | "health"
  | "community"
  | "system"
  | "all";

export type ExecutiveKpi = {
  key: string;
  label: string;
  emoji: string;
  value: number | string | null;
  placeholder?: boolean;
  drillDown?: string;
};

export type ExecutiveDashboard = {
  environment: string;
  date: string;
  computed_at: string;
  release: { version: string; commit: string; deployed_at: string } | null;
  kpis: ExecutiveKpi[];
};

export type FounderActivityEvent = {
  id: string;
  kind: string;
  category: ActivityCategory;
  title: string;
  summary: string | null;
  severity: string;
  actor_user_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  environment: string;
  created_at: string;
};

export type AnalyticsDomain = {
  domain_key: string;
  display_name: string;
  category: string;
  status: "active" | "placeholder" | "deprecated";
  milestone_code: string | null;
  drill_down_path: string | null;
  description: string | null;
  sort_order: number;
};

export const ACTIVITY_CATEGORY_FILTERS: Array<{ key: ActivityCategory; label: string }> = [
  { key: "all", label: "All" },
  { key: "user", label: "Users" },
  { key: "messaging", label: "Messaging" },
  { key: "stories", label: "Stories" },
  { key: "posts", label: "Posts" },
  { key: "events", label: "Events" },
  { key: "challenges", label: "Challenges" },
  { key: "matches", label: "Matches" },
  { key: "notifications", label: "Notifications" },
  { key: "deployments", label: "Deployments" },
  { key: "errors", label: "Errors" },
  { key: "security", label: "Security" },
  { key: "growth", label: "Growth" },
  { key: "health", label: "Health" },
];

export const FOUNDER_DATE_PRESETS: Array<{ key: FounderDatePreset; label: string }> = [
  { key: "15m", label: "15 min" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
];

export const ACTIVITY_KIND_EMOJI: Record<string, string> = {
  user_signed_up: "🟢",
  message_sent: "💬",
  workout_posted: "🏋️",
  story_uploaded: "📸",
  training_match: "🤝",
  event_created: "📅",
  challenge_joined: "🏆",
  post_liked: "❤️",
  reaction_added: "🔥",
  comment_added: "💬",
  notification_sent: "🔔",
  deployment_completed: "🚀",
  deployment_failed: "🚨",
  error_detected: "⚠️",
  crash_reported: "🚨",
  health_supabase: "🟢",
  health_messaging: "🟢",
  health_notifications: "🟢",
  health_database: "🟢",
  health_app: "🟢",
  milestone_reached: "🎉",
  referral_converted: "📈",
};

export type FounderNavItem = {
  key: string;
  label: string;
  href: string;
  icon: string;
  capability?: StaffCapability;
  milestone?: string;
};

export const FOUNDER_NAV_ITEMS: FounderNavItem[] = [
  { key: "overview", label: "Overview", href: "/founder", icon: "◆", capability: "capability_view_executive" },
  { key: "community", label: "Community Health", href: "/founder/community", icon: "◎", capability: "capability_view_community" },
  { key: "platform", label: "Platform Health", href: "/founder/platform", icon: "⬡", capability: "capability_view_platform" },
  { key: "analytics", label: "User Analytics", href: "/founder/analytics/users", icon: "▤", capability: "capability_view_analytics", milestone: "M7.7" },
  { key: "activity", label: "Live Activity", href: "/founder/activity", icon: "●", capability: "capability_view_activity" },
  { key: "moderation", label: "Moderation", href: "/founder/moderation", icon: "⚑", capability: "capability_moderate", milestone: "M7.6" },
  { key: "ambassadors", label: "Ambassadors", href: "/founder/ambassadors", icon: "★", capability: "capability_manage_ambassadors", milestone: "M7.7" },
  { key: "flags", label: "Feature Flags", href: "/founder/flags", icon: "⛿", capability: "capability_manage_flags", milestone: "M7.5" },
  { key: "releases", label: "Releases", href: "/founder/releases", icon: "🚀", capability: "capability_manage_releases", milestone: "M7.4" },
  { key: "roadmap", label: "Roadmap", href: "/founder/roadmap", icon: "▥", capability: "capability_manage_roadmap", milestone: "M7.4" },
  { key: "support", label: "Beta Feedback", href: "/founder/support", icon: "?", capability: "capability_support" },
  { key: "notifications", label: "Notifications", href: "/founder/notifications", icon: "🔔", milestone: "M7.6" },
  { key: "inbox", label: "Inbox", href: "/founder/inbox", icon: "📥", capability: "capability_view_inbox", milestone: "M7.8" },
  { key: "admin", label: "Admin", href: "/founder/admin", icon: "⚙", capability: "capability_manage_staff" },
];

export const STAFF_ROLE_OPTIONS: Array<{ value: StaffRole; label: string; description: string }> = [
  { value: "owner", label: "Owner", description: "Full platform control including owner assignment" },
  { value: "founder", label: "Founder", description: "Full operations access except owner assignment" },
  { value: "admin", label: "Admin", description: "Roadmap, releases, ambassadors, and all dashboards" },
  { value: "moderator", label: "Moderator", description: "Moderation tools and community activity" },
  { value: "support", label: "Support", description: "Support queue and community activity" },
  { value: "ambassador_manager", label: "Ambassador Manager", description: "Ambassador program and community metrics" },
  { value: "content_manager", label: "Content Manager", description: "Content moderation and community analytics" },
  { value: "analyst", label: "Analyst", description: "Read-only access to all analytics dashboards" },
];

export type CommunityHealthSummary = {
  dau: number;
  wau: number;
  mau: number;
  new_signups: number;
  retention_d1: number | null;
  retention_d7: number | null;
  retention_d30: number | null;
  workout_posts: number;
  stories: number;
  messages: number;
  events: number;
  challenges: number;
  matches: number;
  comments: number;
  reactions: number;
  referral_growth: number;
  ambassador_activity: number;
};

export type CommunityHealthSeriesPoint = CommunityHealthSummary & {
  date: string;
};

export type CommunityHealthDashboard = {
  environment: string;
  period_days: number;
  computed_at: string;
  summary: CommunityHealthSummary;
  series: CommunityHealthSeriesPoint[];
};

export type MatchmakingAnalyticsSummary = {
  new_matches: number;
  connects: number;
  skips: number;
  mutual_conversion_rate: number | null;
  active_matchers: number;
  discovery_enabled: number;
  matches_today: number;
  deck_loads: number;
  deck_empty: number;
  avg_deck_load_ms: number | null;
  feature_flag_enabled: boolean;
  unmatched_total: number;
};

export type MatchmakingAnalyticsSeriesPoint = {
  date: string;
  matches: number;
  connects: number;
  skips: number;
  active_matchers: number;
  deck_loads: number;
  deck_empty: number;
};

export type MatchmakingAnalyticsDashboard = {
  environment: string;
  period_days: number;
  computed_at: string;
  summary: MatchmakingAnalyticsSummary;
  series: MatchmakingAnalyticsSeriesPoint[];
};

export type BetaFeedbackBugReport = {
  bug_area: string;
  bug_summary: string;
  report_count: number;
};

export type BetaFeedbackFilterOptions = {
  platforms: string[];
  app_versions: string[];
  release_versions: string[];
  feature_areas: string[];
  milestone_codes: string[];
};

export type BetaFeedbackUpdateInput = {
  status?: "new" | "in_progress" | "fixed" | "released" | "closed";
  priority?: "critical" | "high" | "medium" | "low";
  milestoneCode?: string | null;
  releaseVersion?: string | null;
  githubIssueUrl?: string | null;
  githubCommitSha?: string | null;
  notifyTester?: boolean;
};

export type BetaFeedbackDashboardSummary = {
  total_feedback: number;
  awaiting_review: number;
  bug_reports: number;
  feature_requests: number;
  crash_reports: number;
  avg_satisfaction_rating: number | null;
  daily_active_testers: number;
  weekly_active_testers: number;
  match_success_rate: number | null;
  conversation_start_rate: number | null;
  messages_after_match: number;
  retention_d1: number | null;
  retention_d7: number | null;
  retention_d30: number | null;
  avg_session_length_ms: number | null;
  total_matches: number;
  matches_with_conversation: number;
};

export type BetaFeedbackFeatureRequest = {
  feature_label: string;
  request_count: number;
};

export type BetaFeedbackExitScreen = {
  screen: string;
  exit_count: number;
  avg_duration_ms: number | null;
};

export type BetaFeedbackTesterDevice = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  app_version: string | null;
  platform: string | null;
  os_version: string | null;
  browser: string | null;
  build_number: string | null;
  last_seen: string;
};

export type BetaFeedbackDashboard = {
  period_days: number;
  computed_at: string;
  summary: BetaFeedbackDashboardSummary;
  top_feature_requests: BetaFeedbackFeatureRequest[];
  top_bugs: BetaFeedbackBugReport[];
  exit_screens: BetaFeedbackExitScreen[];
  tester_devices: BetaFeedbackTesterDevice[];
};

export type BetaFeedbackListParams = {
  page?: number;
  pageSize?: number;
  type?: "bug" | "feature" | "general" | "rating" | "crash" | null;
  status?: "new" | "in_progress" | "fixed" | "released" | "closed" | null;
  priority?: "critical" | "high" | "medium" | "low" | null;
  platform?: string | null;
  appVersion?: string | null;
  releaseVersion?: string | null;
  featureArea?: string | null;
  milestoneCode?: string | null;
  userId?: string | null;
  search?: string | null;
};

export type PlatformSubsystemHealth = {
  key: string;
  label: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  latency_ms: number | null;
  error_rate: number | null;
  details: Record<string, unknown>;
  placeholder?: boolean;
  recorded_at: string;
};

export type PlatformHealthDashboard = {
  environment: string;
  computed_at: string;
  overall_status: "healthy" | "degraded" | "down" | "unknown";
  subsystems: PlatformSubsystemHealth[];
};

export type StaffMember = {
  user_id: string;
  role: StaffRole;
  granted_at: string;
  granted_by: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type StaffInvite = {
  id: string;
  email: string;
  role: StaffRole;
  expires_at: string;
  created_at: string;
  invited_by: string;
};

export type FounderAuditEntry = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  created_at: string;
  actor_username: string | null;
  actor_display_name: string | null;
};

export type PlatformBootstrapStatus = {
  bootstrap_configured: boolean;
  claimed: boolean;
  has_owner: boolean;
  needs_bootstrap: boolean;
};

export type HealthMetric = {
  key: string;
  label: string;
  emoji: string;
  value: number | string | null;
  suffix?: string;
  placeholder?: boolean;
};

export type StaffAccess = {
  role: StaffRole | null;
  isStaff: boolean;
  canAccessDashboard: boolean;
};
