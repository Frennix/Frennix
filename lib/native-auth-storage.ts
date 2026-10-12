import * as SecureStore from "expo-secure-store";
import { createNativeAuthController, type NativeAuthHydrateResult } from "@/lib/native-auth-controller";
import type { NativeAuthKeyValue } from "@/lib/native-auth-chunk-store";

/**
 * Native session key. Web keeps Supabase's default `sb-*-auth-token` localStorage key.
 * A full Supabase session is often larger than SecureStore's 2048-byte limit, so the
 * value is split into Keychain chunks. AsyncStorage is not used: it is unencrypted and
 * already holds non-secret caches.
 */
export const NATIVE_AUTH_STORAGE_KEY = "frennix-auth-token";

const secureStore: NativeAuthKeyValue = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  deleteItem: (key) => SecureStore.deleteItemAsync(key),
};

const nativeAuth = createNativeAuthController(secureStore, NATIVE_AUTH_STORAGE_KEY);

export function nativeSessionHasAccessToken(): boolean {
  return nativeAuth.hasAccessToken();
}

export function nativeSessionIsExpiredWithoutRefresh(): boolean {
  return nativeAuth.isExpiredWithoutRefresh();
}

export function clearNativeAuthStorageSync(): boolean {
  return nativeAuth.clearSync();
}

/** Wait until the queued Keychain clear or write has finished. */
export function blockNativeAuthPersistence(): void {
  nativeAuth.blockWrites();
}

export function resumeNativeAuthPersistence(): void {
  nativeAuth.resumeWrites();
}

export function flushNativeAuthStorage(): Promise<void> {
  return nativeAuth.flush();
}

export function nativePersistedSessionIsRestorable(): Promise<boolean> {
  return nativeAuth.persistedSessionIsRestorable();
}

export function hydrateNativeAuthStorage(): Promise<NativeAuthHydrateResult> {
  return nativeAuth.hydrate();
}

export const nativeAuthStorage = nativeAuth.storage;
