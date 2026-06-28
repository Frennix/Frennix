import type {
  BetaFeedback,
  BetaFeedbackDashboard,
  BetaFeedbackFilterOptions,
  BetaFeedbackListParams,
  BetaFeedbackUpdateInput,
  FounderPaginatedResult,
} from "@frennix/types";
import { formatSupabaseError, normalizeImageExt, readImageBytes } from "../profile-utils";
import { getSupabase } from "../supabase";

export async function getBetaFeedbackDashboard(days = 30): Promise<BetaFeedbackDashboard> {
  const { data, error } = await getSupabase().rpc("get_beta_feedback_dashboard", {
    p_days: days,
  });
  if (error) throw formatSupabaseError(error, "Failed to load beta feedback dashboard");
  return data as BetaFeedbackDashboard;
}

export async function listBetaFeedback(
  params: BetaFeedbackListParams = {}
): Promise<FounderPaginatedResult<BetaFeedback>> {
  const { data, error } = await getSupabase().rpc("list_beta_feedback", {
    p_page: params.page ?? 1,
    p_page_size: params.pageSize ?? 25,
    p_type: params.type ?? null,
    p_status: params.status ?? null,
    p_priority: params.priority ?? null,
    p_platform: params.platform ?? null,
    p_app_version: params.appVersion ?? null,
    p_release_version: params.releaseVersion ?? null,
    p_feature_area: params.featureArea ?? null,
    p_milestone_code: params.milestoneCode ?? null,
    p_user_id: params.userId ?? null,
    p_search: params.search ?? null,
  });
  if (error) throw formatSupabaseError(error, "Failed to load beta feedback");
  const result = data as FounderPaginatedResult<BetaFeedback>;
  return {
    ...result,
    items: (result.items ?? []).map((item) => ({
      ...item,
      user: item.user ?? (item.username
        ? {
            id: item.user_id,
            username: item.username,
            display_name: item.display_name ?? item.username,
            avatar_url: item.avatar_url ?? null,
          }
        : undefined),
    })),
  };
}

export async function updateBetaFeedback(
  feedbackId: string,
  updates: BetaFeedbackUpdateInput
): Promise<BetaFeedback> {
  const { data, error } = await getSupabase().rpc("update_beta_feedback", {
    p_feedback_id: feedbackId,
    p_status: updates.status ?? null,
    p_priority: updates.priority ?? null,
    p_milestone_code: updates.milestoneCode ?? null,
    p_release_version: updates.releaseVersion ?? null,
    p_github_issue_url: updates.githubIssueUrl ?? null,
    p_github_commit_sha: updates.githubCommitSha ?? null,
    p_notify_tester: updates.notifyTester ?? null,
  });
  if (error) throw formatSupabaseError(error, "Failed to update feedback");
  return data as BetaFeedback;
}

export async function getBetaFeedbackFilterOptions(): Promise<BetaFeedbackFilterOptions> {
  const { data, error } = await getSupabase().rpc("get_beta_feedback_filter_options");
  if (error) throw formatSupabaseError(error, "Failed to load filter options");
  return data as BetaFeedbackFilterOptions;
}

export async function uploadFeedbackScreenshot(
  userId: string,
  uri: string,
  mimeType: string,
  file?: File | null
): Promise<string> {
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
