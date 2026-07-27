import { Platform } from "react-native";

export const PWA_UPDATE_RELOAD_KEY = "frennix:pwa-update-reload";

const BUILD_SHA_PATTERN =
  /data-sha="([^"]+)"|name="frennix-build-sha"\s+content="([^"]+)"/;

/** Read the build SHA baked into the currently loaded document. */
export function readLocalBuildSha(): string | null {
  if (Platform.OS !== "web" || typeof document === "undefined") return null;

  const stamp = document.getElementById("frennix-build-stamp");
  const fromStamp = stamp?.getAttribute("data-sha")?.trim();
  if (fromStamp) return fromStamp;

  const meta = document.querySelector('meta[name="frennix-build-sha"]');
  const fromMeta = meta?.getAttribute("content")?.trim();
  return fromMeta || null;
}

/** Parse a build SHA from fetched index.html markup. */
export function parseBuildShaFromHtml(html: string): string | null {
  const match = html.match(BUILD_SHA_PATTERN);
  return match?.[1]?.trim() || match?.[2]?.trim() || null;
}

/** Fetch the live app shell and return its build SHA (network-only). */
export async function fetchRemoteBuildSha(): Promise<string | null> {
  if (Platform.OS !== "web" || typeof fetch === "undefined") return null;

  try {
    const url = new URL(window.location.href);
    url.hash = "";
    url.searchParams.set("frennix_build_check", String(Date.now()));
    const response = await fetch(url.toString(), { cache: "no-store", credentials: "same-origin" });
    const html = await response.text();
    return parseBuildShaFromHtml(html);
  } catch {
    return null;
  }
}

export type PwaBuildUpdateCheck =
  | { status: "current" }
  | { status: "update_available"; localSha: string; remoteSha: string }
  | { status: "unknown" };

/** Compare local vs deployed build SHA. */
export async function checkForDeployedBuildUpdate(): Promise<PwaBuildUpdateCheck> {
  const localSha = readLocalBuildSha();
  if (!localSha) return { status: "unknown" };

  const remoteSha = await fetchRemoteBuildSha();
  if (!remoteSha) return { status: "unknown" };
  if (remoteSha === localSha) return { status: "current" };

  return { status: "update_available", localSha, remoteSha };
}

/** Reload once per target build to avoid infinite loops. Returns true if reloading. */
export function reloadForPwaUpdate(nextSha?: string): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;

  const target = nextSha?.trim() || "pending";
  try {
    if (sessionStorage.getItem(PWA_UPDATE_RELOAD_KEY) === target) {
      return false;
    }
    sessionStorage.setItem(PWA_UPDATE_RELOAD_KEY, target);
  } catch {
    // Private mode — still attempt one reload.
  }

  window.location.reload();
  return true;
}
