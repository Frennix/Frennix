// Retry recorded account-deletion file cleanup.
// Invoke via Supabase cron or POST with the service-role key.
// Does not use a user session. Only removes {job.user_id}/... prefixes.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isExactServiceRoleAuthorization } from "../_shared/service-role-auth.ts";

const BUCKETS = [
  "avatars",
  "posts",
  "stories",
  "messages",
  "trainer-certifications",
  "trainer-portfolio",
  "feedback-attachments",
] as const;

const JOB_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_WORKER_ATTEMPTS = 25;

Deno.serve(async (req) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!isExactServiceRoleAuthorization(req.headers.get("Authorization"), serviceKey)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);
    const { data: jobs, error } = await admin
      .from("account_deletion_jobs")
      .select("user_id,status,buckets_completed,files_removed,attempt_count")
      .in("status", ["pending", "failed", "account_deleted", "storage_pending"])
      .order("updated_at", { ascending: true })
      .limit(20);
    if (error) throw error;

    const results = [];
    for (const job of jobs ?? []) {
      const userId = String(job.user_id ?? "");
      if (!JOB_UUID.test(userId)) {
        results.push({ user_id: userId, outcome: "ignored", last_error: "invalid user id" });
        continue;
      }
      if (Number(job.attempt_count ?? 0) >= MAX_WORKER_ATTEMPTS) {
        await admin.from("account_deletion_jobs").update({
          status: "cleanup_exhausted",
          last_error: "max worker attempts reached",
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId);
        results.push({ user_id: userId, outcome: "exhausted", last_error: "max worker attempts reached" });
        continue;
      }
      const { data: authData } = await admin.auth.admin.getUserById(userId);
      if (authData?.user) {
        await admin.from("account_deletion_jobs").update({
          last_error: "skipped: auth user still present; files not touched",
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId);
        results.push({ user_id: userId, outcome: "skipped_live_account" });
        continue;
      }
      try {
        const cleanup = await cleanupOwnedPrefix(admin, userId, job.buckets_completed ?? [], job.files_removed ?? 0, (job.attempt_count ?? 0) + 1);
        results.push({ user_id: userId, outcome: cleanup.ok ? "completed" : "failed", last_error: cleanup.last_error });
      } catch (caught) {
        const last_error = caught instanceof Error ? caught.message : String(caught);
        await admin.from("account_deletion_jobs").update({
          status: "storage_pending",
          last_error,
          attempt_count: (job.attempt_count ?? 0) + 1,
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId);
        results.push({ user_id: userId, outcome: "failed", last_error });
      }
    }

    return new Response(JSON.stringify({ ok: true, scanned: (jobs ?? []).length, results }), {
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});

function assertOwnedPaths(userId: string, paths: string[]) {
  const prefix = `${userId}/`;
  const owned = paths.filter((path) => path === userId || path.startsWith(prefix));
  if (owned.length !== paths.length) {
    throw new Error("refusing to remove storage paths outside the job user prefix");
  }
  return owned;
}

async function listPaths(admin: ReturnType<typeof createClient>, bucket: string, prefix: string): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("not found") || message.includes("notexist")) return paths;
      throw new Error(error.message);
    }
    const page = data ?? [];
    for (const item of page) {
      if (!item.name) continue;
      const child = prefix ? `${prefix}/${item.name}` : item.name;
      if (!item.id || item.name.endsWith("/")) {
        paths.push(...(await listPaths(admin, bucket, child.replace(/\/$/, ""))));
      } else {
        paths.push(child);
      }
    }
    if (page.length < 100) break;
    offset += 100;
  }
  return paths;
}

async function cleanupOwnedPrefix(
  admin: ReturnType<typeof createClient>,
  userId: string,
  completed: string[],
  filesRemoved: number,
  attempt: number
) {
  const bucketsCompleted = [...completed];
  for (const bucket of BUCKETS) {
    if (bucketsCompleted.includes(bucket)) continue;
    const paths = assertOwnedPaths(userId, await listPaths(admin, bucket, userId));
    if (paths.length) {
      const { error } = await admin.storage.from(bucket).remove(paths);
      if (error) throw new Error(error.message);
      filesRemoved += paths.length;
    }
    bucketsCompleted.push(bucket);
    await admin.from("account_deletion_jobs").update({
      status: "account_deleted",
      buckets_completed: bucketsCompleted,
      buckets_failed: [],
      files_removed: filesRemoved,
      attempt_count: attempt,
      last_error: null,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
  }
  await admin.from("account_deletion_jobs").update({
    status: "completed",
    buckets_completed: bucketsCompleted,
    buckets_failed: [],
    files_removed: filesRemoved,
    attempt_count: attempt,
    last_error: null,
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);
  return { ok: true, last_error: undefined };
}
