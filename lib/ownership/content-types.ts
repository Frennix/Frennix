/**
 * Frennix ownership framework — content type registry.
 *
 * Every user-created content type MUST implement:
 * - lib/{entity}-actions.ts   — owner/viewer menu definitions
 * - lib/use{Entity}Actions.tsx — hook wiring EntityActionSheet + handlers
 * - lib/{entity}-link.ts      — deep link builders (when shareable)
 * - Route guard on edit screens (owner field check → redirect)
 * - API mutations guarded by owner field + Supabase RLS
 *
 * Standard owner menu: Edit, Delete, Share, Copy Link (+ View Participants/Analytics where applicable)
 * Standard viewer menu: Share, Copy Link, Report, Block
 */

export type OwnershipContentType =
  | "post"
  | "workout_log"
  | "run_club_post"
  | "challenge"
  | "event"
  | "group"
  | "comment"
  | "profile"
  | "recipe"
  | "marketplace_listing";

export interface OwnershipContentDefinition {
  type: OwnershipContentType;
  ownerField: string;
  status: "live" | "via_post" | "deferred";
  registry?: string;
  hook?: string;
  link?: string;
  notes?: string;
}

/** Registry of all content types — update when adding new features. */
export const OWNERSHIP_CONTENT_REGISTRY: OwnershipContentDefinition[] = [
  {
    type: "post",
    ownerField: "author_id",
    status: "live",
    registry: "lib/post-actions.ts",
    hook: "lib/usePostActions.tsx",
    link: "lib/post-link.ts",
  },
  {
    type: "workout_log",
    ownerField: "author_id",
    status: "via_post",
    notes: "Workout logs are posts with post_type workout_update; use post ownership.",
  },
  {
    type: "run_club_post",
    ownerField: "author_id",
    status: "via_post",
    notes: "Run club posts are posts with group_id; post ownership + group entity ownership.",
  },
  {
    type: "challenge",
    ownerField: "created_by",
    status: "live",
    registry: "lib/challenge-actions.ts",
    hook: "lib/useChallengeActions.tsx",
    link: "lib/challenge-link.ts",
  },
  {
    type: "event",
    ownerField: "created_by",
    status: "live",
    registry: "lib/event-actions.ts",
    hook: "lib/useEventActions.tsx",
    link: "lib/event-link.ts",
  },
  {
    type: "group",
    ownerField: "owner_id",
    status: "live",
    registry: "lib/group-actions.ts",
    hook: "lib/useGroupActions.tsx",
    link: "lib/group-link.ts",
  },
  {
    type: "comment",
    ownerField: "author_id",
    status: "live",
    registry: "lib/comment-actions.ts",
    hook: "lib/useCommentActions.tsx",
    link: "lib/comment-link.ts",
  },
  {
    type: "profile",
    ownerField: "id",
    status: "live",
    registry: "lib/profile-actions.ts",
    hook: "lib/useProfileActions.tsx",
    link: "lib/profile-link.ts",
    notes: "Profiles are not deletable via app; owner menu excludes Delete.",
  },
  {
    type: "recipe",
    ownerField: "author_id",
    status: "deferred",
    notes: "Not yet implemented — use this registry pattern when building recipes.",
  },
  {
    type: "marketplace_listing",
    ownerField: "seller_id",
    status: "deferred",
    notes: "Marketplace deferred — see features/marketplace/README.md.",
  },
];
