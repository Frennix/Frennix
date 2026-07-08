#!/usr/bin/env node
/**
 * Verify live push pipeline for core Frennix event types.
 * Run: node scripts/verify-live-push-events.mjs <recipient-user-id>
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");

function loadEnv() {
  const out = {};
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const idx = line.indexOf("=");
      if (idx <= 0) continue;
      out[line.slice(0, idx)] = line.slice(idx + 1).trim();
    }
  }
  for (const key of ["EXPO_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "EXPO_PUBLIC_SUPABASE_ANON_KEY"]) {
    if (process.env[key]) out[key] = process.env[key];
  }
  return out;
}

const recipientId = process.argv[2];
if (!recipientId) {
  console.error("Usage: node scripts/verify-live-push-events.mjs <recipient-user-id>");
  process.exit(1);
}

const env = loadEnv();
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !serviceKey) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const ACTOR_ID = "54c6b173-ee3f-45c7-a530-656e50e3d95c";
const CONVERSATION_ID = "b172c1f6-7a3f-43ea-936e-9b9b5c895f45";
const POST_ID = "00000000-0000-4000-8000-000000000101";
const COMMENT_ID = "00000000-0000-4000-8000-000000000102";
const EVENT_ID = "00000000-0000-4000-8000-000000000103";
const MATCH_ID = "00000000-0000-4000-8000-000000000104";
const STORY_ID = "00000000-0000-4000-8000-000000000105";
const CHALLENGE_ID = "00000000-0000-4000-8000-000000000106";

const EVENTS = [
  {
    name: "New direct message",
    type: "message",
    title: "New message",
    body: "QA: direct message push",
    deep_link: `/chat/${CONVERSATION_ID}`,
    payload: {
      conversation_id: CONVERSATION_ID,
      sender_id: ACTOR_ID,
      message_id: "qa-msg-1",
      preview: "QA push test",
    },
    dedupe: `qa_push:message:${Date.now()}`,
    expectedDeepLinkPrefix: "/chat/",
  },
  {
    name: "Comment on a post",
    type: "comment",
    title: "New comment",
    body: "QA: comment push",
    deep_link: `/post/${POST_ID}?commentId=${COMMENT_ID}`,
    payload: { post_id: POST_ID, comment_id: COMMENT_ID, author_id: ACTOR_ID },
    dedupe: `qa_push:comment:${Date.now()}`,
    expectedDeepLinkPrefix: "/post/",
  },
  {
    name: "Like on a post",
    type: "like",
    title: "New like",
    body: "QA: like push",
    deep_link: `/post/${POST_ID}`,
    payload: { post_id: POST_ID, user_id: ACTOR_ID },
    dedupe: `qa_push:like:${Date.now()}`,
    expectedDeepLinkPrefix: "/post/",
  },
  {
    name: "New follower",
    type: "follow",
    title: "New follower",
    body: "QA: follow push",
    deep_link: "/user/qa_actor",
    payload: { follower_id: ACTOR_ID },
    dedupe: `qa_push:follow:${Date.now()}`,
    expectedDeepLinkPrefix: "/user/",
  },
  {
    name: "Training partner match",
    type: "match",
    title: "New Training Match",
    body: "QA: match push",
    deep_link: "/matching/matches",
    payload: { matched_user_id: ACTOR_ID, match_id: MATCH_ID },
    dedupe: `qa_push:match:${Date.now()}`,
    expectedDeepLinkPrefix: "/chat/",
    expectResolvedChat: true,
  },
  {
    name: "Event invitation",
    type: "event_invite",
    title: "Event invite",
    body: "QA: event invite push",
    deep_link: `/event/${EVENT_ID}`,
    payload: { event_id: EVENT_ID, inviter_id: ACTOR_ID },
    dedupe: `qa_push:event_invite:${Date.now()}`,
    expectedDeepLinkPrefix: "/event/",
  },
  {
    name: "Story mention (tag)",
    type: "story_mention",
    title: "Mentioned in a story",
    body: "QA: story mention push",
    deep_link: "/user/qa_actor",
    payload: { story_id: STORY_ID, mentioner_id: ACTOR_ID },
    dedupe: `qa_push:story_mention:${Date.now()}`,
    expectedDeepLinkPrefix: "/user/",
    note: "Post @mention in captions is not wired yet; story @mention is supported.",
  },
  {
    name: "Challenge update",
    type: "challenge_reminder",
    title: "Challenge update",
    body: "QA: challenge update push",
    deep_link: `/challenge/${CHALLENGE_ID}`,
    payload: { challenge_id: CHALLENGE_ID, actor_id: ACTOR_ID },
    dedupe: `qa_push:challenge:${Date.now()}`,
    expectedDeepLinkPrefix: "/challenge/",
  },
];

async function waitForDelivery(notificationId, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { data } = await supabase
      .from("notification_deliveries")
      .select("id, channel, status, skip_reason, error_message, sent_at")
      .eq("notification_id", notificationId)
      .eq("channel", "web_push")
      .maybeSingle();
    if (data) return data;
    await new Promise((r) => setTimeout(r, 800));
  }
  return null;
}

async function invokeDispatch(record) {
  const authKey = env.SUPABASE_SERVICE_ROLE_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const res = await fetch(`${url}/functions/v1/send-push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authKey}`,
    },
    body: JSON.stringify({ record }),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

console.log(`\nLive push event verification for user ${recipientId}\n`);

let passed = 0;
let failed = 0;

for (const event of EVENTS) {
  process.stdout.write(`• ${event.name} ... `);

  const { data: notificationId, error } = await supabase.rpc("create_notification", {
    p_user_id: recipientId,
    p_type: event.type,
    p_actor_id: ACTOR_ID,
    p_entity_type: "system",
    p_entity_id: recipientId,
    p_title: event.title,
    p_body: event.body,
    p_deep_link: event.deep_link,
    p_payload: event.payload,
    p_dedupe_key: event.dedupe,
  });

  if (error || !notificationId) {
    console.log(`FAIL (create: ${error?.message ?? "no id"})`);
    failed += 1;
    continue;
  }

  const { data: row } = await supabase
    .from("notifications")
    .select("*")
    .eq("id", notificationId)
    .maybeSingle();

  const dispatch = await invokeDispatch(row);
  if (dispatch.status !== 200) {
    console.log(`FAIL (dispatch HTTP ${dispatch.status})`);
    failed += 1;
    continue;
  }

  const delivery = await waitForDelivery(notificationId);
  if (!delivery) {
    console.log("FAIL (no web_push delivery row)");
    failed += 1;
    continue;
  }

  if (delivery.status !== "sent") {
    console.log(`FAIL (delivery ${delivery.status} ${delivery.skip_reason ?? delivery.error_message ?? ""})`);
    failed += 1;
    continue;
  }

  const { data: dupId } = await supabase.rpc("create_notification", {
    p_user_id: recipientId,
    p_type: event.type,
    p_actor_id: ACTOR_ID,
    p_entity_type: "system",
    p_entity_id: recipientId,
    p_title: event.title,
    p_body: event.body,
    p_deep_link: event.deep_link,
    p_payload: event.payload,
    p_dedupe_key: event.dedupe,
  });

  if (dupId) {
    console.log("FAIL (duplicate notification created)");
    failed += 1;
    continue;
  }

  if (event.expectResolvedChat) {
    const pushData = dispatch.json;
    if (!pushData?.anySent) {
      console.log("FAIL (match dispatch did not send)");
      failed += 1;
      continue;
    }
  }

  console.log(`OK (sent, dedupe blocked, deep_link ${event.deep_link})`);
  if (event.note) console.log(`  note: ${event.note}`);
  passed += 1;
}

console.log(`\nResult: ${passed}/${EVENTS.length} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
