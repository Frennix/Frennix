/**
 * Verify Phase A ownership RLS policies and migrations on linked Supabase.
 * Run: npx tsx scripts/verify-phase-a-rls.ts
 */
import { execSync } from "node:child_process";

const REQUIRED_MIGRATIONS = [
  "20250630000001",
  "20250630000002",
  "20250630000003",
  "20250630000004",
  "20250630000005",
];

const REQUIRED_POLICIES: { table: string; cmd: string; policyname: string }[] = [
  { table: "challenges", cmd: "UPDATE", policyname: "Update own challenges" },
  { table: "challenges", cmd: "DELETE", policyname: "Delete own challenges" },
  { table: "groups", cmd: "DELETE", policyname: "Owners delete groups" },
  { table: "groups", cmd: "UPDATE", policyname: "Owners update groups" },
  { table: "comments", cmd: "UPDATE", policyname: "Update own comment" },
  { table: "comments", cmd: "DELETE", policyname: "Delete own comment" },
  { table: "posts", cmd: "UPDATE", policyname: "Users update own posts" },
  { table: "posts", cmd: "DELETE", policyname: "Users delete own posts" },
  { table: "events", cmd: "UPDATE", policyname: "Update own events" },
];

function runQuery(sql: string): unknown[] {
  const oneLine = sql.replace(/\s+/g, " ").trim();
  const out = execSync(`supabase db query --linked "${oneLine.replace(/"/g, '\\"')}"`, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  const match = out.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Could not parse supabase db query output");
  const parsed = JSON.parse(match[0]) as { rows?: unknown[] };
  return parsed.rows ?? [];
}

function verifyMigrations() {
  const out = execSync("supabase migration list", { encoding: "utf8" });
  for (const id of REQUIRED_MIGRATIONS) {
    const line = out.split("\n").find((l) => l.includes(id));
    if (!line) throw new Error(`Migration ${id} not found in migration list`);
    const parts = line.split("|").map((p) => p.trim());
    const local = parts[0];
    const remote = parts[1];
    if (!local || !remote || local !== remote) {
      throw new Error(`Migration ${id} not applied remotely (local=${local}, remote=${remote})`);
    }
  }
  console.log(`✓ All ${REQUIRED_MIGRATIONS.length} Phase A migrations applied remotely`);
}

function verifyPolicies() {
  const rows = runQuery(`
    SELECT tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('challenges', 'groups', 'comments', 'posts', 'events')
      AND cmd IN ('UPDATE', 'DELETE')
  `) as { tablename: string; policyname: string; cmd: string }[];

  for (const required of REQUIRED_POLICIES) {
    const found = rows.some(
      (r) =>
        r.tablename === required.table &&
        r.cmd === required.cmd &&
        r.policyname === required.policyname
    );
    if (!found) {
      throw new Error(
        `Missing RLS policy: ${required.table}.${required.cmd} → "${required.policyname}"`
      );
    }
  }
  console.log(`✓ All ${REQUIRED_POLICIES.length} ownership RLS policies present`);
}

function verifyReportColumns() {
  const rows = runQuery(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reports'
      AND column_name IN ('reported_challenge_id', 'reported_event_id', 'reported_group_id')
  `) as { column_name: string }[];

  const names = new Set(rows.map((r) => r.column_name));
  for (const col of ["reported_challenge_id", "reported_event_id", "reported_group_id"]) {
    if (!names.has(col)) throw new Error(`reports.${col} column missing`);
  }
  console.log("✓ Report columns for challenge/event/group present");
}

function verifyChallengeColumns() {
  const rows = runQuery(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'challenges'
      AND column_name IN ('rules', 'cover_image_url', 'created_by')
  `) as { column_name: string }[];

  const names = new Set(rows.map((r) => r.column_name));
  for (const col of ["rules", "cover_image_url", "created_by"]) {
    if (!names.has(col)) throw new Error(`challenges.${col} column missing`);
  }
  console.log("✓ Challenge management columns present");
}

function main() {
  verifyMigrations();
  verifyPolicies();
  verifyReportColumns();
  verifyChallengeColumns();
  console.log("\nPhase A RLS verification passed.");
}

main();
