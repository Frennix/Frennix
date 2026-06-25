import type { BetaFeedback, FeedbackFeatureArea, FeedbackStatus, FeedbackType } from "@frennix/types";
import { formatSupabaseError } from "./profile-utils";
import { getSupabase } from "./supabase";
import { trackProductEvent } from "./analytics";

export async function submitFeedback(input: {
  user_id: string;
  type: FeedbackType;
  message?: string;
  rating?: number;
  feature_area?: FeedbackFeatureArea | null;
  screen_path?: string | null;
  app_version?: string | null;
  platform?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const row: Record<string, unknown> = {
    user_id: input.user_id,
    type: input.type,
    status: "open",
    feature_area: input.feature_area ?? "general",
    screen_path: input.screen_path ?? null,
    app_version: input.app_version ?? null,
    platform: input.platform ?? null,
    metadata: input.metadata ?? {},
  };

  if (input.type === "rating") {
    if (!input.rating || input.rating < 1 || input.rating > 5) {
      throw new Error("Please select a rating from 1 to 5 stars");
    }
    row.rating = input.rating;
    row.message = input.message?.trim() || null;
  } else {
    const message = input.message?.trim();
    if (!message) throw new Error("Please describe your feedback");
    row.message = message;
    row.rating = null;
  }

  const { error } = await getSupabase().from("beta_feedback").insert(row);
  if (error) throw formatSupabaseError(error, "Failed to submit feedback");

  void trackProductEvent(
    "feedback_submitted",
    {
      type: input.type,
      feature_area: input.feature_area ?? "general",
    },
    { appVersion: input.app_version ?? undefined, platform: input.platform ?? undefined }
  );
}

export async function getAdminFeedback(
  filter: FeedbackType | "all" = "all",
  status: FeedbackStatus | "all" = "open",
  featureArea: FeedbackFeatureArea | "all" = "all"
) {
  let q = getSupabase()
    .from("beta_feedback")
    .select(`*, user:profiles!beta_feedback_user_id_fkey(*)`)
    .order("created_at", { ascending: false })
    .limit(100);

  if (filter !== "all") {
    q = q.eq("type", filter);
  }
  if (status !== "all") {
    q = q.eq("status", status);
  }
  if (featureArea !== "all") {
    q = q.eq("feature_area", featureArea);
  }

  const { data, error } = await q;
  if (error) throw formatSupabaseError(error, "Failed to load feedback");
  return (data ?? []) as BetaFeedback[];
}

export async function resolveFeedback(feedbackId: string, adminId: string) {
  const { error } = await getSupabase()
    .from("beta_feedback")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: adminId,
    })
    .eq("id", feedbackId);

  if (error) throw formatSupabaseError(error, "Failed to resolve feedback");
}

export async function reopenFeedback(feedbackId: string) {
  const { error } = await getSupabase()
    .from("beta_feedback")
    .update({
      status: "open",
      resolved_at: null,
      resolved_by: null,
    })
    .eq("id", feedbackId);

  if (error) throw formatSupabaseError(error, "Failed to reopen feedback");
}
