import { Sentry } from "@/lib/sentry";

export type MatchmakingObservabilityDomain =
  | "match_swipe"
  | "match_list"
  | "match_remove"
  | "match_candidates"
  | "presence"
  | "push_registration";

export function logMatchmakingError(
  domain: MatchmakingObservabilityDomain,
  error: unknown,
  extra?: Record<string, unknown>
) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[matchmaking:${domain}]`, message, extra ?? {});

  try {
    Sentry.captureException(error instanceof Error ? error : new Error(message), {
      tags: { matchmaking_domain: domain },
      extra: { domain, ...extra },
    });
  } catch {
    // Sentry may be unavailable in some environments.
  }
}
