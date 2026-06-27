/**
 * Static check: profile_for_viewer must not NULL a NOT NULL profiles column.
 * Run: npx tsx scripts/verify-match-candidates-rpc.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const MIGRATIONS = join(ROOT, "supabase/migrations");

const fixMigration = readFileSync(
  join(MIGRATIONS, "20250630000008_fix_match_candidates_composite_expand.sql"),
  "utf8"
);

if (!fixMigration.includes("(public.profile_for_viewer(p, v_viewer.id)).*")) {
  console.error("FAIL: get_match_candidates must expand profile_for_viewer with .*");
  process.exit(1);
}

if (!fixMigration.includes("(public.profile_for_viewer(p)).*")) {
  console.error("FAIL: search_profiles must expand profile_for_viewer with .*");
  process.exit(1);
}

const notNullMigration = readFileSync(
  join(MIGRATIONS, "20250630000007_fix_profile_for_viewer_not_null.sql"),
  "utf8"
);

if (notNullMigration.includes("show_online_status := NULL")) {
  console.error("FAIL: profile_for_viewer still assigns NULL to show_online_status");
  process.exit(1);
}

const privacyMigration = readFileSync(
  join(MIGRATIONS, "20250630000006_show_online_status_privacy.sql"),
  "utf8"
);

if (!privacyMigration.includes("get_match_candidates")) {
  console.error("FAIL: get_match_candidates missing from privacy migration");
  process.exit(1);
}

console.log("PASS  get_match_candidates expands profile_for_viewer composite rows");
console.log("PASS  search_profiles expands profile_for_viewer composite rows");
console.log("PASS  profile_for_viewer avoids NULL on NOT NULL show_online_status");
