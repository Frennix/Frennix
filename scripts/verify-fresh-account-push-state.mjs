#!/usr/bin/env node
/**
 * Create a fresh test account and verify it has no push subscription.
 * Run: node scripts/verify-fresh-account-push-state.mjs
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

const env = loadEnv();
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const email = `push-beta-${Date.now()}@frennix.test`;
const password = `BetaTest-${Date.now()}-Push!`;

const admin = createClient(url, anonKey, { auth: { persistSession: false } });

console.log(`Creating fresh account: ${email}`);

const { data: signUp, error: signUpError } = await admin.auth.signUp({
  email,
  password,
  options: { data: { display_name: "Push Beta Test" } },
});

if (signUpError || !signUp.user) {
  console.error("Sign up failed:", signUpError?.message ?? "no user");
  process.exit(1);
}

const userId = signUp.user.id;
console.log(`OK user created: ${userId}`);

const userClient = createClient(url, anonKey, { auth: { persistSession: false } });
const { error: signInError } = await userClient.auth.signInWithPassword({ email, password });
if (signInError) {
  console.error("Sign in failed:", signInError.message);
  process.exit(1);
}

const { data: subs, error: subsError } = await userClient
  .from("notification_subscriptions")
  .select("id, channel, enabled")
  .eq("user_id", userId);

if (subsError) {
  console.error("Subscription query failed:", subsError.message);
  process.exit(1);
}

const webPushSubs = (subs ?? []).filter((s) => s.channel === "web_push");
if (webPushSubs.length > 0) {
  console.error(`FAIL: fresh account already has ${webPushSubs.length} web_push subscription(s)`);
  process.exit(1);
}

const { data: prefs, error: prefsError } = await userClient
  .from("notification_preferences")
  .select("push_enabled")
  .eq("user_id", userId)
  .maybeSingle();

if (prefsError) {
  console.error("Preferences query failed:", prefsError.message);
  process.exit(1);
}

console.log(`OK web_push subscriptions: 0`);
console.log(`OK push_enabled preference: ${prefs?.push_enabled ?? "not set (default)"}`);
console.log(`\nFresh account ready for iPhone PWA test:`);
console.log(`  Email:    ${email}`);
console.log(`  Password: ${password}`);
console.log(`  User ID:  ${userId}`);
console.log(`\nManual steps on iPhone (Home Screen PWA):`);
console.log(`  1. Sign in with credentials above`);
console.log(`  2. Settings → Notifications → tap Enable Notifications`);
console.log(`  3. Allow iOS permission → confirm status shows Enabled`);
console.log(`  4. Run: node scripts/verify-live-push-events.mjs ${userId}`);
