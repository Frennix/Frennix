/**
 * Phase 12 — automated matchmaking pre-production checks (static + remote).
 * Run: npx tsx scripts/verify-matchmaking-qa.ts
 */
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const MOBILE = join(__dirname, "..");
const ROOT = join(MOBILE, "../..");
const SUPABASE = join(MOBILE, "supabase/migrations");

type CheckResult = { id: string; area: string; status: "PASS" | "FAIL" | "MANUAL"; detail: string };

const results: CheckResult[] = [];

function pass(id: string, area: string, detail: string) {
  results.push({ id, area, status: "PASS", detail });
}

function fail(id: string, area: string, detail: string) {
  results.push({ id, area, status: "FAIL", detail });
}

function manual(id: string, area: string, detail: string) {
  results.push({ id, area, status: "MANUAL", detail });
}

const REQUIRED_MIGRATIONS = [
  "20250620000001_matchmaking_rpcs.sql",
  "20250623000001_fix_match_candidates_array_order.sql",
  "20250624000001_presence_realtime_stale_cleanup.sql",
  "20250624000002_training_match_message_notifications.sql",
  "20250625000001_training_match_removal_and_block.sql",
  "20250626000001_production_readiness.sql",
  "20250630000014_matching_scoring_phase_a.sql",
  "20250704000001_p1_training_matchmaking_flag.sql",
  "20250705000001_p1_matchmaking_analytics.sql",
];

const REQUIRED_RPCS = [
  "get_match_candidates",
  "record_match_swipe",
  "get_training_matches",
  "remove_training_match",
  "set_presence",
  "expire_stale_presence",
  "notify_on_match",
  "dispatch_push_notification",
  "evaluate_feature_flag",
  "get_matchmaking_analytics",
];

const COPY_BANNED = [
  /you matched with/i,
  /dating/i,
  /super like/i,
  /swipe right/i,
  /❤️|💕|💘/,
];

const COPY_FILES = [
  "app/matching/index.tsx",
  "app/matching/matches.tsx",
  "app/matching-settings.tsx",
  "components/TrainingMatchModal.tsx",
  "components/TrainingMatchRow.tsx",
  "components/TrainingPartnerCard.tsx",
  "components/TrainingPartnerDeckSafety.tsx",
  "lib/product-analytics.ts",
  "components/FrennixNotificationRow.tsx",
  "app/notifications.tsx",
  "packages/api/src/notifications.ts",
];

function checkMigrationsExist() {
  for (const file of REQUIRED_MIGRATIONS) {
    const path = join(SUPABASE, file);
    if (existsSync(path)) {
      pass(`MIG-${file}`, "Backend", `Migration file present: ${file}`);
    } else {
      fail(`MIG-${file}`, "Backend", `Missing migration: ${file}`);
    }
  }
}

function checkRpcsInMigrations() {
  const { readdirSync } = require("node:fs") as typeof import("node:fs");
  const allMigrationFiles = readdirSync(SUPABASE).filter((f: string) => f.endsWith(".sql"));
  const sql = allMigrationFiles
    .map((f: string) => readFileSync(join(SUPABASE, f), "utf8"))
    .join("\n");

  for (const rpc of REQUIRED_RPCS) {
    if (sql.includes(rpc)) {
      pass(`RPC-${rpc}`, "Backend", `RPC/trigger referenced in migrations: ${rpc}`);
    } else {
      fail(`RPC-${rpc}`, "Backend", `RPC/trigger not found in checked migrations: ${rpc}`);
    }
  }
}

function checkCopyAudit() {
  for (const rel of COPY_FILES) {
    const path = join(MOBILE, rel);
    if (!existsSync(path)) {
      fail(`COPY-${rel}`, "Copy", `File missing: ${rel}`);
      continue;
    }
    const content = readFileSync(path, "utf8");
    const hit = COPY_BANNED.find((re) => re.test(content));
    if (hit) {
      fail(`COPY-${rel}`, "Copy", `Banned pattern ${hit} in ${rel}`);
    } else {
      pass(`COPY-${rel}`, "Copy", `No banned dating/romance copy in ${rel}`);
    }
  }
}

function checkBrandingImports() {
  const files = ["app/matching/index.tsx", "app/matching/matches.tsx", "app/matching-settings.tsx"];
  for (const rel of files) {
    const content = readFileSync(join(MOBILE, rel), "utf8");
    if (content.includes("FrennixLogo")) {
      pass(`BRAND-${rel}`, "Branding", `FrennixLogo used in ${rel}`);
    } else {
      fail(`BRAND-${rel}`, "Branding", `FrennixLogo missing in ${rel}`);
    }
  }
}

