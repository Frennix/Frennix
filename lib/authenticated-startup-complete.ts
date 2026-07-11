const STORAGE_KEY = "frennix.auth.startup-complete.v1";

let memoryComplete = false;

/** Mark initial authenticated web startup as successfully completed. */
export function markAuthenticatedStartupComplete(): void {
  memoryComplete = true;
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // ignore quota / private mode
  }
}

/** True once feed or another authenticated destination has been visibly ready this session. */
export function isAuthenticatedStartupComplete(): boolean {
  if (memoryComplete) return true;
  if (typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(STORAGE_KEY) != null;
  } catch {
    return false;
  }
}

export function clearAuthenticatedStartupComplete(): void {
  memoryComplete = false;
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
