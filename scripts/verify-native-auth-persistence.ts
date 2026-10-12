#!/usr/bin/env npx tsx
/**
 * Guards native session persistence without changing the web localStorage path.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  chunkForSecureStore,
  isExpiredNativeSessionWithoutRefresh,
  parsePersistedAuthRecord,
  SECURE_STORE_BYTE_LIMIT,
  utf8ByteLength,
} from "../lib/auth-session-record";
import { createNativeAuthController } from "../lib/native-auth-controller";
import {
  deleteCommittedAuthValue,
  NATIVE_AUTH_COMMIT_READY,
  NATIVE_AUTH_DELETE_STEPS,
  NATIVE_AUTH_MAX_CHUNK_SLOTS,
  NATIVE_AUTH_WRITE_STEPS,
  nativeAuthStorageKeys,
  readCommittedAuthValue,
  writeCommittedAuthValue,
  type NativeAuthKeyValue,
} from "../lib/native-auth-chunk-store";

const scriptPath = process.argv[1];
if (!scriptPath) {
  throw new Error("verify-native-auth-persistence could not resolve its path");
}
const ROOT = join(dirname(scriptPath), "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const SESSION_KEY = "frennix-auth-token";

function memoryStore(): NativeAuthKeyValue & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async getItem(key) {
      return data.has(key) ? data.get(key)! : null;
    },
    async setItem(key, value) {
      data.set(key, value);
    },
    async deleteItem(key) {
      data.delete(key);
    },
  };
}

function sessionJson(accessToken: string, padding: number) {
  return JSON.stringify({
    access_token: accessToken,
    refresh_token: `${accessToken}-refresh`,
    expires_at: 4_102_444_800,
    user: { id: "u".repeat(padding) },
  });
}

const checks: Array<{ name: string; run: () => void | Promise<void> }> = [
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
  {
    name: "Commit marker is published only after chunks are consistent",
    run: () => {
      assert(
        NATIVE_AUTH_WRITE_STEPS.indexOf("invalidate-commit") <
          NATIVE_AUTH_WRITE_STEPS.indexOf("write-chunks"),
        "commit must be cleared before chunks change"
      );
      assert(
        NATIVE_AUTH_WRITE_STEPS.indexOf("write-chunks") <
          NATIVE_AUTH_WRITE_STEPS.indexOf("delete-stale-chunks"),
        "stale chunks must be removed after the new chunks are written"
      );
      assert(
        NATIVE_AUTH_WRITE_STEPS.indexOf("delete-stale-chunks") <
          NATIVE_AUTH_WRITE_STEPS.indexOf("publish-commit"),
        "commit must be published after orphan cleanup"
      );
      assert(
        NATIVE_AUTH_DELETE_STEPS[0] === "invalidate-commit",
        "logout must invalidate the commit marker first"
      );
      const auth = read("providers/AuthProvider.tsx");
      const signOutAt = auth.indexOf("const signOut = useCallback");
      const clearAt = auth.indexOf("clearAllPersistedAuth()", signOutAt);
      const finishAt = auth.indexOf("await finishClearingPersistedAuth()", signOutAt);
      const supabaseAt = auth.indexOf("await supabaseSignOut", signOutAt);
      assert(
        clearAt > signOutAt && finishAt > clearAt && supabaseAt > finishAt,
        "sign-out must wait for the Keychain clear before Supabase"
      );
      const blockAt = auth.indexOf("blockNativeAuthPersistence()", signOutAt);
      assert(blockAt > signOutAt && blockAt < finishAt, "writes must be blocked before the Keychain clear");
      const finishSource = read("lib/auth-storage.ts");
      const finishFn = finishSource.slice(finishSource.indexOf("export async function finishClearingPersistedAuth"));
      assert(finishFn.includes("throw lastError"), "a failed Keychain clear must reject sign-out");
      assert(
        !finishFn.includes("console.warn"),
        "sign-out must not treat a failed clear as success"
      );
    },
  },
  {
    name: "A committed session round-trips and ignores orphan chunks",
    run: async () => {
      const store = memoryStore();
      const value = sessionJson("restore-me", 40);
      const chunks = chunkForSecureStore(value);
      await writeCommittedAuthValue(store, SESSION_KEY, chunks);
      const keys = nativeAuthStorageKeys(SESSION_KEY);
      store.data.set(keys.chunk(chunks.length + 2), "stale-orphan");
      const restored = await readCommittedAuthValue(store, SESSION_KEY);
      assert(restored === value, "a finished write must restore the same session");
      assert(
        parsePersistedAuthRecord(restored).accessToken === "restore-me",
        "restored session must keep its access token"
      );
      assert(store.data.get(keys.commit) === NATIVE_AUTH_COMMIT_READY, "commit marker must be ready");
    },
  },
  {
    name: "An interrupted shrinking write does not join old and new chunks",
    run: async () => {
      const store = memoryStore();
      const keys = nativeAuthStorageKeys(SESSION_KEY);
      await writeCommittedAuthValue(store, SESSION_KEY, ["old-0", "old-1", "old-2"]);
      await writeCommittedAuthValue(store, SESSION_KEY, ["new-0"], { stopAfter: "write-chunks" });
      assert(store.data.get(keys.chunk(0)) === "new-0", "new prefix was written");
      assert(store.data.get(keys.chunk(1)) === "old-1", "old suffix is still present");
      assert(store.data.get(keys.commit) !== NATIVE_AUTH_COMMIT_READY, "commit stays unpublished");
      const restored = await readCommittedAuthValue(store, SESSION_KEY);
      assert(restored == null, "interrupted shrink must not restore a mixed session");
      assert(restored !== "new-0old-1old-2", "mixed chunks must not be returned");
    },
  },
  {
    name: "An interrupted growing write does not restore a truncated session",
    run: async () => {
      const store = memoryStore();
      const keys = nativeAuthStorageKeys(SESSION_KEY);
      await writeCommittedAuthValue(store, SESSION_KEY, ["old-0"]);
      await writeCommittedAuthValue(store, SESSION_KEY, ["new-0", "new-1", "new-2"], {
        stopAfter: "write-chunks",
      });
      assert(store.data.get(keys.count) === "1", "old count is still in place");
      assert(store.data.get(keys.chunk(0)) === "new-0", "first new chunk replaced the old value");
      const restored = await readCommittedAuthValue(store, SESSION_KEY);
      assert(restored == null, "interrupted growth must not restore the new prefix");
    },
  },
  {
    name: "A missing chunk is not restored",
    run: async () => {
      const store = memoryStore();
      const keys = nativeAuthStorageKeys(SESSION_KEY);
      await writeCommittedAuthValue(store, SESSION_KEY, ["a", "b", "c"]);
      store.data.delete(keys.chunk(1));
      assert((await readCommittedAuthValue(store, SESSION_KEY)) == null, "gap in chunks must not restore");
    },
  },
  {
    name: "A finished shrink drops stale chunks and a finished grow restores every chunk",
    run: async () => {
      const store = memoryStore();
      const keys = nativeAuthStorageKeys(SESSION_KEY);
      await writeCommittedAuthValue(store, SESSION_KEY, ["big-0", "big-1", "big-2"]);
      await writeCommittedAuthValue(store, SESSION_KEY, ["small-0"]);
      assert((await readCommittedAuthValue(store, SESSION_KEY)) === "small-0", "shrink must restore the new value");
      assert(!store.data.has(keys.chunk(1)) && !store.data.has(keys.chunk(2)), "old chunks must be deleted");
      await writeCommittedAuthValue(store, SESSION_KEY, ["g-0", "g-1", "g-2"]);
      assert(
        (await readCommittedAuthValue(store, SESSION_KEY)) === "g-0g-1g-2",
        "growth must restore every new chunk"
      );
    },
  },
  {
    name: "A failed chunk write leaves the session unrestorable",
    run: async () => {
      const store = memoryStore();
      const previous = sessionJson("previous", 20);
      await writeCommittedAuthValue(store, SESSION_KEY, chunkForSecureStore(previous));
      const failing: NativeAuthKeyValue = {
        getItem: (key) => store.getItem(key),
        deleteItem: (key) => store.deleteItem(key),
        async setItem(key, value) {
          if (key === nativeAuthStorageKeys(SESSION_KEY).chunk(1)) {
            throw new Error("keychain write failed");
          }
          await store.setItem(key, value);
        },
      };
      const next = sessionJson("next", 2500);
      let threw = false;
      try {
        await writeCommittedAuthValue(failing, SESSION_KEY, chunkForSecureStore(next));
      } catch {
        threw = true;
      }
      assert(threw, "storage failure must surface");
      assert(utf8ByteLength(next) > SECURE_STORE_BYTE_LIMIT, "failure fixture must span chunks");
      const restored = await readCommittedAuthValue(store, SESSION_KEY);
      assert(restored == null, "failed write must not restore the old or partial session");
    },
  },
  {
    name: "Logout clears a committed session, and an interrupted logout does not restore it",
    run: async () => {
      const store = memoryStore();
      const keys = nativeAuthStorageKeys(SESSION_KEY);
      await writeCommittedAuthValue(store, SESSION_KEY, ["keep-0", "keep-1"]);
      store.data.set(keys.chunk(8), "orphan-above-count");
      await deleteCommittedAuthValue(store, SESSION_KEY, { stopAfter: "invalidate-commit" });
      assert(
        (await readCommittedAuthValue(store, SESSION_KEY)) == null,
        "logout must be unrestorable as soon as the commit marker is gone"
      );
      assert(store.data.has(keys.chunk(0)), "chunks can still exist after an interrupted logout");
      await deleteCommittedAuthValue(store, SESSION_KEY);
      for (let index = 0; index < NATIVE_AUTH_MAX_CHUNK_SLOTS; index += 1) {
        assert(!store.data.has(keys.chunk(index)), `orphan chunk ${index} must be deleted`);
      }
      assert(!store.data.has(keys.commit) && !store.data.has(keys.count), "logout must remove commit metadata");
    },
  },
  {
    name: "In-flight persistence cannot undo logout",
    run: async () => {
      const store = memoryStore();
      let releaseWrite: (() => void) | null = null;
      const gated: NativeAuthKeyValue = {
        getItem: (key) => store.getItem(key),
        deleteItem: (key) => store.deleteItem(key),
        async setItem(key, value) {
          if (key.endsWith(".commit") && value === NATIVE_AUTH_COMMIT_READY && !releaseWrite) {
            await new Promise<void>((resolve) => {
              releaseWrite = resolve;
            });
          }
          await store.setItem(key, value);
        },
      };
      const auth = createNativeAuthController(gated, SESSION_KEY);
      const payload = sessionJson("race", 30);
      const writing = auth.storage.setItem(SESSION_KEY, payload);
      for (let i = 0; i < 50 && !releaseWrite; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      assert(releaseWrite, "write should reach the commit step");
      auth.clearSync();
      releaseWrite!();
      await writing;
      await auth.flush();
      assert((await auth.storage.getItem(SESSION_KEY)) == null, "logout must win over an in-flight write");
      assert(!auth.hasAccessToken(), "memory mirror must stay signed out");
    },
  },
  {
    name: "Successful logout then restart cannot restore the session",
    run: async () => {
      const store = memoryStore();
      const auth = createNativeAuthController(store, SESSION_KEY);
      await auth.storage.setItem(SESSION_KEY, sessionJson("signed-in", 80));
      auth.blockWrites();
      auth.clearSync();
      await auth.flush();
      await auth.storage.setItem(SESSION_KEY, sessionJson("refresh-during-logout", 40));
      assert(!(await auth.persistedSessionIsRestorable()), "completed logout must leave nothing restorable");
      auth.resumeWrites();
      const restarted = createNativeAuthController(store, SESSION_KEY);
      await restarted.hydrate();
      assert(!restarted.hasAccessToken(), "a cold start after logout must stay signed out");
      assert((await restarted.storage.getItem(SESSION_KEY)) == null, "restart must not read the old session");
    },
  },
  {
    name: "A failed commit-marker delete does not count as logout",
    run: async () => {
      const store = memoryStore();
      const auth = createNativeAuthController(store, SESSION_KEY);
      await auth.storage.setItem(SESSION_KEY, sessionJson("keep-me", 40));
      const originalDelete = store.deleteItem.bind(store);
      store.deleteItem = async (key) => {
        if (key.endsWith(".commit")) throw new Error("keychain delete failed");
        await originalDelete(key);
      };
      auth.clearSync();
      let rejected = false;
      try {
        await auth.flush();
      } catch (error) {
        rejected = error instanceof Error && error.message === "keychain delete failed";
      }
      assert(rejected, "commit-marker deletion failure must reject the clear");
      assert(await auth.persistedSessionIsRestorable(), "the previous session must still be restorable");
      const restarted = createNativeAuthController(store, SESSION_KEY);
      await restarted.hydrate();
      assert(
        parsePersistedAuthRecord(await restarted.storage.getItem(SESSION_KEY)).accessToken === "keep-me",
        "restart after a failed logout must restore the same session"
      );
    },
  },
  {
    name: "Token refresh restoration returns the new access token",
    run: async () => {
      const store = memoryStore();
      const auth = createNativeAuthController(store, SESSION_KEY);
      await auth.storage.setItem(SESSION_KEY, sessionJson("old-access", 90));
      await auth.storage.setItem(SESSION_KEY, sessionJson("new-access", 90));
      const restarted = createNativeAuthController(store, SESSION_KEY);
      await restarted.hydrate();
      assert(restarted.hasAccessToken(), "a refreshed session must survive restart");
      assert(
        parsePersistedAuthRecord(await restarted.storage.getItem(SESSION_KEY)).accessToken === "new-access",
        "restart must restore the refreshed access token"
      );
    },
  },
];

async function main() {
  let failed = 0;
  for (const check of checks) {
    try {
      await check.run();
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
}

void main();
