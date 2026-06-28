import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getSupabase,
  initSupabase,
  isSupabaseInitialized,
  getMessages,
  subscribeToMessages,
  uploadMessageMedia,
} from "@frennix/api";

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const envPath = join(mobileRoot, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1).replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  loadEnv();

  console.log("1. getSupabase() throws before initSupabase()");
  let threw = false;
  try {
    getSupabase();
  } catch (error) {
    threw = true;
    assert(
      error instanceof Error && error.message.includes("Supabase not initialized"),
      `Unexpected error: ${String(error)}`
    );
  }
  assert(threw, "Expected getSupabase() to throw before initialization");

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  assert(url && key, "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env");

  console.log("2. initSupabase() completes before any API call");
  initSupabase(url, key);
  assert(isSupabaseInitialized(), "isSupabaseInitialized() should be true after init");
  assert(getSupabase(), "getSupabase() should return client after init");

  console.log("3. subscribeToMessages() works after init");
  const subscription = subscribeToMessages("00000000-0000-0000-0000-000000000001", () => undefined);
  assert(subscription.ok, "subscribeToMessages should succeed after init");
  assert(typeof subscription.unsubscribe === "function", "subscribeToMessages should return unsubscribe");
  subscription.unsubscribe();

  console.log("3b. duplicate presence subscriptions do not throw");
  const { subscribeToProfilesPresence } = await import("@frennix/api");
  const partnerId = "00000000-0000-0000-0000-000000000099";
  const presenceA = subscribeToProfilesPresence([partnerId], () => undefined);
  const presenceB = subscribeToProfilesPresence([partnerId], () => undefined);
  assert(presenceA.ok && presenceB.ok, "duplicate presence subscriptions should both succeed");
  presenceA.unsubscribe();
  presenceB.unsubscribe();

  console.log("4. getMessages() reaches Supabase after init");
  const messages = await getMessages("00000000-0000-0000-0000-000000000001");
  assert(Array.isArray(messages), "getMessages should return an array after init");

  console.log("5. uploadMessageMedia() is callable after init");
  let uploadError: unknown = null;
  try {
    await uploadMessageMedia(
      "00000000-0000-0000-0000-000000000099",
      "file:///tmp/nonexistent-frennix-test.jpg",
      "image/jpeg"
    );
  } catch (error) {
    uploadError = error;
  }
  assert(uploadError, "uploadMessageMedia with fake URI should fail at fetch/upload, not init");
  assert(
    !String(uploadError).includes("Supabase not initialized"),
    `uploadMessageMedia failed with init error: ${String(uploadError)}`
  );

  console.log("6. initSupabase() is idempotent");
  initSupabase(url, key);
  assert(isSupabaseInitialized(), "Repeated initSupabase() keeps client ready");

  console.log("\nAll Supabase initialization checks passed.");
}

main().catch((error) => {
  console.error("\nVerification failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
