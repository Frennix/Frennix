import { Platform } from "react-native";

export type BuildVersionInfo = {
  sha: string;
  bundle: string;
  builtAt: string;
  swVersion: string;
};

const FALLBACK: BuildVersionInfo = {
  sha: "unknown",
  bundle: "unknown",
  builtAt: "unknown",
  swVersion: "unknown",
};

function readMeta(name: string): string {
  if (Platform.OS !== "web" || typeof document === "undefined") return "";
  return document.querySelector(`meta[name="${name}"]`)?.getAttribute("content")?.trim() ?? "";
}

/** Build identity injected by scripts/patch-web-html.js — confirms testers are on latest deploy. */
export function getBuildVersion(): BuildVersionInfo {
  if (Platform.OS !== "web") return FALLBACK;

  return {
    sha: readMeta("frennix-build-sha") || FALLBACK.sha,
    bundle: readMeta("frennix-build-bundle") || FALLBACK.bundle,
    builtAt: readMeta("frennix-build-at") || FALLBACK.builtAt,
    swVersion: readMeta("frennix-sw-version") || FALLBACK.swVersion,
  };
}

export function formatBuildVersionLine(info: BuildVersionInfo = getBuildVersion()): string {
  return `build ${info.sha} · ${info.bundle} · sw ${info.swVersion}`;
}
