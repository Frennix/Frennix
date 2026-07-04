/**
 * Public release notes for the in-app What's New page.
 *
 * Update on every release:
 * 1. Prepend a new entry to WHATS_NEW_RELEASES (newest first).
 * 2. Set WHATS_NEW_LATEST_VERSION to the new semver tag.
 * 3. Refresh WHATS_NEW_COMING_SOON from the product roadmap.
 * 4. Update WHATS_NEW_KNOWN_ISSUES for active feature status.
 *    Engineering metadata (Severity, Priority, Version Found/Fixed, Milestone) lives in
 *    features/releases/RELEASE.md — see BUG-SEVERITY.md. User-facing copy only here.
 * 5. Set WHATS_NEW_LAUNCH_PROMPT_VERSION for major updates (null for patch-only).
 * 6. Update CHANGELOG.md to match.
 *
 * Verify: `npm run verify:whats-new`
 */

export const WHATS_NEW_LATEST_VERSION = "v1.0.2";

/** Set when a major update should prompt users once on next app open. Clear for patch-only releases. */
export const WHATS_NEW_LAUNCH_PROMPT_VERSION: string | null = null;

export type WhatsNewKnownIssueStatus =
  | "under_maintenance"
  | "coming_soon"
  | "temporary_issue";

export type WhatsNewKnownIssue = {
  feature: string;
  status: WhatsNewKnownIssueStatus;
  explanation: string;
  expectedFixVersion?: string;
};

/** Active platform known issues — shown prominently on What's New. */
export const WHATS_NEW_KNOWN_ISSUES: WhatsNewKnownIssue[] = [
  {
    feature: "Story Replies",
    status: "coming_soon",
    explanation: "Reply directly to a friend's story from the viewer — launching soon.",
  },
  {
    feature: "Events RSVP",
    status: "temporary_issue",
    explanation:
      "RSVP confirmations may not update immediately on Community Events. Your RSVP is still saved.",
    expectedFixVersion: "v1.0.2",
  },
  {
    feature: "Training Together Today",
    status: "coming_soon",
    explanation: "See which partners are training today from your Calendar dashboard.",
    expectedFixVersion: "v1.1",
  },
];

export type WhatsNewRelease = {
  version: string;
  date: string;
  title: string;
  summary: string;
  features: string[];
  fixes: string[];
  performance: string[];
  knownIssues: string[];
};

/** Platform-wide Coming Soon items (roadmap highlights — user-facing copy). */
export const WHATS_NEW_COMING_SOON: string[] = [
  "Training Together Today — see which partners are training today",
  "Need a Training Partner Today — find athletes looking for a workout buddy",
  "Smart Partner Recommendations — best-fit training partners for your schedule",
  "Fitness Circles — small groups with shared calendars and challenges",
  "Fitness Seasons — community-wide 30/60/90-day programs",
  "Frennix Journey — your personal fitness story and annual recap",
];

export const WHATS_NEW_RELEASES: WhatsNewRelease[] = [
  {
    version: "v1.0.2",
    date: "2026-07-04",
    title: "Workout Sharing Fix",
    summary:
      "Sharing workouts, photos, and videos to your feed works again. Errors during sharing now show a friendly message instead of technical details.",
    features: [],
    fixes: [
      "Workout, photo, and video posts create successfully again",
      "Friendly message when sharing is temporarily unavailable (no raw database errors)",
    ],
    performance: [],
    knownIssues: [
      "Events RSVP confirmations may not update immediately — your RSVP is still saved",
    ],
  },
  {
    version: "v1.0.1",
    date: "2026-07-04",
    title: "Training Calendar",
    summary:
      "Your Calendar tab is now a daily fitness dashboard — schedule workouts, track streaks, and see what's next.",
    features: [
      "Training Calendar replaces Events with month and week views",
      "Today's Focus — daily dashboard with workout, streak, and weekly progress",
      "Start Workout button routes to today's session or workout log",
      "Create, edit, complete, and reschedule training sessions",
      "Workout invites from Messages and Stories open your calendar",
      "Community Events browse — separate from your personal schedule",
      "Sticky month/week controls and scroll-linked add button on mobile",
      "Dedicated workout stories with polls, questions, and highlights",
      "Lifestyle matching filters on Discover",
    ],
    fixes: [
      "iPhone Safari post-login layout — no more black screen after sign-in",
      "Calendar horizontal overflow on small screens",
      "Post-login crashes from missing imports and story viewer state",
      "Responsive calendar layout for mobile and desktop",
    ],
    performance: [
      "Faster tab switching with mounted tab shell",
      "Improved web scroll shell for Safari",
      "Calendar view prefetch when opening the Calendar tab",
    ],
    knownIssues: [
      "Training Together Today partner rail is coming in a future update (UI ready, data next)",
      "We're in a 48-hour stability window — report issues via Beta Feedback",
    ],
  },
  {
    version: "v0.8.0",
    date: "2026-06-28",
    title: "Messaging Stability",
    summary: "Reliable Messages with safer realtime connections and clearer error handling.",
    features: [
      "Unique realtime channel topics per conversation view",
      "Graceful reconnect banners when live updates are unavailable",
    ],
    fixes: [
      "Messages crash for users with a single conversation",
      "Duplicate realtime subscriptions across inbox and open chat",
      "Presence subscription errors crashing the Messages tab",
      "Message history reliability when realtime is unavailable",
      "Logout cleanup for messaging realtime state",
    ],
    performance: [],
    knownIssues: [],
  },
];
