/**
 * Static check: match candidate RPCs must expand profile_for_viewer and avoid NOT NULL violations.
 * Run: npx tsx scripts/verify-match-candidates-rpc.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const MIGRATIONS = join(ROOT, "supabase/migrations");

function read(name: string) {
  return readFileSync(join(MIGRATIONS, name), "utf8");
}

const fixMigration = read("20250630000008_fix_match_candidates_composite_expand.sql");
const locationMigration = read("20260726000001_location_discovery_privacy.sql");
const repairMigration = read("20260728000001_fix_match_candidates_profile_for_viewer.sql");

if (!fixMigration.includes("(public.profile_for_viewer(p, v_viewer.id)).*")) {
  console.error("FAIL: baseline get_match_candidates must expand profile_for_viewer with .*");
  process.exit(1);
}

if (locationMigration.includes("SELECT public.profile_for_viewer(p, v_viewer.id)")) {
  console.log("NOTE  location discovery migration regressed composite expand (repaired in 20260728000001)");
}

if (!repairMigration.includes("(public.profile_for_viewer(p, v_viewer.id)).*")) {
  console.error("FAIL: repair migration must expand get_match_candidates with .*");
  process.exit(1);
}

if (!repairMigration.includes("(public.profile_for_viewer(p)).*")) {
  console.error("FAIL: repair migration must expand search_profiles with .*");
  process.exit(1);
}

if (repairMigration.includes("show_online_status := NULL")) {
  console.error("FAIL: profile_for_viewer must not NULL show_online_status");
  process.exit(1);
}

if (!repairMigration.includes("show_online_status := true")) {
  console.error("FAIL: profile_for_viewer must mask show_online_status with true for other viewers");
  process.exit(1);
}

console.log("PASS  repair migration expands profile_for_viewer composite rows");
console.log("PASS  profile_for_viewer avoids NULL on NOT NULL show_online_status");
