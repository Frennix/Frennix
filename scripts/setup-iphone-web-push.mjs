#!/usr/bin/env node
/**
 * One-time setup for iPhone PWA Web Push.
 * Generates VAPID keys (web-push format), updates .env, sets Supabase secrets.
 *
 * Run: npm run setup:iphone-web-push
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");

function upsertEnv(key, value) {
  const line = `${key}=${value}`;
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, `${line}\n`, "utf8");
    return;
  }
  const content = fs.readFileSync(envPath, "utf8");
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(content)) {
    fs.writeFileSync(envPath, content.replace(pattern, line), "utf8");
  } else {
    fs.writeFileSync(envPath, `${content.trimEnd()}\n${line}\n`, "utf8");
  }
}

function readEnvKey(key) {
  if (!fs.existsSync(envPath)) return "";
  const match = fs.readFileSync(envPath, "utf8").match(new RegExp(`^${key}=(.*)$`, "m"));
  return match?.[1]?.trim() ?? "";
}

function parseVapidOutput(output) {
  const publicMatch = output.match(/Public Key:\s*\n([A-Za-z0-9_-]+)/);
  const privateMatch = output.match(/Private Key:\s*\n([A-Za-z0-9_-]+)/);
  if (!publicMatch || !privateMatch) {
    throw new Error("Failed to parse VAPID keys from web-push output");
  }
  return { publicKey: publicMatch[1], privateKey: privateMatch[1] };
}

let publicKey = readEnvKey("EXPO_PUBLIC_VAPID_PUBLIC_KEY");
let privateKey = readEnvKey("VAPID_PRIVATE_KEY");

if (!publicKey || !privateKey) {
  const output = execSync("npx --yes web-push generate-vapid-keys", {
    cwd: root,
    encoding: "utf8",
  });
  const keys = parseVapidOutput(output);
  publicKey = keys.publicKey;
  privateKey = keys.privateKey;
  console.log("[setup] Generated VAPID keys via web-push");
} else {
  console.log("[setup] Reusing existing VAPID keys from .env");
}

upsertEnv("EXPO_PUBLIC_VAPID_PUBLIC_KEY", publicKey);
upsertEnv("VAPID_PRIVATE_KEY", privateKey);
upsertEnv("VAPID_SUBJECT", readEnvKey("VAPID_SUBJECT") || "mailto:hello@frennix.app");

console.log("\n[setup] Wrote EXPO_PUBLIC_VAPID_PUBLIC_KEY to .env");

try {
  execSync(`supabase secrets set VAPID_PUBLIC_KEY="${publicKey}"`, { cwd: root, stdio: "inherit" });
  execSync(`supabase secrets set VAPID_PRIVATE_KEY="${privateKey}"`, { cwd: root, stdio: "inherit" });
  execSync('supabase secrets set VAPID_SUBJECT="mailto:hello@frennix.app"', {
    cwd: root,
    stdio: "inherit",
  });
  console.log("[setup] Supabase secrets set");
} catch {
  console.warn("[setup] Run supabase secrets set manually if auto-set failed.");
}

console.log("\nNext:");
console.log("  supabase db push");
console.log("  supabase functions deploy send-push");
console.log("  supabase functions deploy retry-notification-deliveries");
console.log("  npm run build:web");
console.log("  deploy dist/ to production");
