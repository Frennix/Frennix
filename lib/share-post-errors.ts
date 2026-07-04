import { getUserFriendlyErrorMessage } from "@frennix/api";

export const WORKOUT_SHARING_UNAVAILABLE_MESSAGE =
  "We're currently improving workout sharing. Please try again in a few minutes.";

export const POST_SHARE_FALLBACK_MESSAGE =
  "We couldn't share your post right now. Please try again in a few minutes.";

/** User-safe copy for workout/photo/video share failures — never expose SQL or Supabase codes. */
export function getSharePostUserMessage(error: unknown): string {
  return getUserFriendlyErrorMessage(error, WORKOUT_SHARING_UNAVAILABLE_MESSAGE);
}
