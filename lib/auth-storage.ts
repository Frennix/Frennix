import { Platform } from "react-native";
import {
  clearNativeAuthStorageSync,
  flushNativeAuthStorage,
  nativePersistedSessionIsRestorable,
  nativeSessionHasAccessToken,
  nativeSessionIsExpiredWithoutRefresh,
} from "@/lib/native-auth-storage";

/** True when a Supabase auth token is still present in browser storage. */
export function hasPersistedAuthToken(): boolean {
  if (Platform.OS !== "web") return nativeSessionHasAccessToken();
  if (typeof localStorage === "undefined") return false;
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key?.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { access_token?: string };
      if (parsed.access_token) return true;
    } catch {
      // Ignore malformed storage entries.
    }
  }
  return false;
}

/** True when persisted auth metadata indicates the session is past expiry. */
export function isPersistedSessionExpired(): boolean {
  if (Platform.OS !== "web") return nativeSessionIsExpiredWithoutRefresh();
  if (typeof localStorage === "undefined") return false;
  const nowSec = Math.floor(Date.now() / 1000);
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key?.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { expires_at?: number; access_token?: string };
      if (!parsed.access_token) continue;
      if (typeof parsed.expires_at === "number" && parsed.expires_at <= nowSec) {
        return true;
      }
    } catch {
      // Ignore malformed storage entries.
    }
  }
  return false;
}

/** Remove expired Supabase auth entries from browser storage. */
export function clearExpiredPersistedAuth(): boolean {
  if (Platform.OS !== "web") {
    if (!nativeSessionIsExpiredWithoutRefresh()) return false;
    return clearNativeAuthStorageSync();
  }
  if (!isPersistedSessionExpired() || typeof localStorage === "undefined") return false;
  return clearAllPersistedAuth();
}

/** Remove all Supabase auth entries from browser storage. */
export function clearAllPersistedAuth(): boolean {
  if (Platform.OS !== "web") return clearNativeAuthStorageSync();
  if (typeof localStorage === "undefined") return false;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith("sb-")) keys.push(key);
  }
  if (keys.length === 0) return false;
  for (const key of keys) localStorage.removeItem(key);
  return true;
}

/**
 * Wait until the native session can no longer be restored.
 * A storage failure is thrown so sign-out is not treated as complete.
 */
export async function finishClearingPersistedAuth(): Promise<void> {
  if (Platform.OS === "web") return;
  let lastError: unknown = new Error("Native sign-out did not invalidate the persisted session");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await flushNativeAuthStorage();
    } catch (error) {
      lastError = error;
    }
    try {
      if (!(await nativePersistedSessionIsRestorable())) return;
      lastError = new Error("Native sign-out did not invalidate the persisted session");
    } catch (error) {
      lastError = error;
    }
    if (attempt < 2) clearAllPersistedAuth();
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Native sign-out did not invalidate the persisted session");
}

/** Drop in-memory session when browser storage no longer has a token. */
export function sessionMatchesPersistedAuth(session: { access_token?: string } | null): boolean {
  if (!session) return true;
  return hasPersistedAuthToken();
}
