import type { SupabaseClient } from "@supabase/supabase-js";

export const ACCOUNT_STORAGE_BUCKETS = [
  "avatars",
  "posts",
  "stories",
  "messages",
  "trainer-certifications",
  "trainer-portfolio",
  "feedback-attachments",
] as const;

export type AccountStorageBucket = (typeof ACCOUNT_STORAGE_BUCKETS)[number];
export type DeletionJobStatus =
  | "pending"
  | "account_deleted"
  | "storage_pending"
  | "completed"
  | "failed"
  | "cleanup_exhausted";

export type TrustedDeletionResult = {
  ok: boolean;
  user_id: string;
  account_deleted: boolean;
  files_removed: number;
  buckets_completed: string[];
  buckets_failed: string[];
  status: DeletionJobStatus;
  last_error?: string;
  attempt_count: number;
};

export type TrustedDeletionOptions = {
  failBucket?: AccountStorageBucket | string;
  bucketAttempts?: number;
};

const LIST_PAGE_SIZE = 100;
const DEFAULT_BUCKET_ATTEMPTS = 3;

type JobRow = {
  user_id: string;
  status: DeletionJobStatus;
  buckets_completed: string[];
  buckets_failed: string[];
  files_removed: number;
  attempt_count: number;
  last_error: string | null;
};

async function upsertJob(admin: SupabaseClient, row: JobRow): Promise<void> {
  const { error } = await admin.from("account_deletion_jobs").upsert(
    {
      ...row,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(error.message);
}

async function readJob(admin: SupabaseClient, userId: string): Promise<JobRow | null> {
  const { data, error } = await admin
    .from("account_deletion_jobs")
    .select("user_id,status,buckets_completed,buckets_failed,files_removed,attempt_count,last_error")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as JobRow | null) ?? null;
}

function isLikelyFolder(item: { id?: string | null; name?: string | null }): boolean {
  return !item.id || Boolean(item.name?.endsWith("/"));
}

export async function listOwnedStoragePaths(
  admin: SupabaseClient,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, {
      limit: LIST_PAGE_SIZE,
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
      if (isLikelyFolder(item)) {
        paths.push(...(await listOwnedStoragePaths(admin, bucket, child.replace(/\/$/, ""))));
      } else {
        paths.push(child);
      }
    }
    if (page.length < LIST_PAGE_SIZE) break;
    offset += LIST_PAGE_SIZE;
  }
  return paths;
}

export function assertOwnedPaths(userId: string, paths: string[]): string[] {
  const prefix = `${userId}/`;
  const owned = paths.filter((path) => path === userId || path.startsWith(prefix));
  if (owned.length !== paths.length) {
    throw new Error("refusing to remove storage paths outside the job user prefix");
  }
  return owned;
}

export async function removeOwnedStorageBucket(
  admin: SupabaseClient,
  bucket: string,
  userId: string
): Promise<number> {
  const paths = assertOwnedPaths(userId, await listOwnedStoragePaths(admin, bucket, userId));
  if (!paths.length) return 0;
  const { error } = await admin.storage.from(bucket).remove(paths);
  if (error) throw new Error(error.message);
  return paths.length;
}

export async function authUserExists(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  return !error && Boolean(data?.user);
}

const JOB_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MAX_WORKER_ATTEMPTS = 25;
const CLEANUP_JOB_STATUSES: DeletionJobStatus[] = [
  "pending",
  "failed",
  "account_deleted",
  "storage_pending",
];

export type WorkerJobOutcome = {
  user_id: string;
  outcome: "completed" | "skipped_live_account" | "failed" | "ignored" | "exhausted";
  last_error?: string;
};

export type WorkerRunResult = {
  scanned: number;
  completed: number;
  skipped: number;
  failed: number;
  results: WorkerJobOutcome[];
};

