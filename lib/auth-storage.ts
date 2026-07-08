/** True when a Supabase auth token is still present in browser storage. */
export function hasPersistedAuthToken(): boolean {
  if (typeof localStorage === "undefined") return true;
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
  if (!isPersistedSessionExpired() || typeof localStorage === "undefined") return false;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith("sb-") && key.endsWith("-auth-token")) keys.push(key);
  }
  for (const key of keys) localStorage.removeItem(key);
  return true;
}
