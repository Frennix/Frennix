#!/usr/bin/env node
/**
 * Local-only trusted Storage API deletion test.
 * Does not publish or apply the migration to production.
 *
 * Credential source: `npx supabase status -o env` in this worktree.
 * Never prints anon or service-role values.
 *
 * A full pass requires auth user, profile, and uploaded files gone.
 */

import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACCOUNT_STORAGE_BUCKETS,
  retryPendingAccountDeletionJobs,
  runTrustedAccountDeletion,
} from "../packages/api/src/account-deletion-server.ts";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED_API_URL = "http://127.0.0.1:54321";
const LOCAL_DB_CONTAINER = "supabase_db_frennix";
const CREDENTIAL_SOURCE =
  "npx supabase status -o env (worktree /Users/startswithu/Source/frennix/apps/mobile-account-delete)";
const PRODUCTION_HOST = "wkrwncovmpsveatlrqel.supabase.co";
const EMAIL_PREFIX = "recover.delete.";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

function failClosed(message) {
  throw new Error(`fail closed: ${message}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function loadLocalSupabaseEnv() {
  const raw = execSync("npx supabase status -o env", {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const env = {};
  for (const line of raw.split("\n")) {
    const match = line.match(/^(?:export )?([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
  return {
    url: env.API_URL || env.SUPABASE_URL || "",
    anon: env.ANON_KEY || env.SUPABASE_ANON_KEY || "",
    service: env.SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "",
  };
}

function assertLocalOnly(url) {
  if (!url) failClosed("Supabase API URL is missing");
  if (url.includes(PRODUCTION_HOST)) failClosed("refusing production Supabase host");
  if (url !== REQUIRED_API_URL) failClosed(`API URL must be exactly ${REQUIRED_API_URL}`);
}

function preflightReport(env) {
  return {
    supabaseUrl: env.url,
    requiredUrl: REQUIRED_API_URL,
    urlMatchesRequired: env.url === REQUIRED_API_URL,
    credentialSource: CREDENTIAL_SOURCE,
    anonKeyPresent: Boolean(env.anon),
    serviceRoleKeyPresent: Boolean(env.service),
    localDbContainer: LOCAL_DB_CONTAINER,
    failClosedIfUrlMismatch: true,
    disposableUsersAndFilesOnly: true,
    fullPassRequiresAuthProfileAndFileGone: true,
    usesStorageApiNotSqlDelete: true,
    mutationsRequireRunFlag: true,
  };
}

function sourceChecks() {
  const client = fs.readFileSync(path.join(ROOT, "packages/api/src/account-deletion.ts"), "utf8");
  const server = fs.readFileSync(path.join(ROOT, "packages/api/src/account-deletion-server.ts"), "utf8");
  const migration = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/20260913120000_delete_own_account.sql"),
    "utf8"
  );
  assert(!/storage\.from\(/.test(client), "client must not call storage.from");
  assert(!/\.remove\(/.test(client), "client must not call storage.remove");
  assert(client.includes('functions.invoke("delete-own-account")'), "client invokes trusted function");
  assert(client.includes('rpc("delete_own_account")'), "auth-only rpc helper remains");
  assert(server.includes("admin.storage.from(bucket).remove"), "server uses Storage API remove");
  assert(server.includes("account_deletion_jobs"), "server records progress");
  assert(!/DELETE FROM storage\.objects/.test(server), "server must not SQL-delete storage.objects");
  assert(!/EXCEPTION\s+WHEN OTHERS/.test(migration), "migration must not swallow cleanup errors");
  const executableSql = migration
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  assert(
    !/DELETE FROM storage\.objects/.test(executableSql),
    "migration must not SQL-delete storage.objects"
  );
  assert(server.includes("retryPendingAccountDeletionJobs"), "worker scans recorded jobs");
  assert(server.includes("skipped: auth user still present"), "worker skips live accounts");
  assert(
    server.includes("refusing to remove storage paths outside the job user prefix"),
    "worker is prefix-safe"
  );
  const screen = fs.readFileSync(path.join(ROOT, "app/delete-account.tsx"), "utf8");
  const settings = fs.readFileSync(path.join(ROOT, "app/settings.tsx"), "utf8");
  assert(!screen.includes("MockDeleteAccount"), "production delete screen has no mock import");
  assert(!settings.includes("MockDeleteAccount"), "production settings has no mock import");
  assert(!client.includes("EXPO_PUBLIC_DELETE_ACCOUNT_PREVIEW"), "client has no mock-preview env gate");
  assert(!client.includes("SERVICE_ROLE"), "client module has no service-role secret");
  const barrel = fs.readFileSync(path.join(ROOT, "packages/api/src/index.ts"), "utf8");
  assert(!barrel.includes("account-deletion-server"), "api barrel does not export server worker");
  assert(!fs.existsSync(path.join(ROOT, "lib/delete-account-preview.ts")), "mock preview helper is gone");
  assert(!fs.existsSync(path.join(ROOT, "components/MockDeleteAccountBanner.tsx")), "mock banner is gone");
  const worker = fs.readFileSync(
    path.join(ROOT, "supabase/functions/retry-account-deletion-jobs/index.ts"),
    "utf8"
  );
  assert(worker.includes("SUPABASE_SERVICE_ROLE_KEY"), "edge worker requires service role");
  assert(worker.includes("isExactServiceRoleAuthorization"), "edge worker requires exact Bearer service-role match");
  assert(!worker.includes("authHeader.includes(serviceKey)"), "edge worker must not substring-match secrets");
  assert(!worker.includes("auth.getUser()"), "edge worker must not use a user session");
  assert(
    worker.includes("refusing to remove storage paths outside the job user prefix"),
    "edge worker is prefix-safe"
  );
}

function applyLocalSql(sql) {
  const names = execSync("docker ps --format '{{.Names}}'", { encoding: "utf8" });
  if (!names.split("\n").includes(LOCAL_DB_CONTAINER)) {
    failClosed(`local db container ${LOCAL_DB_CONTAINER} is not running`);
  }
  execSync(`docker exec -i ${LOCAL_DB_CONTAINER} psql -U postgres -d postgres -v ON_ERROR_STOP=1`, {
    input: sql,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function applyLocalJobsAndAuthRpc() {
  applyLocalSql(
    fs.readFileSync(path.join(ROOT, "supabase/migrations/20260913120000_delete_own_account.sql"), "utf8")
  );
}

async function fileExists(admin, bucket, objectPath) {
  const downloaded = await admin.storage.from(bucket).download(objectPath);
  return !downloaded.error && Boolean(downloaded.data);
}

async function authExists(admin, userId) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  return !error && Boolean(data?.user);
}

async function profileExists(admin, userId) {
  const { data } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
  return Boolean(data?.id);
}

async function leftoverForUser(admin, userId, filesByBucket) {
  const leftovers = [];
  if (await authExists(admin, userId)) leftovers.push({ type: "auth_user", id: userId });
  if (await profileExists(admin, userId)) leftovers.push({ type: "profile", id: userId });
  for (const [bucket, objectPath] of Object.entries(filesByBucket)) {
    if (await fileExists(admin, bucket, objectPath)) {
      leftovers.push({ type: "file", bucket, path: objectPath });
    }
  }
  return leftovers;
}

const args = new Set(process.argv.slice(2));
const env = loadLocalSupabaseEnv();
assertLocalOnly(env.url);
if (!env.anon || !env.service) failClosed("local anon or service-role key missing from supabase status");

console.log(JSON.stringify(preflightReport(env), null, 2));
if (!args.has("--run")) {
  console.log("preflight only; no users or files created");
  process.exit(0);
}

sourceChecks();
const cases = [];
const tracked = [];

function record(name, status, detail) {
  cases.push({ name, status, detail });
  console.log(`${status.toUpperCase()} ${name}: ${detail}`);
}

const admin = createClient(env.url, env.service, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anonClient = createClient(env.url, env.anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function createDisposable(caseName, buckets = ["posts"]) {
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const email = `${EMAIL_PREFIX}${stamp}@example.invalid`;
  const password = `Recover${stamp}!aA`;
  const createdUser = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Recover Delete" },
  });
  if (createdUser.error || !createdUser.data.user) {
    throw new Error(createdUser.error?.message || "createUser failed");
  }
  const userId = createdUser.data.user.id;
  const filesByBucket = {};
  for (const bucket of buckets) {
    const objectPath = `${userId}/recover-probe-${stamp}.png`;
    const uploaded = await admin.storage.from(bucket).upload(objectPath, PNG, {
      contentType: "image/png",
      upsert: false,
    });
    if (uploaded.error) throw new Error(`${bucket}: ${uploaded.error.message}`);
    filesByBucket[bucket] = objectPath;
    assert(await fileExists(admin, bucket, objectPath), `${bucket} upload was not readable`);
  }
  const item = { caseName, userId, email, filesByBucket };
  tracked.push(item);
  return { ...item, password };
}

async function cleanupTracked(item) {
  for (const [bucket, objectPath] of Object.entries(item.filesByBucket ?? {})) {
    await admin.storage.from(bucket).remove([objectPath]).catch(() => {});
  }
  if (item.userId) await admin.auth.admin.deleteUser(item.userId).catch(() => {});
}

async function cleanupPriorDisposableUsers() {
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const user of listed.data?.users ?? []) {
    if (!user.email || !user.email.startsWith(EMAIL_PREFIX)) continue;
    for (const bucket of ACCOUNT_STORAGE_BUCKETS) {
      const folder = await admin.storage.from(bucket).list(user.id).catch(() => ({ data: [] }));
      const paths = (folder.data ?? []).map((entry) => `${user.id}/${entry.name}`);
      if (paths.length) await admin.storage.from(bucket).remove(paths).catch(() => {});
    }
    await admin.auth.admin.deleteUser(user.id).catch(() => {});
  }
}

try {
  await cleanupPriorDisposableUsers();
  applyLocalJobsAndAuthRpc();
  record("local_schema_ready", "pass", "applied jobs table and auth-only RPC on local docker only");
  record("source_trusted_storage_api", "pass", "client has no Storage remove; server uses Storage API");

  {
    const item = await createDisposable("anon_cannot_delete_account");
    const anonRpc = await anonClient.rpc("delete_own_account");
    const leftovers = await leftoverForUser(admin, item.userId, item.filesByBucket);
    if (!anonRpc.error) {
      record(item.caseName, "fail", "anon RPC unexpectedly succeeded");
    } else if (leftovers.length === 0) {
      record(item.caseName, "fail", "anon RPC failed but disposable account/files disappeared");
    } else {
      record(item.caseName, "pass", "anon RPC failed; auth, profile, and file remain");
    }
    await cleanupTracked(item);
    item.userId = null;
    item.filesByBucket = {};
  }

  {
    const bystander = await createDisposable("bystander_files_untouched", [...ACCOUNT_STORAGE_BUCKETS]);
    const item = await createDisposable("worker_retries_pending_job_all_buckets", [...ACCOUNT_STORAGE_BUCKETS]);
    const failed = await runTrustedAccountDeletion(admin, item.userId, {
      failBucket: "posts",
      bucketAttempts: 1,
    });
    const afterFail = await leftoverForUser(admin, item.userId, item.filesByBucket);
    const authGone = !afterFail.some((row) => row.type === "auth_user" || row.type === "profile");
    const filesRemain = afterFail.some((row) => row.type === "file");
    if (failed.ok || !failed.account_deleted || !authGone || !filesRemain) {
      record(
        item.caseName,
        "fail",
        `forced fail did not leave files after account delete status=${failed.status} leftovers=${JSON.stringify(afterFail)}`
      );
    } else {
      const worker = await retryPendingAccountDeletionJobs(admin, { limit: 20 });
      const afterRetry = await leftoverForUser(admin, item.userId, item.filesByBucket);
      const bystanderLeft = await leftoverForUser(admin, bystander.userId, bystander.filesByBucket);
      const bystanderIntact =
        bystanderLeft.some((row) => row.type === "auth_user") &&
        bystanderLeft.filter((row) => row.type === "file").length === ACCOUNT_STORAGE_BUCKETS.length;
      const completedThisJob = worker.results.some(
        (row) => row.user_id === item.userId && row.outcome === "completed"
      );
      if (!completedThisJob || afterRetry.length || !bystanderIntact) {
        record(
          item.caseName,
          "fail",
          `worker incomplete completedThisJob=${completedThisJob} leftovers=${JSON.stringify(afterRetry)} bystander=${JSON.stringify(bystanderLeft)}`
        );
      } else {
        record(
          item.caseName,
          "pass",
          `worker completed ${item.userId.slice(0, 8)} across ${ACCOUNT_STORAGE_BUCKETS.length} buckets; bystander files untouched`
        );
      }
    }
    item.userId = (await authExists(admin, item.userId)) ? item.userId : null;
    item.filesByBucket = {};
    await cleanupTracked(bystander);
    bystander.userId = null;
    bystander.filesByBucket = {};
  }

  {
    const item = await createDisposable("full_trusted_delete_removes_auth_profile_and_files", [
      ...ACCOUNT_STORAGE_BUCKETS,
    ]);
    const deleted = await runTrustedAccountDeletion(admin, item.userId);
    const leftovers = await leftoverForUser(admin, item.userId, item.filesByBucket);
    if (!deleted.ok || leftovers.length) {
      record(
        item.caseName,
        "fail",
        `not a full pass ok=${deleted.ok} status=${deleted.status} leftovers=${JSON.stringify(leftovers)}`
      );
    } else if (deleted.buckets_completed.length !== ACCOUNT_STORAGE_BUCKETS.length) {
      record(item.caseName, "fail", `missing buckets ${deleted.buckets_completed.join(",")}`);
    } else {
      record(
        item.caseName,
        "pass",
        `auth user, profile, and files in ${ACCOUNT_STORAGE_BUCKETS.length} buckets are gone`
      );
    }
    item.userId = (await authExists(admin, item.userId)) ? item.userId : null;
    item.filesByBucket = {};
  }

  {
    process.env.EXPO_PUBLIC_DELETE_ACCOUNT_PREVIEW = "";
    const { initSupabase, deleteOwnAccount, ACCOUNT_DELETION_INTACT_MESSAGE } = await import(
      path.join(ROOT, "packages/api/src/index.ts")
    );
    initSupabase(env.url, env.anon);
    let intactMessage = null;
    try {
      await deleteOwnAccount();
    } catch (error) {
      intactMessage = error instanceof Error ? error.message : String(error);
    }
    record(
      "no_session_intact_copy",
      intactMessage === ACCOUNT_DELETION_INTACT_MESSAGE ? "pass" : "fail",
      intactMessage || "no error"
    );
    record(
      "mock_preview_removed",
      !fs.existsSync(path.join(ROOT, "lib/delete-account-preview.ts")) &&
        !fs.existsSync(path.join(ROOT, "components/MockDeleteAccountBanner.tsx"))
        ? "pass"
        : "fail",
      "mock-preview source is not part of the production build"
    );
  }
} catch (error) {
  record("harness", "fail", error instanceof Error ? error.message : String(error));
} finally {
  for (const item of tracked) {
    await cleanupTracked(item).catch(() => {});
  }
  const leftovers = [];
  for (const item of tracked) {
    if (!item.userId) continue;
    leftovers.push(...(await leftoverForUser(admin, item.userId, item.filesByBucket ?? {})));
  }
  const failed = cases.filter((row) => row.status === "fail");
  console.log(
    JSON.stringify(
      {
        cases,
        leftovers,
        leftoverCount: leftovers.length,
        failedCount: failed.length,
        bucketsCovered: ACCOUNT_STORAGE_BUCKETS,
        productionUntouched: true,
        appliedLocalSchemaOnly: true,
      },
      null,
      2
    )
  );
  if (failed.length || leftovers.length) process.exit(1);
}