function checkRemoteMigrations() {
  try {
    const out = execSync("supabase migration list", { cwd: MOBILE, encoding: "utf8" });
    const unsynced = out
      .split("\n")
      .filter((l) => /^\s+\d{14}\s+\|/.test(l))
      .filter((l) => {
        const [local, remote] = l.split("|").map((p) => p.trim());
        return local !== remote;
      });
    if (unsynced.length === 0) {
      pass("REMOTE-MIG", "Deploy", "All local migrations applied to remote Supabase");
    } else {
      fail("REMOTE-MIG", "Deploy", `Unsynced migrations: ${unsynced.join("; ")}`);
    }
  } catch (e) {
    fail("REMOTE-MIG", "Deploy", `Could not run supabase migration list: ${e}`);
  }
}

function checkSendPushDeployed() {
  try {
    const out = execSync("supabase functions list", { cwd: MOBILE, encoding: "utf8" });
    if (/send-push.*ACTIVE/i.test(out.replace(/\n/g, " "))) {
      pass("FN-SEND-PUSH", "Deploy", "send-push edge function ACTIVE on remote");
    } else {
      fail("FN-SEND-PUSH", "Deploy", "send-push not ACTIVE on remote");
    }
  } catch (e) {
    fail("FN-SEND-PUSH", "Deploy", `Could not list functions: ${e}`);
  }
}

function checkSecurityDocs() {
  const securityDoc = join(MOBILE, "features/matching/SECURITY.md");
  const productionDoc = join(MOBILE, "features/matching/PRODUCTION.md");
  if (existsSync(securityDoc)) {
    pass("DOC-SECURITY", "Docs", "SECURITY.md present");
  } else {
    fail("DOC-SECURITY", "Docs", "Missing features/matching/SECURITY.md");
  }
  if (existsSync(productionDoc)) {
    pass("DOC-PRODUCTION", "Docs", "PRODUCTION.md present");
  } else {
    fail("DOC-PRODUCTION", "Docs", "Missing features/matching/PRODUCTION.md");
  }

  const prodMigration = readFileSync(join(SUPABASE, "20250626000001_production_readiness.sql"), "utf8");
  if (prodMigration.includes("Users view own swipes") && prodMigration.includes("expire-stale-presence")) {
    pass("SEC-SWIPES-RLS", "Security", "Production migration hardens match_swipes + schedules presence cron");
  } else {
    fail("SEC-SWIPES-RLS", "Security", "Production migration missing expected security/cron changes");
  }
}

function registerManualChecks() {
  const manualChecks: [string, string, string][] = [
    ["MM-01", "Matchmaking", "Two-account mutual Connect creates match for both users"],
    ["MM-02", "Matchmaking", "One-way Connect does not create match or notification"],
    ["MM-03", "Matchmaking", "Skip removes candidate without match row"],
    ["MM-04", "Matchmaking", "Matched users excluded from each other's decks"],
    ["MM-05", "Matchmaking", "Profile readiness gate blocks incomplete profiles"],
    ["ML-01", "Matches list", "Unread-first sort and badges"],
    ["ML-02", "Matches list", "Remove training match with confirm dialog"],
    ["ML-03", "Matches list", "Open chat creates or reuses conversation"],
    ["NT-01", "Notifications", "In-app match notification with fitness copy"],
    ["NT-02", "Notifications", "Tap match notification opens chat"],
    ["NT-03", "Notifications", "Training partner message notification copy"],
    ["PU-01", "Push", "iOS push on backgrounded app — match"],
    ["PU-02", "Push", "iOS push on backgrounded app — partner message"],
    ["PU-03", "Push", "Android push delivery and tap deep link"],
    ["PU-04", "Push", "Notification settings permission banner"],
    ["PU-05", "Push", "Training matches toggle disables match push"],
    ["PR-01", "Presence", "Online within one heartbeat after login"],
    ["PR-02", "Presence", "Background → offline within debounce threshold"],
    ["PR-03", "Presence", "Training matches presence updates via realtime"],
    ["SF-01", "Safety", "Block removes user from deck and training matches"],
    ["SF-02", "Safety", "Block auto-unmatches active training match"],
    ["SF-03", "Safety", "Unblock does not rematch"],
    ["XP-01", "Cross-platform", "Web discovery + matches smoke test"],
    ["XP-02", "Cross-platform", "iOS native full flow"],
    ["XP-03", "Cross-platform", "Android native full flow"],
  ];

  for (const [id, area, detail] of manualChecks) {
    manual(id, area, detail);
  }
}

checkMigrationsExist();
checkRpcsInMigrations();
checkCopyAudit();
checkBrandingImports();
checkRemoteMigrations();
checkSendPushDeployed();
checkSecurityDocs();
registerManualChecks();

const passCount = results.filter((r) => r.status === "PASS").length;
const failCount = results.filter((r) => r.status === "FAIL").length;
const manualCount = results.filter((r) => r.status === "MANUAL").length;

console.log("\n# Frennix Matchmaking QA — Automated Run\n");
console.log(`PASS: ${passCount}  FAIL: ${failCount}  MANUAL (device): ${manualCount}\n`);

for (const r of results) {
  console.log(`[${r.status.padEnd(6)}] ${r.id} — ${r.detail}`);
}

if (failCount > 0) {
  process.exitCode = 1;
}