export async function retryPendingAccountDeletionJobs(
  admin: SupabaseClient,
  options: { limit?: number } = {}
): Promise<WorkerRunResult> {
  const limit = options.limit ?? 20;
  const { data, error } = await admin
    .from("account_deletion_jobs")
    .select("user_id,status,attempt_count")
    .in("status", CLEANUP_JOB_STATUSES)
    .order("updated_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const results: WorkerJobOutcome[] = [];
  let completed = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of data ?? []) {
    const userId = String(row.user_id ?? "");
    if (!JOB_UUID.test(userId)) {
      results.push({ user_id: userId, outcome: "ignored", last_error: "invalid user id" });
      continue;
    }
    if (Number(row.attempt_count ?? 0) >= MAX_WORKER_ATTEMPTS) {
      await upsertJob(admin, {
        user_id: userId,
        status: "cleanup_exhausted",
        buckets_completed: (await readJob(admin, userId))?.buckets_completed ?? [],
        buckets_failed: (await readJob(admin, userId))?.buckets_failed ?? [],
        files_removed: (await readJob(admin, userId))?.files_removed ?? 0,
        attempt_count: Number(row.attempt_count ?? 0),
        last_error: "max worker attempts reached",
      });
      results.push({
        user_id: userId,
        outcome: "exhausted",
        last_error: "max worker attempts reached",
      });
      failed += 1;
      continue;
    }

    const live = await authUserExists(admin, userId);
    if (live) {
      await upsertJob(admin, {
        user_id: userId,
        status: row.status as DeletionJobStatus,
        buckets_completed: (await readJob(admin, userId))?.buckets_completed ?? [],
        buckets_failed: (await readJob(admin, userId))?.buckets_failed ?? [],
        files_removed: (await readJob(admin, userId))?.files_removed ?? 0,
        attempt_count: Number(row.attempt_count ?? 0),
        last_error: "skipped: auth user still present; files not touched",
      });
      results.push({
        user_id: userId,
        outcome: "skipped_live_account",
        last_error: "auth user still present",
      });
      skipped += 1;
      continue;
    }

    try {
      const job = await readJob(admin, userId);
      if (!job) {
        results.push({ user_id: userId, outcome: "ignored", last_error: "job disappeared" });
        continue;
      }
      const retried = await retryAccountDeletionCleanup(admin, userId);
      if (retried.ok) {
        completed += 1;
        results.push({ user_id: userId, outcome: "completed" });
      } else {
        failed += 1;
        results.push({
          user_id: userId,
          outcome: "failed",
          last_error: retried.last_error,
        });
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      failed += 1;
      results.push({ user_id: userId, outcome: "failed", last_error: message });
    }
  }

  return {
    scanned: (data ?? []).length,
    completed,
    skipped,
    failed,
    results,
  };
}

async function cleanupRemainingBuckets(
  admin: SupabaseClient,
  userId: string,
  alreadyCompleted: string[],
  filesAlreadyRemoved: number,
  attemptCount: number,
  options: TrustedDeletionOptions = {}
): Promise<TrustedDeletionResult> {
  const completed = [...alreadyCompleted];
  const failed: string[] = [];
  let filesRemoved = filesAlreadyRemoved;
  const attempts = options.bucketAttempts ?? DEFAULT_BUCKET_ATTEMPTS;
  let lastError: string | undefined;

  for (const bucket of ACCOUNT_STORAGE_BUCKETS) {
    if (completed.includes(bucket)) continue;
    let bucketError: string | undefined;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        if (options.failBucket === bucket) {
          throw new Error(`forced cleanup failure:${bucket}`);
        }
        filesRemoved += await removeOwnedStorageBucket(admin, bucket, userId);
        completed.push(bucket);
        bucketError = undefined;
        await upsertJob(admin, {
          user_id: userId,
          status: "account_deleted",
          buckets_completed: completed,
          buckets_failed: failed,
          files_removed: filesRemoved,
          attempt_count: attemptCount,
          last_error: null,
        });
        break;
      } catch (error) {
        bucketError = error instanceof Error ? error.message : String(error);
      }
    }
    if (bucketError) {
      failed.push(bucket);
      lastError = bucketError;
      await upsertJob(admin, {
        user_id: userId,
        status: "storage_pending",
        buckets_completed: completed,
        buckets_failed: failed,
        files_removed: filesRemoved,
        attempt_count: attemptCount,
        last_error: lastError,
      });
      return {
        ok: false,
        user_id: userId,
        account_deleted: true,
        files_removed: filesRemoved,
        buckets_completed: completed,
        buckets_failed: failed,
        status: "storage_pending",
        last_error: lastError,
        attempt_count: attemptCount,
      };
    }
  }

  await upsertJob(admin, {
    user_id: userId,
    status: "completed",
    buckets_completed: completed,
    buckets_failed: [],
    files_removed: filesRemoved,
    attempt_count: attemptCount,
    last_error: null,
  });
  return {
    ok: true,
    user_id: userId,
    account_deleted: true,
    files_removed: filesRemoved,
    buckets_completed: completed,
    buckets_failed: [],
    status: "completed",
    attempt_count: attemptCount,
  };
}

export async function runTrustedAccountDeletion(
  admin: SupabaseClient,
  userId: string,
  options: TrustedDeletionOptions = {}
): Promise<TrustedDeletionResult> {
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
      files_removed: 0,
      buckets_completed: [],
      buckets_failed: [],
      status: "failed",
      last_error: error.message,
      attempt_count: 1,
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

  return cleanupRemainingBuckets(admin, userId, [], 0, 1, options);
}

export async function retryAccountDeletionCleanup(
  admin: SupabaseClient,
  userId: string,
  options: TrustedDeletionOptions = {}
): Promise<TrustedDeletionResult> {
  const job = await readJob(admin, userId);
  if (!job) {
    throw new Error("No recorded deletion job to retry");
  }
  if (!["account_deleted", "storage_pending"].includes(job.status)) {
    throw new Error(`Deletion job is not retryable (${job.status})`);
  }
  const attemptCount = job.attempt_count + 1;
  await upsertJob(admin, {
    ...job,
    attempt_count: attemptCount,
    last_error: null,
  });
  return cleanupRemainingBuckets(
    admin,
    userId,
    job.buckets_completed ?? [],
    job.files_removed ?? 0,
    attemptCount,
    { ...options, failBucket: undefined }
  );
}
