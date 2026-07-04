#!/usr/bin/env npx tsx
/**
 * Post-migration check: production posts trigger uses feed_post_activity_record,
 * not the legacy workout_post_activity_record / record_activity_workout_post.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

function migrationSynced(): boolean {
  const out = execSync("npx supabase migration list", {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  const fixLine = out.includes("20250722000001");
  const unsynced = /20250722000001.*remote":""/.test(out.replace(/\s/g, ""));
  if (!fixLine) throw new Error("fix migration not found in migration list");
  if (unsynced) throw new Error("20250722000001 not applied to remote — run npx supabase db push");
  return true;
}

function fixMigrationSafe(): void {
  const sql = readFileSync(
    join(ROOT, "supabase/migrations/20250722000001_fix_post_activity_trigger.sql"),
    "utf8"
  );
  const forbidden = [
    /\bALTER\s+TABLE\b/i,
    /\bDROP\s+TABLE\b/i,
    /\bTRUNCATE\b/i,
    /\bDELETE\s+FROM\b/i,
    /\bUPDATE\s+\w+\s+SET\b/i,
  ];
  for (const pattern of forbidden) {
    if (pattern.test(sql)) {
      throw new Error(`fix migration must not contain destructive DML/DDL: ${pattern}`);
    }
  }
  const required = [
    "DROP TRIGGER IF EXISTS workout_post_activity_record",
    "CREATE TRIGGER feed_post_activity_record",
    "publish_platform_activity",
    "DROP FUNCTION IF EXISTS public.record_activity_workout_post",
  ];
  for (const needle of required) {
    if (!sql.includes(needle)) throw new Error(`fix migration missing: ${needle}`);
  }
}

const checks = [
  { name: "migration:20250722000001 synced to remote", run: migrationSynced },
  { name: "migration:fix is trigger-only (no table/data changes)", run: fixMigrationSafe },
];

let failed = 0;
for (const check of checks) {
  try {
    check.run();
    console.log(`PASS  ${check.name}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL  ${check.name}`);
    console.error(`      ${e instanceof Error ? e.message : String(e)}`);
  }
}

if (failed) {
  console.error(`\n${checks.length - failed}/${checks.length} PASS, ${failed} FAIL`);
  process.exit(1);
}
console.log(`\n${checks.length}/${checks.length} PASS`);
