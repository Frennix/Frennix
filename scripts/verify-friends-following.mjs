/**
 * Verify Friends & Following system wiring.
 *
 * Usage: node scripts/verify-friends-following.mjs
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
    "supabase/migrations/20260708200000_friends_following_social.sql",
    "friend_requests",
    "friendships",
    "profile_favorites",
    "send_friend_request",
    "respond_friend_request",
    "get_profile_social_context",
    "get_people_you_may_know",
    "profile_matches_discover_query",
    "pg_trgm",
    "friend_accepted",
    "profile_favorited",
    "mutual_friend_joined"
  );

  mustInclude(
    "packages/types/src/index.ts",
    "ProfileSocialContext",
    "FriendStatus",
    "friends: number"
  );

  mustInclude(
    "packages/api/src/friends.ts",
    "sendFriendRequest",
    "getProfileSocialContext",
    "setProfileFavorite",
    "getPeopleYouMayKnow"
  );

  mustInclude("packages/api/src/index.ts", "./friends");

  mustInclude(
    "components/ProfileScreenContent.tsx",
    "Friends",
    "Shared Interests",
    "mutual friend"
  );

  mustInclude("app/friend-requests.tsx", "getFriendRequestsPage");
  mustInclude("app/friends/[userId].tsx", "getFriendsPage");
  mustInclude("app/mutual-friends/[userId].tsx", "getMutualFriendsPage");
  mustInclude("app/user/[username].tsx", "getProfileSocialContext");
  mustInclude("lib/useFriendUser.ts", "addFriendDirect");
  mustInclude("lib/useProfileActions.tsx", "muteUser");
  mustInclude("lib/discover-people.ts", "peopleYouMayKnow");
  mustInclude("lib/discover-people.ts", "trendingAthletes");

  mustInclude(
    "packages/notifications/src/copy.ts",
    "friend_accepted",
    "profile_favorited"
  );

  mustInclude("docs/FRIENDS_FOLLOWING.md", "Beta Readiness Checklist");

  console.log("verify-friends-following: PASS");
}

main();
