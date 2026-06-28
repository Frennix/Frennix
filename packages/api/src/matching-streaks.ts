import { computeWorkoutStreakFromDates } from "./streaks";
import { getSupabase } from "./supabase";

/** Batch workout streaks for match candidate scoring. Uses RPC when available. */
export async function getWorkoutStreaksForUserIds(
  userIds: string[]
): Promise<Map<string, number>> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const streaks = new Map<string, number>();
  if (!uniqueIds.length) return streaks;

  const { data, error } = await getSupabase().rpc("profile_workout_streaks", {
    p_user_ids: uniqueIds,
  });

  if (!error && Array.isArray(data)) {
    for (const row of data) {
      if (row && typeof row === "object" && !Array.isArray(row)) {
        const record = row as { user_id?: string; streak?: number };
        if (typeof record.user_id === "string") {
          streaks.set(record.user_id, Number(record.streak) || 0);
        }
      }
    }
    return streaks;
  }

  const { data: posts, error: postsError } = await getSupabase()
    .from("posts")
    .select("author_id, created_at")
    .in("author_id", uniqueIds)
    .in("post_type", ["workout_update", "photo", "video"]);

  if (postsError) {
    return streaks;
  }

  const datesByUser = new Map<string, string[]>();
  for (const post of posts ?? []) {
    const authorId = post.author_id as string;
    const createdAt = post.created_at as string;
    if (!authorId || !createdAt) continue;
    const list = datesByUser.get(authorId) ?? [];
    list.push(createdAt);
    datesByUser.set(authorId, list);
  }

  for (const userId of uniqueIds) {
    streaks.set(userId, computeWorkoutStreakFromDates(datesByUser.get(userId) ?? []));
  }

  return streaks;
}
