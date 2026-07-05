import type { ReactNode } from "react";

/**
 * Canonical feed content kinds — extend this union when adding new post types.
 * Composers map API `post_type` + metadata into a `FeedContentKind` for slot selection.
 */
export type FeedContentKind =
  | "workout_photo"
  | "workout_video"
  | "progress_update"
  | "transformation"
  | "challenge"
  | "event"
  | "nutrition"
  | "recipe"
  | "coach"
  | "achievement"
  | "race_result"
  | "story"
  | "text"
  | "shared"
  | "advertisement"
  | "sponsored";

/** Monetization / distribution overlays — independent of content kind. */
export type FeedMonetizationKind =
  | "none"
  | "sponsored"
  | "promoted_challenge"
  | "featured_creator"
  | "premium_gated"
  | "affiliate"
  | "advertisement";

/**
 * Optional injection points for feed posts.
 * Pass only the slots a post type needs — omit the rest.
 *
 * Used by: sponsored posts, promoted challenges, coach content, premium gates,
 * affiliate products, verified badges, events, recipes, etc.
 */
export type FeedPostLayoutSlots = {
  /** Above header — e.g. "Sponsored", "Promoted challenge". */
  label?: ReactNode;
  /** Header row trailing — e.g. verified badge, premium lock, ⋯ overflow. */
  headerTrailing?: ReactNode;
  /** Absolute overlay on media — e.g. premium blur CTA, play badge. */
  mediaOverlay?: ReactNode;
  /** Below media, above actions — e.g. event RSVP strip, story deep-link. */
  belowMedia?: ReactNode;
  /** Below caption — e.g. affiliate product carousel, nutrition macros. */
  commerce?: ReactNode;
  /** Below comments — e.g. ad disclaimer, legal copy. */
  footer?: ReactNode;
};

/** Documented slot order — compositors must follow this sequence. */
export const FEED_LAYOUT_SLOT_ORDER = [
  "label",
  "header",
  "media",
  "belowMedia",
  "actions",
  "caption",
  "commerce",
  "engagement",
  "comments",
  "footer",
] as const;

export type FeedLayoutSlotName = (typeof FEED_LAYOUT_SLOT_ORDER)[number];

/** Maps future monetization kinds to recommended slot(s). Implementation deferred. */
export const FEED_MONETIZATION_SLOT_HINTS: Record<
  FeedMonetizationKind,
  FeedLayoutSlotName[]
> = {
  none: [],
  sponsored: ["label", "footer"],
  promoted_challenge: ["label", "belowMedia"],
  featured_creator: ["headerTrailing", "label"],
  premium_gated: ["headerTrailing", "mediaOverlay"],
  affiliate: ["commerce"],
  advertisement: ["label", "mediaOverlay", "footer"],
};

/** Maps future content kinds to primary media/header strategy. Implementation deferred. */
export const FEED_CONTENT_KIND_DEFAULTS: Record<
  FeedContentKind,
  { usesFeedMedia: boolean; embeddedMedia: boolean }
> = {
  workout_photo: { usesFeedMedia: true, embeddedMedia: false },
  workout_video: { usesFeedMedia: true, embeddedMedia: false },
  progress_update: { usesFeedMedia: true, embeddedMedia: false },
  transformation: { usesFeedMedia: true, embeddedMedia: false },
  challenge: { usesFeedMedia: true, embeddedMedia: false },
  event: { usesFeedMedia: true, embeddedMedia: false },
  nutrition: { usesFeedMedia: true, embeddedMedia: false },
  recipe: { usesFeedMedia: true, embeddedMedia: false },
  coach: { usesFeedMedia: true, embeddedMedia: false },
  achievement: { usesFeedMedia: true, embeddedMedia: false },
  race_result: { usesFeedMedia: true, embeddedMedia: false },
  story: { usesFeedMedia: true, embeddedMedia: false },
  text: { usesFeedMedia: false, embeddedMedia: false },
  shared: { usesFeedMedia: true, embeddedMedia: true },
  advertisement: { usesFeedMedia: true, embeddedMedia: false },
  sponsored: { usesFeedMedia: true, embeddedMedia: false },
};
