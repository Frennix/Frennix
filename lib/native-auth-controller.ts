import {
  chunkForSecureStore,
  EMPTY_AUTH_RECORD,
  isExpiredNativeSessionWithoutRefresh,
  parsePersistedAuthRecord,
  type PersistedAuthRecord,
} from "@/lib/auth-session-record";
import {
  deleteCommittedAuthValue,
  NATIVE_AUTH_MAX_CHUNK_SLOTS,
  readCommittedAuthValue,
  writeCommittedAuthValue,
  type NativeAuthKeyValue,
} from "@/lib/native-auth-chunk-store";

const KEY_PATTERN = /^[A-Za-z0-9._-]+$/;

/** restored: a saved access token was read. missing: storage was readable and empty. unavailable: the read failed and stored credentials were left untouched. */
export type NativeAuthHydrateResult = "restored" | "missing" | "unavailable";

function secureStoreKey(key: string): string {
  if (KEY_PATTERN.test(key)) return key;
  return key.replace(/[^A-Za-z0-9._-]/g, "_");
}

export function createNativeAuthController(backend: NativeAuthKeyValue, sessionKey: string) {
  let storageGeneration = 0;
  let writesBlocked = false;
  let snapshot: PersistedAuthRecord = EMPTY_AUTH_RECORD;
  let idle: Promise<void> = Promise.resolve();
  let lastResult: Promise<void> = Promise.resolve();
  const touchedKeys = new Set<string>([sessionKey, `${sessionKey}-code-verifier`]);

  function enqueueStorageOperation<T>(task: () => Promise<T>): Promise<T> {
    const run = idle.then(task, task);
    const settled = run.then(() => undefined);
    lastResult = settled;
    idle = settled.then(
      () => undefined,
      () => undefined
    );
    void settled.catch(() => undefined);
    return run;
  }

  function remember(key: string, raw: string | null) {
    touchedKeys.add(key);
    if (key !== sessionKey) return;
    snapshot = parsePersistedAuthRecord(raw);
  }

  async function deleteKey(key: string): Promise<void> {
    await deleteCommittedAuthValue(backend, secureStoreKey(key));
  }

  const storage = {
    async getItem(key: string): Promise<string | null> {
      const generationAtRead = storageGeneration;
      return enqueueStorageOperation(async () => {
        const value = await readCommittedAuthValue(backend, secureStoreKey(key));
        if (storageGeneration !== generationAtRead) return null;
        remember(key, value);
        return value;
      });
    },

    async setItem(key: string, value: string): Promise<void> {
      touchedKeys.add(key);
      const generationAtWrite = storageGeneration;
      await enqueueStorageOperation(async () => {
        if (writesBlocked) {
          if (key === sessionKey) snapshot = EMPTY_AUTH_RECORD;
          return;
        }
        const chunks = chunkForSecureStore(value);
        if (chunks.length > NATIVE_AUTH_MAX_CHUNK_SLOTS) {
          throw new Error("Native auth session chunk count is outside the supported range");
        }
        try {
          await writeCommittedAuthValue(backend, secureStoreKey(key), chunks);
        } catch (error) {
          if (storageGeneration === generationAtWrite && key === sessionKey) {
            snapshot = EMPTY_AUTH_RECORD;
          }
          throw error;
        }
        if (storageGeneration !== generationAtWrite) {
          await deleteKey(key);
          if (key === sessionKey) snapshot = EMPTY_AUTH_RECORD;
          return;
        }
        remember(key, value);
      });
    },

    async removeItem(key: string): Promise<void> {
      const generationAtRemove = storageGeneration;
      await enqueueStorageOperation(async () => {
        await deleteKey(key);
        if (storageGeneration !== generationAtRemove) return;
        remember(key, null);
      });
    },
  };

  return {
    hasAccessToken(): boolean {
      return Boolean(snapshot.accessToken);
    },

    isExpiredWithoutRefresh(): boolean {
      return isExpiredNativeSessionWithoutRefresh(snapshot);
    },

    /** Drop the in-memory mirror immediately and delete Keychain entries after in-flight writes. */
    clearSync(): boolean {
      const hadToken = Boolean(snapshot.accessToken);
      storageGeneration += 1;
      const generationAtClear = storageGeneration;
      snapshot = EMPTY_AUTH_RECORD;
      const keys = new Set(touchedKeys);
      keys.add(sessionKey);
      keys.add(`${sessionKey}-code-verifier`);

      void enqueueStorageOperation(async () => {
        if (storageGeneration !== generationAtClear) return;
        for (const key of keys) {
          await deleteKey(key);
        }
      }).catch((error: unknown) => {
        console.warn(
          "[auth] failed to clear native session",
          error instanceof Error ? error.message : "storage"
        );
      });

      return hadToken;
    },

    blockWrites(): void {
      writesBlocked = true;
    },

    resumeWrites(): void {
      writesBlocked = false;
    },

    flush(): Promise<void> {
      return lastResult;
    },

    /** True only when a committed access token can still be read back after a restart. */
    async persistedSessionIsRestorable(): Promise<boolean> {
      return enqueueStorageOperation(async () => {
        const raw = await readCommittedAuthValue(backend, secureStoreKey(sessionKey));
        return Boolean(parsePersistedAuthRecord(raw).accessToken);
      });
    },

    async hydrate(): Promise<NativeAuthHydrateResult> {
      try {
        const value = await storage.getItem(sessionKey);
        return parsePersistedAuthRecord(value).accessToken ? "restored" : "missing";
      } catch (error) {
        console.warn(
          "[auth] native session restore failed",
          error instanceof Error ? error.message : "storage"
        );
        return "unavailable";
      }
    },

    storage,
  };
}
