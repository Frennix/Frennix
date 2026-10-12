import * as SecureStore from "expo-secure-store";
import {
  chunkForSecureStore,
  EMPTY_AUTH_RECORD,
  isExpiredNativeSessionWithoutRefresh,
  parsePersistedAuthRecord,
  type PersistedAuthRecord,
} from "@/lib/auth-session-record";

/**
 * Native session key. Web keeps Supabase's default `sb-*-auth-token` localStorage key.
 * A full Supabase session is often larger than SecureStore's 2048-byte limit, so the
 * value is split into Keychain chunks. AsyncStorage is not used: it is unencrypted and
 * already holds non-secret caches.
 */
export const NATIVE_AUTH_STORAGE_KEY = "frennix-auth-token";

const KEY_PATTERN = /^[A-Za-z0-9._-]+$/;

let storageGeneration = 0;
let snapshot: PersistedAuthRecord = EMPTY_AUTH_RECORD;
let operationQueue: Promise<void> = Promise.resolve();
const touchedKeys = new Set<string>([NATIVE_AUTH_STORAGE_KEY, `${NATIVE_AUTH_STORAGE_KEY}-code-verifier`]);

function enqueueStorageOperation<T>(task: () => Promise<T>): Promise<T> {
  const run = operationQueue.then(task, task);
  operationQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function secureStoreKey(key: string): string {
  if (KEY_PATTERN.test(key)) return key;
  return key.replace(/[^A-Za-z0-9._-]/g, "_");
}

function chunkCountKey(safeKey: string): string {
  return `${safeKey}.chunk-count`;
}

function chunkKey(safeKey: string, index: number): string {
  return `${safeKey}.${index}`;
}

function remember(key: string, raw: string | null) {
  touchedKeys.add(key);
  if (key !== NATIVE_AUTH_STORAGE_KEY) return;
  snapshot = parsePersistedAuthRecord(raw);
}

async function deleteQuiet(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Missing Keychain items are already gone.
  }
}

async function deleteStoredKey(key: string): Promise<void> {
  const safe = secureStoreKey(key);
  const countRaw = await SecureStore.getItemAsync(chunkCountKey(safe));
  const count = countRaw ? Number(countRaw) : 0;
  const jobs: Promise<void>[] = [deleteQuiet(chunkCountKey(safe)), deleteQuiet(safe)];
  if (Number.isInteger(count) && count > 0) {
    for (let index = 0; index < count; index += 1) {
      jobs.push(deleteQuiet(chunkKey(safe, index)));
    }
  }
  await Promise.all(jobs);
}

async function readStoredKey(key: string): Promise<string | null> {
  const safe = secureStoreKey(key);
  const countRaw = await SecureStore.getItemAsync(chunkCountKey(safe));
  if (countRaw == null) {
    return SecureStore.getItemAsync(safe);
  }

  const count = Number(countRaw);
  if (!Number.isInteger(count) || count < 0) return null;
  if (count === 0) return "";

  const parts: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const part = await SecureStore.getItemAsync(chunkKey(safe, index));
    if (part == null) return null;
    parts.push(part);
  }
  return parts.join("");
}

async function writeStoredKey(key: string, value: string): Promise<void> {
  const safe = secureStoreKey(key);
  const chunks = chunkForSecureStore(value);
  const previousRaw = await SecureStore.getItemAsync(chunkCountKey(safe));
  const previousCount = previousRaw ? Number(previousRaw) : 0;

  for (let index = 0; index < chunks.length; index += 1) {
    await SecureStore.setItemAsync(chunkKey(safe, index), chunks[index] ?? "");
  }
  await SecureStore.setItemAsync(chunkCountKey(safe), String(chunks.length));

  if (Number.isInteger(previousCount) && previousCount > chunks.length) {
    for (let index = chunks.length; index < previousCount; index += 1) {
      await deleteQuiet(chunkKey(safe, index));
    }
  }
  await deleteQuiet(safe);
}

export function nativeSessionHasAccessToken(): boolean {
  return Boolean(snapshot.accessToken);
}

export function nativeSessionIsExpiredWithoutRefresh(): boolean {
  return isExpiredNativeSessionWithoutRefresh(snapshot);
}

/** Drop the in-memory mirror immediately and delete Keychain entries after in-flight writes. */
export function clearNativeAuthStorageSync(): boolean {
  const hadToken = nativeSessionHasAccessToken();
  storageGeneration += 1;
  const generationAtClear = storageGeneration;
  snapshot = EMPTY_AUTH_RECORD;
  const keys = new Set(touchedKeys);
  keys.add(NATIVE_AUTH_STORAGE_KEY);
  keys.add(`${NATIVE_AUTH_STORAGE_KEY}-code-verifier`);

  void enqueueStorageOperation(async () => {
    if (storageGeneration !== generationAtClear) return;
    await Promise.all([...keys].map((key) => deleteStoredKey(key)));
  }).catch((error: unknown) => {
    console.warn("[auth] failed to clear native session", error instanceof Error ? error.message : "storage");
  });

  return hadToken;
}

export async function hydrateNativeAuthStorage(): Promise<void> {
  await nativeAuthStorage.getItem(NATIVE_AUTH_STORAGE_KEY);
}

export const nativeAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    const generationAtRead = storageGeneration;
    return enqueueStorageOperation(async () => {
      const value = await readStoredKey(key);
      if (storageGeneration !== generationAtRead) return null;
      remember(key, value);
      return value;
    });
  },

  async setItem(key: string, value: string): Promise<void> {
    touchedKeys.add(key);
    const generationAtWrite = storageGeneration;
    await enqueueStorageOperation(async () => {
      await writeStoredKey(key, value);
      if (storageGeneration !== generationAtWrite) {
        await deleteStoredKey(key);
        return;
      }
      remember(key, value);
    });
  },

  async removeItem(key: string): Promise<void> {
    const generationAtRemove = storageGeneration;
    await enqueueStorageOperation(async () => {
      await deleteStoredKey(key);
      if (storageGeneration !== generationAtRemove) return;
      remember(key, null);
    });
  },
};
