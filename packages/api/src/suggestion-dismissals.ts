import { getSupabase } from "./supabase";

export async function getDismissedSuggestionIds(viewerId: string): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from("suggestion_dismissals")
    .select("dismissed_id")
    .eq("viewer_id", viewerId);
  if (error) throw error;
  return (data ?? []).map((row) => row.dismissed_id as string);
}

export async function dismissSuggestion(viewerId: string, dismissedId: string): Promise<void> {
  if (viewerId === dismissedId) return;
  const { error } = await getSupabase()
    .from("suggestion_dismissals")
    .upsert(
      { viewer_id: viewerId, dismissed_id: dismissedId, dismissed_at: new Date().toISOString() },
      { onConflict: "viewer_id,dismissed_id", ignoreDuplicates: false }
    );
  if (error) throw error;
}

export async function undoDismissSuggestion(viewerId: string, dismissedId: string): Promise<void> {
  const { error } = await getSupabase()
    .from("suggestion_dismissals")
    .delete()
    .eq("viewer_id", viewerId)
    .eq("dismissed_id", dismissedId);
  if (error) throw error;
}
