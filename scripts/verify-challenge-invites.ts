/**
 * Static checks for challenge invite MVP.
 * Run: npx tsx scripts/verify-challenge-invites.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function read(path: string) {
  return readFileSync(join(ROOT, path), "utf8");
}

const checks = [
  {
    name: "challenge_invitations migration exists",
    run: () => {
      if (!existsSync(join(ROOT, "supabase/migrations/20250630000009_challenge_invitations.sql"))) {
        throw new Error("missing migration");
      }
      const sql = read("supabase/migrations/20250630000009_challenge_invitations.sql");
      if (!sql.includes("notify_on_challenge_invite")) throw new Error("missing notify trigger");
      if (!sql.includes("'challenge_invite'")) throw new Error("missing notification type");
    },
  },
  {
    name: "challenge invite screen and API wired",
    run: () => {
      if (!existsSync(join(ROOT, "app/challenge/[id]/invite.tsx"))) throw new Error("missing invite screen");
      const api = read("packages/api/src/challenges.ts");
      if (!api.includes("inviteToChallenge")) throw new Error("missing inviteToChallenge");
      if (!api.includes("getChallengeInviteCandidates")) throw new Error("missing invite candidates");
    },
  },
  {
    name: "notification routing for challenge_invite",
    run: () => {
      const nav = read("lib/notification-navigation.ts");
      if (!nav.includes("challenge_invite")) throw new Error("missing nav route");
      const types = read("packages/types/src/index.ts");
      if (!types.includes('"challenge_invite"')) throw new Error("missing NotificationType");
    },
  },
  {
    name: "Share Challenge sheet and helpers exist",
    run: () => {
      if (!existsSync(join(ROOT, "components/ShareChallengeSheet.tsx"))) {
        throw new Error("missing ShareChallengeSheet");
      }
      const share = read("lib/share-challenge.ts");
      if (!share.includes("native_share")) throw new Error("missing native share");
      if (!share.includes("copy_link")) throw new Error("missing copy link");
      const detail = read("app/challenge/[id].tsx");
      if (!detail.includes("Share Challenge")) throw new Error("missing Share Challenge button");
    },
  },
  {
    name: "Invite status labels and closed-challenge guard",
    run: () => {
      const invite = read("app/challenge/[id]/invite.tsx");
      if (!invite.includes('"Joined"') || !invite.includes('"Invited"') || !invite.includes('"Pending"')) {
        throw new Error("missing invite status labels");
      }
      if (!invite.includes("isChallengeClosed")) throw new Error("missing closed challenge guard");
    },
  },
];

for (const check of checks) {
  try {
    check.run();
    console.log(`PASS  ${check.name}`);
  } catch (error) {
    console.error(`FAIL  ${check.name}: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

console.log(`\nAll ${checks.length} challenge invite checks passed.`);
