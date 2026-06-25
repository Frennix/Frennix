export const PRODUCT_EVENT_NAMES = [
  "user_signed_up",
  "daily_active_user",
  "training_partner_match",
  "trainer_connection_requested",
  "trainer_connection_accepted",
  "message_sent",
  "event_joined",
  "perf_screen_load",
  "perf_feed_load",
  "perf_messaging_load",
  "feedback_submitted",
] as const;

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number];

export interface ProductAnalyticsSummary {
  days: number;
  since: string;
  signups: number;
  daily_active_users: { date: string; count: number }[];
  daily_active_users_total: number;
  training_partner_matches: number;
  trainer_connection_requests: number;
  trainer_connections_accepted: number;
  messages_sent: number;
  events_joined: number;
  perf_events: { event_name: string; count: number; avg_ms: number | null }[];
}
