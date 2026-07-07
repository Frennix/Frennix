import { MESSAGE_GROUPING_WINDOW_MS } from "./catalog";

/** Returns true when a push should be suppressed in favor of an in-window group. */
export function shouldSuppressMessagePush(input: {
  lastPushSentAt: string | null;
  windowMs?: number;
}): boolean {
  if (!input.lastPushSentAt) return false;
  const windowMs = input.windowMs ?? MESSAGE_GROUPING_WINDOW_MS;
  const elapsed = Date.now() - new Date(input.lastPushSentAt).getTime();
  return elapsed >= 0 && elapsed < windowMs;
}
