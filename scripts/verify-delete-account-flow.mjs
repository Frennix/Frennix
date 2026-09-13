#!/usr/bin/env node
/**
 * Source-only checks for the in-app Delete Account flow.
 * Does not apply migrations, call RPCs, or delete any account.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(haystack, needle, label) {
  assert(haystack.includes(needle), `${label}: expected to include ${JSON.stringify(needle)}`);
}

function assertNotIncludes(haystack, needle, label) {
  assert(!haystack.includes(needle), `${label}: must not include ${JSON.stringify(needle)}`);
}

const migration = read("supabase/migrations/20260913120000_delete_own_account.sql");
const api = read("packages/api/src/account-deletion.ts");
const index = read("packages/api/src/index.ts");
const settings = read("app/settings.tsx");
const screen = read("app/delete-account.tsx");
const layout = read("app/_layout.tsx");
const alerts = read("lib/alerts.ts");

assertIncludes(migration, "CREATE OR REPLACE FUNCTION public.delete_own_account()", "migration function");
assertIncludes(migration, "SECURITY DEFINER", "migration definer");
assertIncludes(migration, "DELETE FROM storage.objects", "migration storage purge");
assertIncludes(migration, "DELETE FROM auth.users WHERE id = uid", "migration auth delete");
assertIncludes(migration, "GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated", "migration grant");
assertIncludes(migration, "REVOKE ALL ON FUNCTION public.delete_own_account() FROM anon", "migration revoke anon");
assertIncludes(migration, "FILE ONLY until a production rollout is explicitly approved", "migration stays unapplied");

assertIncludes(api, 'rpc("delete_own_account")', "api rpc");
assertIncludes(index, 'export * from "./account-deletion"', "api export");

assertIncludes(settings, 'pushScreen("/delete-account")', "settings route");
assertIncludes(settings, "Delete account", "settings label");
assertIncludes(settings, "Sign out", "settings still has sign out");

assertIncludes(layout, 'name="delete-account"', "layout screen");

assertIncludes(screen, 'const CONFIRM_WORD = "DELETE"', "typed confirmation");
assertIncludes(screen, "confirmDeleteAccount", "second confirmation");
assertIncludes(screen, "deleteOwnAccount()", "screen calls api");
assertIncludes(screen, "Account deletion is not enabled on the server yet", "safe failure copy");
assertIncludes(screen, "ACCOUNT_DELETION_STORAGE_PENDING_MESSAGE", "pending cleanup copy");
assertIncludes(screen, "shouldAnnounceStoragePending", "pending cleanup gate");
assertNotIncludes(screen, "auth.admin.deleteUser", "screen must not use admin delete");

assertIncludes(alerts, "confirmDeleteAccount", "alerts helper");

console.log("OK delete-account source checks (no migration applied, no account deleted)");
