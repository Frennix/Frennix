#!/usr/bin/env node
/**
 * Verify push notification deep links for core event types.
 * Run: node scripts/verify-push-deep-links.mjs
 */

import { buildDeepLink } from "../packages/notifications/src/deep-links.ts";

const CASES = [
  {
    name: "Direct message",
    type: "message",
    payload: { conversation_id: "conv-1" },
    expected: "/chat/conv-1",
  },
  {
    name: "Like",
    type: "like",
    payload: { post_id: "post-1" },
    expected: "/post/post-1",
  },
  {
    name: "Comment",
    type: "comment",
    payload: { post_id: "post-1", comment_id: "comment-1" },
    expected: "/post/post-1?commentId=comment-1",
  },
  {
    name: "Follower",
    type: "follow",
    payload: { follower_id: "user-1" },
    actorUsername: "athlete1",
    expected: "/user/athlete1",
  },
  {
    name: "Training match",
    type: "match",
    payload: { conversation_id: "conv-2" },
    expected: "/chat/conv-2",
  },
  {
    name: "Event invite",
    type: "event_invite",
    payload: { event_id: "event-1" },
    expected: "/event/event-1",
  },
  {
    name: "Story mention",
    type: "story_mention",
    payload: { story_id: "story-1" },
    actorUsername: "athlete1",
    expected: "/user/athlete1?storyId=story-1",
  },
  {
    name: "Challenge update",
    type: "challenge_reminder",
    payload: { challenge_id: "challenge-1" },
    expected: "/challenge/challenge-1",
  },
];

let failed = 0;

for (const test of CASES) {
  const href = buildDeepLink({
    type: test.type,
    payload: test.payload,
    actorUsername: test.actorUsername,
  });
  if (href !== test.expected) {
    console.log(`FAIL ${test.name}: expected ${test.expected}, got ${href}`);
    failed += 1;
  } else {
    console.log(`OK ${test.name} → ${href}`);
  }
}

if (failed > 0) process.exit(1);
console.log(`\nDeep link verification: ${CASES.length - failed}/${CASES.length} passed`);
