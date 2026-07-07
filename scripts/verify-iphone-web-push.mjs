#!/usr/bin/env node
/**
 * Verify iPhone Web Push readiness for a user (by email).
 * Run: node scripts/verify-iphone-web-push.mjs your@email.com
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");

function loadEnv() {
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    out[line.slice(0, idx)] = line.slice(idx + 1).trim();
  }
  return out;
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/verify-iphone-web-push.mjs <your-email>");
  process.exit(1);
}

const env = loadEnv();
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  console.error("Add SUPABASE_SERVICE_ROLE_KEY to .env locally (never commit) to run verification.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const { data: users, error: userError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (userError) throw userError;

const user = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`No auth user found for ${email}`);
  process.exit(1);
}

console.log(`User: ${user.email} (${user.id})`);

const { data: flag } = await supabase
  .from("feature_flags")
  .select("enabled_globally")
  .eq("key", "web_push_notifications")
  .maybeSingle();

const { data: flagRpc } = await supabase.rpc("evaluate_feature_flag_for_user", {
  p_key: "web_push_notifications",
  p_user_id: user.id,
});

console.log(`web_push_notifications global: ${flag?.enabled_globally ? "ON" : "OFF"}`);
console.log(`web_push_notifications for user: ${flagRpc ? "ON" : "OFF"}`);

const { data: subs } = await supabase
  .from("notification_subscriptions")
  .select("id, channel, enabled, endpoint, last_seen_at, created_at")
  .eq("user_id", user.id)
  .eq("channel", "web_push");

console.log(`web_push subscriptions: ${subs?.length ?? 0}`);
for (const sub of subs ?? []) {
  console.log(`  - ${sub.id} enabled=${sub.enabled} last_seen=${sub.last_seen_at ?? "never"}`);
}

const { data: deliveries } = await supabase
  .from("notification_deliveries")
  .select("id, channel, status, skip_reason, error_message, sent_at, created_at")
  .eq("channel", "web_push")
  .order("created_at", { ascending: false })
  .limit(5);

console.log(`recent web_push deliveries (latest 5 for any user):`);
for (const row of deliveries ?? []) {
  console.log(`  - ${row.status} ${row.skip_reason ?? ""} ${row.error_message ?? ""}`);
}

const vapidPublic = env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
console.log(`EXPO_PUBLIC_VAPID_PUBLIC_KEY configured: ${vapidPublic ? "yes" : "NO"}`);

if (!subs?.length) {
  console.log("\nACTION: Open installed PWA on iPhone → enable notifications → subscription row required.");
}
if (!flagRpc) {
  console.log("\nACTION: Run supabase db push (migration 20260706000006 enables web push).");
}
if (!vapidPublic) {
  console.log("\nACTION: Run node scripts/setup-iphone-web-push.mjs");
}
