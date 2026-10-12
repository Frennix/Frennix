#!/usr/bin/env npx tsx
/**
 * Guards native session persistence without changing the web localStorage path.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  chunkForSecureStore,
  isExpiredNativeSessionWithoutRefresh,
  parsePersistedAuthRecord,
  SECURE_STORE_BYTE_LIMIT,
  utf8ByteLength,
} from "../lib/auth-session-record";

const ROOT = join(import.meta.dirname, "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const checks: Array<{ name: string; run: () => void }> = [
  {
    name: "Web init still uses the default Supabase localStorage client",
    run: () => {
      const source = read("lib/init-supabase.ts");
      assert(
        source.includes('if (Platform.OS === "web") {\n    initSupabase(config.supabaseUrl, config.supabaseAnonKey);'),
        "web must call initSupabase with url and anon key only"
      );
      assert(source.includes("detectSessionInUrl: false"), "native must not parse the browser URL");
      assert(source.includes("storage: nativeAuthStorage"), "native must pass the Keychain adapter");
    },
  },
  {
    name: "Omitted storage options keep the previous browser default",
    run: () => {
      const source = read("packages/api/src/supabase.ts");
      assert(
        source.includes('options?.detectSessionInUrl ?? typeof window !== "undefined"'),
        "web default must stay detectSessionInUrl from window"
      );
      assert(source.includes("options?.storage ? { storage: options.storage }"), "storage is opt-in");
    },
  },
  {
    name: "Web auth guards still read localStorage",
    run: () => {
      const source = read("lib/auth-storage.ts");
      assert(source.includes("localStorage.getItem(key)"), "web token read must stay on localStorage");
      assert(source.includes("localStorage.key(i)"), "web key scan must stay on localStorage");
      assert(source.includes("localStorage.removeItem(key)"), "web clear must stay on localStorage");
      assert(source.includes('Platform.OS !== "web"'), "native guards must branch before localStorage");
    },
  },
  {
    name: "Bootstrap hydrates the native session before the signed-out shortcut",
    run: () => {
      const source = read("providers/AuthProvider.tsx");
      const hydrateAt = source.indexOf("await hydrateNativeAuthStorage()");
      const shortcutAt = source.indexOf('reason: "no-persisted-token"');
      assert(hydrateAt > 0 && shortcutAt > hydrateAt, "hydrate must run before the no-token sign-out");
    },
  },
  {
    name: "SecureStore chunks stay within 2048 bytes and round-trip",
    run: () => {
      const payload = `{"access_token":"${"a".repeat(1800)}","refresh_token":"${"b".repeat(1800)}","expires_at":4102444800,"user":{"id":"${"c".repeat(1200)}"}}`;
      assert(utf8ByteLength(payload) > SECURE_STORE_BYTE_LIMIT, "fixture must exceed one Keychain item");
      const chunks = chunkForSecureStore(payload);
      assert(chunks.length > 1, "oversized session must be split");
      for (const chunk of chunks) {
        assert(utf8ByteLength(chunk) <= SECURE_STORE_BYTE_LIMIT, "chunk exceeds SecureStore limit");
      }
      assert(chunks.join("") === payload, "chunks must rejoin to the original session");
      const emoji = "🔐".repeat(800);
      const emojiChunks = chunkForSecureStore(emoji);
      assert(emojiChunks.join("") === emoji, "multibyte chunks must not split characters");
      for (const chunk of emojiChunks) {
        assert(utf8ByteLength(chunk) <= SECURE_STORE_BYTE_LIMIT, "multibyte chunk exceeds SecureStore limit");
      }
    },
  },
  {
    name: "Expired access tokens with a refresh token stay restorable",
    run: () => {
      const now = 1_700_000_000;
      const restorable = parsePersistedAuthRecord(
        JSON.stringify({
          access_token: "access",
          refresh_token: "refresh",
          expires_at: now - 60,
        })
      );
      assert(!isExpiredNativeSessionWithoutRefresh(restorable, now), "refresh token must survive access expiry");
      const dead = parsePersistedAuthRecord(
        JSON.stringify({ access_token: "access", expires_at: now - 60 })
      );
      assert(isExpiredNativeSessionWithoutRefresh(dead, now), "expired access without refresh is not restorable");
      assert(
        !isExpiredNativeSessionWithoutRefresh(parsePersistedAuthRecord(null), now),
        "missing storage is not an expired session"
      );
    },
  },
];

let failed = 0;
for (const check of checks) {
  try {
    check.run();
    console.log(`PASS  ${check.name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL  ${check.name}`);
    console.error(`      ${error instanceof Error ? error.message : error}`);
  }
}

if (failed) {
  process.exit(1);
}
console.log("\nAll native auth persistence checks passed.");
