/**
 * Verify Challenges & Accountability wiring.
 *
 * Usage: node scripts/verify-challenges-accountability.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function mustInclude(file, ...needles) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) throw new Error(`Missing file: ${file}`);
  const text = fs.readFileSync(abs, "utf8");
  for (const needle of needles) {
    if (!text.includes(needle)) {
      throw new Error(`${file} must include: ${needle}`);
    }
  }
}

function main() {
  mustInclude(
    "supabase/migrations/20260708180000_challenges_accountability.sql",
    "challenge_type",
    "challenge_check_ins",
    "get_challenge_hub",
    "get_challenge_leaderboard",
    "submit_challenge_check_in",
    "join_challenge_safe",
    "send_challenge_encouragement",
    "challenge_user_badges"
  );

  mustInclude(
    "packages/types/src/index.ts",
    "ChallengeType",
    "ChallengeHubData",
    "ChallengeLeaderboard",
    "ChallengeCheckInResult"
  );

  mustInclude(
    "packages/api/src/challenges.ts",
    "getChallengeHub",
    "getChallengesPage",
    "submitChallengeCheckIn",
    "getChallengeLeaderboard",
    "getMyChallengeProgress",
    "encourageTeammate",
    "subscribeChallengeLeaderboard",
    "join_challenge_safe"
  );

  mustInclude(
    "app/challenges/index.tsx",
    "Challenge Hub",
    "getChallengeHub",
    "getChallengesPage",
    "useInfiniteQuery"
  );

  mustInclude(
    "app/challenge/[id].tsx",
    "ChallengeLeaderboard",
    "submitChallengeCheckIn",
    "ChallengeProgressBar",
    "subscribeChallengeLeaderboard",
    "leaderboard"
  );

  mustInclude(
    "app/create-challenge.tsx",
    "CHALLENGE_TYPE_OPTIONS",
    "challenge_type"
  );

  mustInclude(
    "components/ChallengeLeaderboard.tsx",
    "onEncourage",
    "viewerRank"
  );

  mustInclude(
    "lib/challenge-types.ts",
    "running",
    "workout_streak",
    "custom"
  );

  mustInclude(
    "packages/notifications/src/copy.ts",
    "Team encouragement",
    "challenge_progress"
  );

  console.log("verify-challenges-accountability: PASS");
}

try {
  main();
} catch (err) {
  console.error("verify-challenges-accountability: FAIL");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
