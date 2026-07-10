import { Platform } from "react-native";
import { logDiagnostic } from "@/lib/client-diagnostics";
import { getBuildVersion } from "@/lib/build-version";
import { parseWebEnvironment } from "@/lib/startup-snapshot-log";

export type WebStartupCheckpointId =
  | "login:submitted"
  | "session:created"
  | "auth:provider-ready"
  | "profile:fetch-started"
  | "profile:fetch-succeeded"
  | "profile:fetch-failed"
  | "onboarding:resolved"
  | "redirect:started"
  | "tabs-layout:mounted"
  | "feed-route:mounted"
  | "feed-request:started"
  | "feed-request:succeeded"
  | "feed-request:failed"
  | "feed-root:visible"
  | "feed-root:hidden"
  | "startup:fallback-shown"
  | "startup:render-error";

export type WebStartupCheckpoint = {
  id: WebStartupCheckpointId;
  at: string;
  elapsedMs: number;
  route?: string;
  detail?: Record<string, unknown>;
};

export type WebStartupFailureCategory =
  | "layout"
  | "auth"
  | "profile"
  | "feed"
  | "network"
  | "render"
  | "timeout"
  | "unknown";

const bootMark = typeof performance !== "undefined" ? performance.now() : Date.now();
const checkpoints: WebStartupCheckpoint[] = [];
let failureCategory: WebStartupFailureCategory = "unknown";
let failureMessage: string | null = null;

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function publish() {
  if (typeof window === "undefined") return;
  (window as Window & { __FRENNIX_STARTUP_CHECKPOINTS__?: WebStartupCheckpoint[] }).__FRENNIX_STARTUP_CHECKPOINTS__ =
    [...checkpoints];
}

/** Redact user identifiers — never log full email or tokens. */
export function redactUserId(userId?: string | null): string | null {
  if (!userId) return null;
  return userId.slice(0, 8);
}

export function setWebStartupFailureCategory(
  category: WebStartupFailureCategory,
  message?: string
): void {
  failureCategory = category;
  failureMessage = message ?? null;
}

export function recordWebStartupCheckpoint(
  id: WebStartupCheckpointId,
  detail?: Record<string, unknown>
): WebStartupCheckpoint {
  const route =
    typeof window !== "undefined" && Platform.OS === "web"
      ? window.location.pathname
      : undefined;

  const entry: WebStartupCheckpoint = {
    id,
    at: new Date().toISOString(),
    elapsedMs: Math.round(nowMs() - bootMark),
    route,
    detail: sanitizeCheckpointDetail(detail),
  };

  checkpoints.push(entry);
  if (checkpoints.length > 60) checkpoints.shift();
  publish();

  logDiagnostic("web-startup-checkpoint", id, "info", entry.detail ?? {});
  return entry;
}

function sanitizeCheckpointDetail(
  detail?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!detail) return undefined;

  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(detail)) {
    if (/token|password|email|secret|authorization/i.test(key)) continue;
    if (key === "userId" && typeof value === "string") {
      safe.userId = redactUserId(value);
      continue;
    }
    if (typeof value === "string" && value.length > 240) {
      safe[key] = `${value.slice(0, 240)}…`;
      continue;
    }
    safe[key] = value;
  }
  return Object.keys(safe).length ? safe : undefined;
}

export function getWebStartupCheckpoints(): readonly WebStartupCheckpoint[] {
  return checkpoints;
}

export function getLastWebStartupCheckpoint(): WebStartupCheckpoint | null {
  return checkpoints[checkpoints.length - 1] ?? null;
}

export function buildWebStartupDiagnosticCode(input?: {
  route?: string;
  category?: WebStartupFailureCategory;
}): string {
  const build = getBuildVersion();
  const env = Platform.OS === "web" ? parseWebEnvironment() : null;
  const last = getLastWebStartupCheckpoint();
  const route =
    input?.route ??
    (typeof window !== "undefined" ? window.location.pathname : "/");
  const category = input?.category ?? failureCategory;

  return [
    "FNX",
    `b=${build.sha.slice(0, 8)}`,
    `sw=${build.swVersion}`,
    `ckpt=${last?.id ?? "none"}`,
    `cat=${category}`,
    `route=${route}`,
    env ? `dm=${env.displayMode}` : null,
    env ? `br=${env.browser}` : null,
    failureMessage ? `msg=${failureMessage.slice(0, 48)}` : null,
  ]
    .filter(Boolean)
    .join("|");
}

export function clearSafeTransientStartupState(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem("frennix:inline-startup-diag");
    sessionStorage.removeItem("frennix:startupSnapshots");
  } catch {
    // ignore
  }
}
