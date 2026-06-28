import { formatSupabaseError, normalizeImageExt, readImageBytes } from "./profile-utils";
import { getSupabase } from "./supabase";
import { trackProductEvent } from "./analytics";

export async function uploadFeedbackScreenshot(
  userId: string,
  uri: string,
  mimeType: string,
  file?: File | null
) {
  const ext = normalizeImageExt(mimeType);
  const path = `${userId}/${Date.now()}.${ext}`;
  const bytes = await readImageBytes(uri, file);
  const contentType = mimeType.startsWith("image/") ? mimeType : "image/jpeg";

  const { error: uploadError } = await getSupabase().storage
    .from("feedback-attachments")
    .upload(path, bytes, { contentType, upsert: false });

  if (uploadError) {
    throw formatSupabaseError(uploadError, "Screenshot upload failed");
  }

  const { data: urlData } = getSupabase().storage.from("feedback-attachments").getPublicUrl(path);
  if (!urlData.publicUrl) {
    throw new Error("Screenshot uploaded but public URL was not returned");
  }

  return urlData.publicUrl;
}

export async function submitFeedback(input: {
  user_id: string;
  type: import("@frennix/types").FeedbackType;
  message?: string;
  rating?: number;
  feature_area?: import("@frennix/types").FeedbackFeatureArea | null;
  screen_path?: string | null;
  app_version?: string | null;
  platform?: string | null;
  os_version?: string | null;
  browser?: string | null;
  build_number?: string | null;
  screenshot_url?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const row: Record<string, unknown> = {
    user_id: input.user_id,
    type: input.type,
    status: "new",
    priority: "medium",
    feature_area: input.feature_area ?? "general",
    screen_path: input.screen_path ?? null,
    app_version: input.app_version ?? null,
    platform: input.platform ?? null,
    os_version: input.os_version ?? null,
    browser: input.browser ?? null,
    build_number: input.build_number ?? null,
    screenshot_url: input.screenshot_url ?? null,
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
    { type: input.type, feature_area: input.feature_area ?? "general" },
    { appVersion: input.app_version ?? undefined, platform: input.platform ?? undefined }
  );
}

export async function getAdminFeedback(
  filter: import("@frennix/types").FeedbackType | "all" = "all",
  status: import("@frennix/types").FeedbackStatus | "all" = "new",
  featureArea: import("@frennix/types").FeedbackFeatureArea | "all" = "all"
) {
  let q = getSupabase()
    .from("beta_feedback")
    .select(`*, user:profiles!beta_feedback_user_id_fkey(*)`)
    .order("created_at", { ascending: false })
    .limit(100);

  if (filter !== "all") q = q.eq("type", filter);
  if (status !== "all") q = q.eq("status", status);
  if (featureArea !== "all") q = q.eq("feature_area", featureArea);

  const { data, error } = await q;
  if (error) throw formatSupabaseError(error, "Failed to load feedback");
  return (data ?? []) as import("@frennix/types").BetaFeedback[];
}

export async function resolveFeedback(feedbackId: string, adminId: string) {
  const { error } = await getSupabase()
    .from("beta_feedback")
    .update({
      status: "closed",
      resolved_at: new Date().toISOString(),
      resolved_by: adminId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", feedbackId);

  if (error) throw formatSupabaseError(error, "Failed to resolve feedback");
}

export async function reopenFeedback(feedbackId: string) {
  const { error } = await getSupabase()
    .from("beta_feedback")
    .update({
      status: "new",
      resolved_at: null,
      resolved_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", feedbackId);

  if (error) throw formatSupabaseError(error, "Failed to reopen feedback");
}
