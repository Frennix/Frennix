/**
 * Crash-safe layout for one native auth value.
 *
 * SecureStore items are limited to 2048 bytes, so a session is split into chunks.
 * A reader may run after the process died mid-write. Chunks are invisible until
 * the commit marker is published, and that marker is removed before any chunk changes.
 */

export const NATIVE_AUTH_MAX_CHUNK_SLOTS = 32;
export const NATIVE_AUTH_COMMIT_READY = "ready";

export const NATIVE_AUTH_WRITE_STEPS = [
  "invalidate-commit",
  "write-chunks",
  "delete-stale-chunks",
  "delete-legacy",
  "write-count",
  "publish-commit",
] as const;

export const NATIVE_AUTH_DELETE_STEPS = [
  "invalidate-commit",
  "delete-count",
  "delete-legacy",
  "delete-chunks",
] as const;

export type NativeAuthWriteStep = (typeof NATIVE_AUTH_WRITE_STEPS)[number];
export type NativeAuthDeleteStep = (typeof NATIVE_AUTH_DELETE_STEPS)[number];

export type NativeAuthKeyValue = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
};

export function nativeAuthStorageKeys(safeKey: string) {
  return {
    commit: `${safeKey}.commit`,
    count: `${safeKey}.chunk-count`,
    legacy: safeKey,
    chunk: (index: number) => `${safeKey}.${index}`,
  };
}

export async function readCommittedAuthValue(
  store: NativeAuthKeyValue,
  safeKey: string
): Promise<string | null> {
  const keys = nativeAuthStorageKeys(safeKey);
  const commit = await store.getItem(keys.commit);
  if (commit !== NATIVE_AUTH_COMMIT_READY) {
    if (commit != null) return null;
    const count = await store.getItem(keys.count);
    if (count != null) return null;
    const partialChunk = await store.getItem(keys.chunk(0));
    if (partialChunk != null) return null;
    return store.getItem(keys.legacy);
  }

  const countRaw = await store.getItem(keys.count);
  const count = countRaw == null ? Number.NaN : Number(countRaw);
  if (!Number.isInteger(count) || count < 1 || count > NATIVE_AUTH_MAX_CHUNK_SLOTS) return null;

  const parts: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const part = await store.getItem(keys.chunk(index));
    if (part == null) return null;
    parts.push(part);
  }
  return parts.join("");
}

export async function writeCommittedAuthValue(
  store: NativeAuthKeyValue,
  safeKey: string,
  chunks: readonly string[],
  options?: { stopAfter?: NativeAuthWriteStep }
): Promise<void> {
  if (chunks.length < 1 || chunks.length > NATIVE_AUTH_MAX_CHUNK_SLOTS) {
    throw new Error("Native auth session chunk count is outside the supported range");
  }

  const keys = nativeAuthStorageKeys(safeKey);
  for (const step of NATIVE_AUTH_WRITE_STEPS) {
    switch (step) {
      case "invalidate-commit":
        await store.deleteItem(keys.commit);
        break;
      case "write-chunks":
        for (let index = 0; index < chunks.length; index += 1) {
          await store.setItem(keys.chunk(index), chunks[index] ?? "");
        }
        break;
      case "delete-stale-chunks":
        for (let index = chunks.length; index < NATIVE_AUTH_MAX_CHUNK_SLOTS; index += 1) {
          await store.deleteItem(keys.chunk(index));
        }
        break;
      case "delete-legacy":
        await store.deleteItem(keys.legacy);
        break;
      case "write-count":
        await store.setItem(keys.count, String(chunks.length));
        break;
      case "publish-commit":
        await store.setItem(keys.commit, NATIVE_AUTH_COMMIT_READY);
        break;
      default:
        break;
    }
    if (options?.stopAfter === step) return;
  }
}

export async function deleteCommittedAuthValue(
  store: NativeAuthKeyValue,
  safeKey: string,
  options?: { stopAfter?: NativeAuthDeleteStep }
): Promise<void> {
  const keys = nativeAuthStorageKeys(safeKey);
  for (const step of NATIVE_AUTH_DELETE_STEPS) {
    switch (step) {
      case "invalidate-commit":
        await store.deleteItem(keys.commit);
        break;
      case "delete-count":
        await store.deleteItem(keys.count);
        break;
      case "delete-legacy":
        await store.deleteItem(keys.legacy);
        break;
      case "delete-chunks":
        for (let index = 0; index < NATIVE_AUTH_MAX_CHUNK_SLOTS; index += 1) {
          await store.deleteItem(keys.chunk(index));
        }
        break;
      default:
        break;
    }
    if (options?.stopAfter === step) return;
  }
}
