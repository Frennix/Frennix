import { getSupabaseErrorDetails, getTechnicalErrorMessage } from "./profile-utils";
import { getSupabase } from "./supabase";

const TABLE = "suggestion_dismissals";

function logDismissalError(scope: string, error: unknown, context?: Record<string, unknown>) {
  const details = getSupabaseErrorDetails(error);
  console.error(`[suggestion-dismiss] ${scope}`, { ...context, ...details });
}

export async function getDismissedSuggestionIds(viewerId: string): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("dismissed_id")
    .eq("viewer_id", viewerId);
  if (error) {
    logDismissalError("getDismissedSuggestionIds", error, { viewerId });
    throw error;
  }
  return (data ?? []).map((row) => row.dismissed_id as string);
}

export async function dismissSuggestion(viewerId: string, dismissedId: string): Promise<void> {
  if (viewerId === dismissedId) return;

  const supabase = getSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) {
    logDismissalError("auth.getUser", authError, { viewerId, dismissedId });
    throw authError;
  }
  if (!user?.id) {
    const error = new Error("Not authenticated");
    logDismissalError("auth.missing", error, { viewerId, dismissedId });
    throw error;
  }
  if (user.id !== viewerId) {
    const error = new Error("Viewer mismatch for suggestion dismissal");
    logDismissalError("auth.viewerMismatch", error, {
      viewerId,
      dismissedId,
      authUserId: user.id,
    });
    throw error;
  }

  const payload = {
    viewer_id: user.id,
    dismissed_id: dismissedId,
    dismissed_at: new Date().toISOString(),
  };

  const { error } = await supabase.from(TABLE).insert(payload);
  if (error) {
    if (error.code === "23505") return;
    logDismissalError("insert", error, payload);
    throw error;
  }
}

export async function undoDismissSuggestion(viewerId: string, dismissedId: string): Promise<void> {
  const { error } = await getSupabase()
    .from(TABLE)
    .delete()
    .eq("viewer_id", viewerId)
    .eq("dismissed_id", dismissedId);
  if (error) {
    logDismissalError("delete", error, { viewerId, dismissedId });
    throw error;
  }
}

export function getSuggestionDismissErrorMessage(error: unknown): string {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    return getTechnicalErrorMessage(error);
  }
  return "Could not remove suggestion. Please try again.";
}
