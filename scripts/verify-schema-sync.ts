#!/usr/bin/env npx tsx
/**
 * Catches schema/code drift before production deploy — e.g. legacy DB triggers
 * referencing renamed columns after migrations ship.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

function read(path: string) {
  return readFileSync(join(ROOT, path), "utf8");
}

function mustInclude(file: string, needle: string, label: string) {
  if (!read(file).includes(needle)) {
    throw new Error(`${label}: missing "${needle}" in ${file}`);
  }
}

function mustExclude(file: string, needle: string, label: string) {
  if (read(file).includes(needle)) {
    throw new Error(`${label}: must not contain "${needle}" in ${file}`);
  }
}

const checks: Array<{ name: string; run: () => void }> = [
  {
    name: "migration:post activity trigger fix exists",
    run: () => {
      mustInclude(
        "supabase/migrations/20250722000001_fix_post_activity_trigger.sql",
        "feed_post_activity_record",
        "fix migration"
      );
      mustInclude(
        "supabase/migrations/20250722000001_fix_post_activity_trigger.sql",
        "DROP TRIGGER IF EXISTS workout_post_activity_record",
        "fix migration"
      );
    },
  },
  {
    name: "migration:fix uses publish_platform_activity",
    run: () => {
      mustInclude(
        "supabase/migrations/20250722000001_fix_post_activity_trigger.sql",
        "publish_platform_activity",
        "fix migration"
      );
      mustExclude(
        "supabase/migrations/20250722000001_fix_post_activity_trigger.sql",
        "event_type",
        "fix migration"
      );
    },
  },
  {
    name: "api:formatSupabaseError is user-safe",
    run: () => {
      const source = read("packages/api/src/profile-utils.ts");
      if (!source.includes("getUserFriendlyErrorMessage")) {
        throw new Error("formatSupabaseError must use getUserFriendlyErrorMessage");
      }
      if (source.includes('code=${supabaseError.code}')) {
        throw new Error("formatSupabaseError must not expose code= in user errors");
      }
    },
  },
  {
    name: "ui:share post friendly errors",
    run: () => {
      mustInclude("lib/share-post-errors.ts", "WORKOUT_SHARING_UNAVAILABLE_MESSAGE", "share errors");
      mustInclude("app/create-post.tsx", "getSharePostUserMessage", "create post");
    },
  },
  {
    name: "docs:RELEASE log tracks v1.0.2 bug",
    run: () => {
      mustInclude("features/releases/RELEASE.md", "BUG-001", "release log");
      mustInclude("features/releases/RELEASE.md", "event_type", "release log");
    },
  },
  {
    name: "checklist:production schema gate documented",
    run: () => {
      mustInclude(
        "features/releases/checklists/PRODUCTION-DEPLOYMENT.md",
        "verify:schema-sync",
        "checklist"
      );
    },
  },
  {
    name: "sql:platform activity uses activity_type in engine migration",
    run: () => {
      mustInclude(
        "supabase/migrations/20250719000001_platform_activity_engine.sql",
        "activity_type",
        "platform activity engine"
      );
    },
  },
];

let failed = 0;

for (const check of checks) {
  try {
    check.run();
    console.log(`PASS  ${check.name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL  ${check.name}`);
    console.error(`      ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed > 0) {
  console.error(`\n${checks.length - failed}/${checks.length} PASS, ${failed} FAIL`);
  process.exit(1);
}

console.log(`\n${checks.length}/${checks.length} PASS`);
