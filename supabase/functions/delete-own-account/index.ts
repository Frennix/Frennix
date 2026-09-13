import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKETS = [
  "avatars",
  "posts",
  "stories",
  "messages",
  "trainer-certifications",
  "trainer-portfolio",
  "feedback-attachments",
] as const;

Deno.serve(async (req) => {
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ ok: false, account_deleted: false }), { status: 401 });
    }

    const admin = createClient(url, service);
    const body = await req.json().catch(() => ({}));
    const userId = userData.user.id;
    const result = body?.retry
      ? await retryCleanup(admin, userId)
      : await runDeletion(admin, userId);
    return new Response(JSON.stringify(result), {
      status: result.account_deleted ? 200 : 400,
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500 });
  }
});

async function upsertJob(admin: ReturnType<typeof createClient>, row: Record<string, unknown>) {
  const { error } = await admin.from("account_deletion_jobs").upsert(
    { ...row, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(error.message);
}

async function listPaths(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string
): Promise<string[]> {
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

async function removeBucket(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  userId: string
) {
  const paths = await listPaths(admin, bucket, userId);
  if (!paths.length) return 0;
  const { error } = await admin.storage.from(bucket).remove(paths);
  if (error) throw new Error(error.message);
  return paths.length;
}

async function cleanup(
  admin: ReturnType<typeof createClient>,
  userId: string,
  completed: string[],
  filesRemoved: number,
  attempt: number
) {
  const bucketsCompleted = [...completed];
  for (const bucket of BUCKETS) {
    if (bucketsCompleted.includes(bucket)) continue;
    let lastError: string | undefined;
    for (let i = 0; i < 3; i++) {
      try {
        filesRemoved += await removeBucket(admin, bucket, userId);
        bucketsCompleted.push(bucket);
        lastError = undefined;
        await upsertJob(admin, {
          user_id: userId,
          status: "account_deleted",
          buckets_completed: bucketsCompleted,
          buckets_failed: [],
          files_removed: filesRemoved,
          attempt_count: attempt,
          last_error: null,
        });
        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
    if (lastError) {
      await upsertJob(admin, {
        user_id: userId,
        status: "storage_pending",
        buckets_completed: bucketsCompleted,
        buckets_failed: [bucket],
        files_removed: filesRemoved,
        attempt_count: attempt,
        last_error: lastError,
      });
      return {
        ok: false,
        user_id: userId,
        account_deleted: true,
        files_removed: filesRemoved,
        buckets_completed: bucketsCompleted,
        buckets_failed: [bucket],
        status: "storage_pending",
        last_error: lastError,
      };
    }
  }
  await upsertJob(admin, {
    user_id: userId,
    status: "completed",
    buckets_completed: bucketsCompleted,
    buckets_failed: [],
    files_removed: filesRemoved,
    attempt_count: attempt,
    last_error: null,
  });
  return {
    ok: true,
    user_id: userId,
    account_deleted: true,
    files_removed: filesRemoved,
    buckets_completed: bucketsCompleted,
    buckets_failed: [],
    status: "completed",
  };
}

async function runDeletion(admin: ReturnType<typeof createClient>, userId: string) {
  await upsertJob(admin, {
    user_id: userId,
    status: "pending",
    buckets_completed: [],
    buckets_failed: [],
    files_removed: 0,
    attempt_count: 1,
    last_error: null,
  });
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    await upsertJob(admin, {
      user_id: userId,
      status: "failed",
      buckets_completed: [],
      buckets_failed: [],
      files_removed: 0,
      attempt_count: 1,
      last_error: error.message,
    });
    return {
      ok: false,
      user_id: userId,
      account_deleted: false,
      status: "failed",
      last_error: error.message,
    };
  }
  await upsertJob(admin, {
    user_id: userId,
    status: "account_deleted",
    buckets_completed: [],
    buckets_failed: [],
    files_removed: 0,
    attempt_count: 1,
    last_error: null,
  });
  return cleanup(admin, userId, [], 0, 1);
}

async function retryCleanup(admin: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await admin
    .from("account_deletion_jobs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No recorded deletion job to retry");
  return cleanup(
    admin,
    userId,
    data.buckets_completed ?? [],
    data.files_removed ?? 0,
    (data.attempt_count ?? 0) + 1
  );
}
