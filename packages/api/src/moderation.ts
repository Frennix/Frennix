import type { Block, ModerationReport, Profile, ReportStatus } from "@frennix/types";
import { formatSupabaseError } from "./profile-utils";
import { getSupabase } from "./supabase";

export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) throw new Error("You cannot block yourself");
  const { error } = await getSupabase()
    .from("blocks")
    .insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) throw error;
}

export async function unblockUser(blockerId: string, blockedId: string) {
  const { error } = await getSupabase()
    .from("blocks")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId);
  if (error) throw error;
}

export async function isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from("blocks")
    .select("blocker_id")
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function getBlockedIds(userId: string): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", userId);
  if (error) throw error;
  return (data ?? []).map((b) => b.blocked_id);
}

export async function getBlockedUsers(userId: string): Promise<(Block & { profile?: Profile })[]> {
  const { data, error } = await getSupabase()
    .from("blocks")
    .select(`*, profile:profiles!blocks_blocked_id_fkey(*)`)
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const entry = row as Block & { profile: Profile | Profile[] | null };
    const profile = Array.isArray(entry.profile) ? entry.profile[0] : entry.profile;
    return { ...entry, profile: profile ?? undefined };
  });
}

export async function reportContent(input: {
  reporter_id: string;
  reported_user_id?: string;
  reported_post_id?: string;
  reported_comment_id?: string;
  reported_challenge_id?: string;
  reported_event_id?: string;
  reason: string;
}) {
  const { error } = await getSupabase().from("reports").insert({
    ...input,
    status: "pending",
  });
  if (error) throw formatSupabaseError(error, "Failed to submit report");
}

export async function reportPost(reporterId: string, postId: string, authorId: string, reason: string) {
  await reportContent({
    reporter_id: reporterId,
    reported_post_id: postId,
    reported_user_id: authorId,
    reason,
  });
}

export async function reportComment(
  reporterId: string,
  commentId: string,
  authorId: string,
  reason: string
) {
  await reportContent({
    reporter_id: reporterId,
    reported_comment_id: commentId,
    reported_user_id: authorId,
    reason,
  });
}

export async function reportUser(reporterId: string, reportedUserId: string, reason: string) {
  await reportContent({
    reporter_id: reporterId,
    reported_user_id: reportedUserId,
    reason,
  });
}

export async function reportChallenge(
  reporterId: string,
  challengeId: string,
  creatorId: string,
  reason: string
) {
  await reportContent({
    reporter_id: reporterId,
    reported_challenge_id: challengeId,
    reported_user_id: creatorId,
    reason,
  });
}

export async function reportEvent(
  reporterId: string,
  eventId: string,
  creatorId: string,
  reason: string
) {
  await reportContent({
    reporter_id: reporterId,
    reported_event_id: eventId,
    reported_user_id: creatorId,
    reason,
  });
}

export async function getModerationReports(
  status: ReportStatus = "pending"
): Promise<ModerationReport[]> {
  const { data, error } = await getSupabase()
    .from("reports")
    .select(
      `*,
      reporter:profiles!reports_reporter_id_fkey(*),
      reported_user:profiles!reports_reported_user_id_fkey(*)`
    )
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw formatSupabaseError(error, "Failed to load reports");
  return (data ?? []) as ModerationReport[];
}

export async function updateReportStatus(
  reportId: string,
  adminId: string,
  status: ReportStatus,
  adminNotes?: string
) {
  const { error } = await getSupabase()
    .from("reports")
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
      admin_notes: adminNotes ?? null,
    })
    .eq("id", reportId);

  if (error) throw formatSupabaseError(error, "Failed to update report");
}

export async function adminDeletePost(postId: string) {
  const { error } = await getSupabase().from("posts").delete().eq("id", postId);
  if (error) throw formatSupabaseError(error, "Failed to remove post");
}

export async function adminDeleteComment(commentId: string) {
  const { error } = await getSupabase().from("comments").delete().eq("id", commentId);
  if (error) throw formatSupabaseError(error, "Failed to remove comment");
}

export async function adminBanUser(userId: string) {
  const { error } = await getSupabase()
    .from("profiles")
    .update({ is_banned: true, visibility: "private" })
    .eq("id", userId);
  if (error) throw formatSupabaseError(error, "Failed to ban user");
}

export async function adminUnbanUser(userId: string) {
  const { error } = await getSupabase()
    .from("profiles")
    .update({ is_banned: false })
    .eq("id", userId);
  if (error) throw formatSupabaseError(error, "Failed to unban user");
}

export function filterBlockedProfiles<T extends { id: string }>(
  items: T[],
  blockedIds: Set<string>
): T[] {
  if (!blockedIds.size) return items;
  return items.filter((item) => !blockedIds.has(item.id));
}

export function filterBlockedAuthors<T extends { author_id: string }>(
  items: T[],
  blockedIds: Set<string>
): T[] {
  if (!blockedIds.size) return items;
  return items.filter((item) => !blockedIds.has(item.author_id));
}
