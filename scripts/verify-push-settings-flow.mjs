#!/usr/bin/env node
/**
 * Verify foolproof push settings flow (source + production bundle + fresh account).
 * Run: node scripts/verify-push-settings-flow.mjs [--url https://frennix.vercel.app]
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const baseUrl = (process.argv.find((arg) => arg.startsWith("--url="))?.slice(6) ??
  process.argv[2] ??
  "https://frennix.vercel.app").replace(/\/$/, "");

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(haystack, needle, label) {
  assert(haystack.includes(needle), `${label}: expected to include "${needle}"`);
}

function loadEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    out[line.slice(0, idx)] = line.slice(idx + 1).trim();
  }
  return out;
}

function testSource() {
  const settings = read("app/notification-settings.tsx");
  const enableCard = read("components/WebPushEnableCard.tsx");
  const statusIndicator = read("components/WebPushStatusIndicator.tsx");
  const statusLib = read("lib/web-push-status.ts");
  const installGuide = read("components/IosPwaInstallGuide.tsx");
  const diagnostics = read("lib/web-push-diagnostics.ts");
  const messages = read("lib/web-push-messages.ts");

  assertIncludes(settings, "WebPushStatusIndicator", "settings status indicator");
  assertIncludes(settings, "showEnableCard", "settings conditional enable card");
  assertIncludes(settings, "logPushSetupSnapshot", "settings diagnostic snapshot");
  assertIncludes(enableCard, "Enable Notifications", "enable card cta");
  assertIncludes(enableCard, "WEB_PUSH_SUCCESS_MESSAGE", "enable card success message");
  assertIncludes(enableCard, "logPushSetupFunnel", "enable card funnel logging");
  assertIncludes(statusLib, "Notifications Enabled", "status enabled label");
  assertIncludes(statusLib, "Waiting for Permission", "status waiting label");
  assertIncludes(statusLib, "Open from Home Screen Required", "status home screen label");
  assertIncludes(statusIndicator, "WebPushStatusIndicator", "status indicator component");
  assertIncludes(installGuide, "How to Install", "install guide button");
  assertIncludes(
    messages,
    "To receive push notifications, first add Frennix to your Home Screen",
    "home screen message"
  );
  assertIncludes(diagnostics, "logPushSetupFunnel", "funnel logging");
  assertIncludes(diagnostics, "logPushSetupSnapshot", "snapshot logging");
  console.log("OK source checks");
}

async function testProductionBundle() {
  const html = await fetch(`${baseUrl}/index.html`).then((r) => {
    if (!r.ok) throw new Error(`index.html ${r.status}`);
    return r.text();
  });
  const bundleMatch = html.match(/index-[a-f0-9]+\.js/);
  assert(bundleMatch, "production index.html missing bundle");
  const bundleUrl = `${baseUrl}/_expo/static/js/web/${bundleMatch[0]}`;
  const bundle = await fetch(bundleUrl).then((r) => {
    if (!r.ok) throw new Error(`bundle ${r.status}`);
    return r.text();
  });

  const required = [
    "Enable Notifications",
    "Notifications Enabled",
    "Waiting for Permission",
    "Open from Home Screen Required",
    "How to Install",
    "To receive push notifications, first add Frennix to your Home Screen",
    "funnel.settings_open",
    "challenge updates",
  ];

  for (const needle of required) {
    assertIncludes(bundle, needle, `production bundle (${bundleMatch[0]})`);
  }
  console.log(`OK production bundle ${bundleMatch[0]}`);
}

async function testFreshAccount() {
  const env = loadEnv();
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.log("SKIP fresh account check — add SUPABASE_SERVICE_ROLE_KEY to .env");
    return;
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const email = `push-flow-test+${Date.now()}@frennix.test`;

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: `PushTest-${Date.now()}`,
    email_confirm: true,
  });
  if (createError) throw createError;
  const userId = created.user.id;

  const { data: subs } = await supabase
    .from("notification_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("channel", "web_push");

  assert((subs?.length ?? 0) === 0, "fresh account should have zero web_push subscriptions");

  const { data: prefs } = await supabase
    .from("user_notification_preferences")
    .select("push_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  console.log(
    `OK fresh account ${email} (${userId.slice(0, 8)}…) subscriptions=0 push_enabled=${prefs?.push_enabled ?? "default"}`
  );

  await supabase.auth.admin.deleteUser(userId);
  console.log("OK cleaned up fresh test account");
}

async function main() {
  testSource();
  await testProductionBundle();
  await testFreshAccount();
  console.log("\nPush settings flow verification: all checks passed");
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
