const REOPEN_NOTICE_SESSION_KEY = "frennix:pwa-reopen-notice";

/** Show the reopen banner at most once per deployed SW version per browser session. */
export function shouldShowPwaReopenNotice(version: string | null): boolean {
  if (typeof sessionStorage === "undefined") return true;
  const marker = version ?? "unknown";
  if (sessionStorage.getItem(REOPEN_NOTICE_SESSION_KEY) === marker) return false;
  sessionStorage.setItem(REOPEN_NOTICE_SESSION_KEY, marker);
  return true;
}
