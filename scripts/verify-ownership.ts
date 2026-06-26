/**
 * Static verification for the Frennix platform ownership framework.
 * Run: pnpm verify:ownership
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { EntityActionId } from "../lib/entity-actions";
import { CHALLENGE_OWNER_ACTIONS, CHALLENGE_VIEWER_ACTIONS } from "../lib/challenge-actions";
import { COMMENT_OWNER_ACTIONS, COMMENT_VIEWER_ACTIONS } from "../lib/comment-actions";
import { EVENT_OWNER_ACTIONS, EVENT_VIEWER_ACTIONS } from "../lib/event-actions";
import { GROUP_OWNER_ACTIONS, GROUP_VIEWER_ACTIONS } from "../lib/group-actions";
import { POST_OWNER_ACTIONS, POST_VIEWER_ACTIONS } from "../lib/post-actions";
import { PROFILE_OWNER_ACTIONS, PROFILE_VIEWER_ACTIONS } from "../lib/profile-actions";
import { OWNERSHIP_CONTENT_REGISTRY } from "../lib/ownership/content-types";

const ROOT = join(import.meta.dirname, "..");

const OWNER_FORBIDDEN: EntityActionId[] = ["report", "block"];
const VIEWER_FORBIDDEN: EntityActionId[] = ["edit", "delete", "cancel", "close_early", "invite"];

type EntityMenu = {
  name: string;
  owner: EntityActionId[];
  viewer: EntityActionId[];
  ownerRequired?: EntityActionId[];
  ownerForbidden?: EntityActionId[];
  viewerRequired?: EntityActionId[];
};

const ENTITIES: EntityMenu[] = [
  {
    name: "post",
    owner: POST_OWNER_ACTIONS.map((a) => a.id),
    viewer: POST_VIEWER_ACTIONS.map((a) => a.id),
    ownerRequired: ["edit", "delete", "share", "copy_link"],
    viewerRequired: ["share", "copy_link", "report", "block"],
  },
  {
    name: "challenge",
    owner: CHALLENGE_OWNER_ACTIONS.map((a) => a.id),
    viewer: CHALLENGE_VIEWER_ACTIONS.map((a) => a.id),
    ownerRequired: ["edit", "delete", "share", "copy_link", "view_participants"],
    viewerRequired: ["share", "copy_link", "report", "block"],
  },
  {
    name: "event",
    owner: EVENT_OWNER_ACTIONS.map((a) => a.id),
    viewer: EVENT_VIEWER_ACTIONS.map((a) => a.id),
    ownerRequired: ["edit", "cancel", "share", "copy_link", "view_participants"],
    viewerRequired: ["share", "copy_link", "report", "block"],
  },
  {
    name: "group",
    owner: GROUP_OWNER_ACTIONS.map((a) => a.id),
    viewer: GROUP_VIEWER_ACTIONS.map((a) => a.id),
    ownerRequired: ["edit", "delete", "share", "copy_link", "view_participants"],
    viewerRequired: ["share", "copy_link", "report", "block"],
  },
  {
    name: "comment",
    owner: COMMENT_OWNER_ACTIONS.map((a) => a.id),
    viewer: COMMENT_VIEWER_ACTIONS.map((a) => a.id),
    ownerRequired: ["edit", "delete", "share", "copy_link"],
    viewerRequired: ["share", "copy_link", "report", "block"],
  },
  {
    name: "profile",
    owner: PROFILE_OWNER_ACTIONS.map((a) => a.id),
    viewer: PROFILE_VIEWER_ACTIONS.map((a) => a.id),
    ownerRequired: ["edit", "share", "copy_link"],
    ownerForbidden: ["delete"],
    viewerRequired: ["share", "copy_link", "report", "block"],
  },
];

const EDIT_GUARDS: { file: string; pattern: RegExp }[] = [
  { file: "app/edit-post/[id].tsx", pattern: /author_id\s*!==\s*userId/ },
  { file: "app/edit-challenge/[id].tsx", pattern: /created_by\s*!==\s*userId/ },
  { file: "app/edit-event/[id].tsx", pattern: /created_by\s*!==\s*userId/ },
  { file: "app/edit-group/[id].tsx", pattern: /owner_id\s*!==\s*userId/ },
];

const HOOK_FILES = [
  "lib/usePostActions.tsx",
  "lib/useChallengeActions.tsx",
  "lib/useEventActions.tsx",
  "lib/useGroupActions.tsx",
  "lib/useCommentActions.tsx",
  "lib/useProfileActions.tsx",
];

const REPORT_FUNCTIONS = [
  "reportPost",
  "reportComment",
  "reportUser",
  "reportChallenge",
  "reportEvent",
  "reportGroup",
];

function assertIncludes(label: string, ids: EntityActionId[], required: EntityActionId[]) {
  for (const id of required) {
    if (!ids.includes(id)) {
      throw new Error(`${label} missing required action: ${id}`);
    }
  }
}

function assertExcludes(label: string, ids: EntityActionId[], forbidden: EntityActionId[]) {
  for (const id of forbidden) {
    if (ids.includes(id)) {
      throw new Error(`${label} must not include action: ${id}`);
    }
  }
}

function verifyMenus() {
  for (const entity of ENTITIES) {
    assertIncludes(`${entity.name} owner`, entity.owner, entity.ownerRequired ?? []);
    assertIncludes(`${entity.name} viewer`, entity.viewer, entity.viewerRequired ?? []);
    assertExcludes(`${entity.name} owner`, entity.owner, [
      ...OWNER_FORBIDDEN,
      ...(entity.ownerForbidden ?? []),
    ]);
    assertExcludes(`${entity.name} viewer`, entity.viewer, VIEWER_FORBIDDEN);
  }
  console.log("✓ Owner/viewer menus consistent for all live entities");
}

function verifyRegistry() {
  const live = OWNERSHIP_CONTENT_REGISTRY.filter((entry) => entry.status === "live");
  for (const entry of live) {
    if (entry.registry && !existsSync(join(ROOT, entry.registry))) {
      throw new Error(`Registry file missing: ${entry.registry}`);
    }
    if (entry.hook && !existsSync(join(ROOT, entry.hook))) {
      throw new Error(`Hook file missing: ${entry.hook}`);
    }
    if (entry.link && !existsSync(join(ROOT, entry.link))) {
      throw new Error(`Link helper missing: ${entry.link}`);
    }
  }
  console.log(`✓ Content registry complete (${live.length} live types)`);
}

function verifyHooks() {
  for (const file of HOOK_FILES) {
    const path = join(ROOT, file);
    const source = readFileSync(path, "utf8");
    if (!source.includes("EntityActionSheet")) {
      throw new Error(`${file} must render EntityActionSheet`);
    }
    if (!source.includes("ReportReasonSheet")) {
      throw new Error(`${file} must render ReportReasonSheet for viewer report flow`);
    }
    if (!source.includes("ownershipMessages")) {
      throw new Error(`${file} must use ownershipMessages for success/error copy`);
    }
  }
  console.log("✓ All ownership hooks use EntityActionSheet + ownershipMessages");
}

function verifyEditGuards() {
  for (const { file, pattern } of EDIT_GUARDS) {
    const path = join(ROOT, file);
    const source = readFileSync(path, "utf8");
    if (!pattern.test(source)) {
      throw new Error(`${file} missing owner guard (${pattern})`);
    }
  }
  console.log("✓ Edit routes guard non-owners");
}

function verifyModerationApi() {
  const source = readFileSync(join(ROOT, "packages/api/src/moderation.ts"), "utf8");
  for (const fn of REPORT_FUNCTIONS) {
    if (!source.includes(`export async function ${fn}`)) {
      throw new Error(`moderation.ts missing ${fn}`);
    }
  }
  if (!source.includes("reported_group_id")) {
    throw new Error("moderation.ts missing reported_group_id support");
  }
  if (!source.includes("reported_event_id")) {
    throw new Error("moderation.ts missing reported_event_id support");
  }
  if (!source.includes("reported_challenge_id")) {
    throw new Error("moderation.ts missing reported_challenge_id support");
  }
  console.log("✓ Moderation API covers all reportable content types");
}

function verifyMigrations() {
  const required = [
    "20250630000001_challenge_management.sql",
    "20250630000002_challenge_reports.sql",
    "20250630000003_event_reports.sql",
    "20250630000004_group_management.sql",
    "20250630000005_comment_edit.sql",
  ];
  for (const file of required) {
    if (!existsSync(join(ROOT, "supabase/migrations", file))) {
      throw new Error(`Missing migration: ${file}`);
    }
  }
  console.log("✓ Ownership RLS migrations present");
}

function verifyListCacheHelpers() {
  const source = readFileSync(join(ROOT, "lib/entity-list-cache.ts"), "utf8");
  for (const fn of [
    "removeChallengeFromLists",
    "removeGroupFromLists",
    "removeEventFromLists",
  ]) {
    if (!source.includes(fn)) {
      throw new Error(`entity-list-cache.ts missing ${fn}`);
    }
  }
  console.log("✓ Optimistic list cache helpers present");
}

function main() {
  verifyMenus();
  verifyRegistry();
  verifyHooks();
  verifyEditGuards();
  verifyModerationApi();
  verifyMigrations();
  verifyListCacheHelpers();
  console.log("\nOwnership framework verification passed.");
}

main();
