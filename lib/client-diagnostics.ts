import Constants from "expo-constants";
import { Platform } from "react-native";
import { getPushLogs } from "@/lib/web-push-diagnostics";
import { isWebStandalone } from "@/lib/pwa";

export type DiagnosticLevel = "info" | "warn" | "error";

export type DiagnosticEntry = {
  id: string;
  ts: number;
  level: DiagnosticLevel;
  category: string;
  message: string;
  data?: Record<string, unknown>;
};

export type ApiDiagnosticEntry = {
  id: string;
  ts: number;
  method: string;
  endpoint: string;
  status?: number;
  durationMs?: number;
  ok: boolean;
  error?: string;
  supabaseCode?: string;
};

export type ClientDiagnosticContext = {
  userId?: string;
  email?: string;
  screen?: string;
  lastSuccess?: string;
  lastFailure?: string;
  online: boolean;
  pushStatus?: string;
};

const MAX_ENTRIES = 200;
const MAX_API_ENTRIES = 120;

const entries: DiagnosticEntry[] = [];
const apiEntries: ApiDiagnosticEntry[] = [];
const listeners = new Set<() => void>();

let context: ClientDiagnosticContext = { online: true };
let entryCounter = 0;

function nextId(prefix: string) {
  entryCounter += 1;
  return `${prefix}-${entryCounter}-${Date.now()}`;
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeClientDiagnostics(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDiagnosticEntries(): DiagnosticEntry[] {
  return [...entries];
}

export function getApiDiagnosticEntries(): ApiDiagnosticEntry[] {
  return [...apiEntries];
}

export function getDiagnosticContext(): ClientDiagnosticContext {
  return { ...context };
}

export function setDiagnosticContext(patch: Partial<ClientDiagnosticContext>) {
  context = { ...context, ...patch };
  emit();
}

export function setDiagnosticScreen(screen: string) {
  setDiagnosticContext({ screen });
  logDiagnostic("navigation", `screen:${screen}`, "info");
}

export function markDiagnosticSuccess(action: string, data?: Record<string, unknown>) {
  setDiagnosticContext({ lastSuccess: action });
  logDiagnostic("action", action, "info", data);
}

export function markDiagnosticFailure(action: string, error: unknown, data?: Record<string, unknown>) {
  const message = formatDiagnosticError(error);
  setDiagnosticContext({ lastFailure: `${action}: ${message}` });
  logDiagnostic("action", action, "error", { ...data, error: message });
}

export function logDiagnostic(
  category: string,
  message: string,
  level: DiagnosticLevel = "info",
  data?: Record<string, unknown>
) {
  const entry: DiagnosticEntry = {
    id: nextId("diag"),
    ts: Date.now(),
    level,
    category,
    message,
    data,
  };
  entries.unshift(entry);
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  const tag = `[frennix-diag:${category}]`;
  if (level === "error") console.error(tag, message, data ?? "");
  else if (level === "warn") console.warn(tag, message, data ?? "");
  else console.log(tag, message, data ?? "");
  emit();
}

export function logApiDiagnostic(input: {
  method: string;
  endpoint: string;
  status?: number;
  durationMs?: number;
  ok: boolean;
  error?: unknown;
  supabaseCode?: string;
}) {
  const errorMessage = input.error ? formatDiagnosticError(input.error) : undefined;
  const entry: ApiDiagnosticEntry = {
    id: nextId("api"),
    ts: Date.now(),
    method: input.method,
    endpoint: input.endpoint,
    status: input.status,
    durationMs: input.durationMs,
    ok: input.ok,
    error: errorMessage,
    supabaseCode: input.supabaseCode,
  };
  apiEntries.unshift(entry);
  if (apiEntries.length > MAX_API_ENTRIES) apiEntries.length = MAX_API_ENTRIES;

  logDiagnostic(
    "api",
    `${input.method} ${input.endpoint} → ${input.ok ? "ok" : "fail"}${input.status ? ` (${input.status})` : ""}`,
    input.ok ? "info" : "error",
    {
      status: input.status,
      durationMs: input.durationMs,
      error: errorMessage,
      supabaseCode: input.supabaseCode,
    }
  );
}

export function formatDiagnosticError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const parts = [
      record.code ? String(record.code) : null,
      record.message ? String(record.message) : null,
      record.details ? String(record.details) : null,
      record.hint ? String(record.hint) : null,
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(" | ");
  }
  return String(error);
}

export function formatDiagnosticErrorStack(error: unknown): string | undefined {
  if (error instanceof Error && error.stack) return error.stack;
  return undefined;
}

function readBrowser(): string | null {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return null;
  return navigator.userAgent ?? null;
}

function readAppVersion(): string | null {
  return Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? null;
}

function readBuildNumber(): string | null {
  const config = Constants.expoConfig;
  if (!config) return Constants.nativeBuildVersion ?? null;
  if (config.ios?.buildNumber) return String(config.ios.buildNumber);
  if (config.android?.versionCode != null) return String(config.android.versionCode);
  return Constants.nativeBuildVersion ?? null;
}

export function buildDiagnosticReport(extra?: Record<string, unknown>) {
  const pushLogs = Platform.OS === "web" ? getPushLogs().slice(0, 40) : [];
  return {
    generated_at: new Date().toISOString(),
    context: getDiagnosticContext(),
    device: {
      platform: Platform.OS,
      os_version: Platform.Version != null ? String(Platform.Version) : null,
      browser: readBrowser(),
      standalone: Platform.OS === "web" ? isWebStandalone() : null,
      online: context.online,
    },
    app: {
      version: readAppVersion(),
      build_number: readBuildNumber(),
    },
    entries: getDiagnosticEntries().slice(0, 80),
    api_requests: getApiDiagnosticEntries().slice(0, 60),
    push_logs: pushLogs,
    startup_trace:
      typeof globalThis !== "undefined"
        ? (globalThis as { __FRENNIX_MOUNT_TRACE__?: unknown }).__FRENNIX_MOUNT_TRACE__
        : undefined,
    startup_snapshots:
      typeof globalThis !== "undefined"
        ? (globalThis as { __FRENNIX_STARTUP_SNAPSHOTS__?: unknown }).__FRENNIX_STARTUP_SNAPSHOTS__
        : undefined,
    startup_errors:
      typeof globalThis !== "undefined"
        ? (globalThis as { __FRENNIX_STARTUP_SNAPSHOTS__?: Array<{ uncaughtErrors?: unknown }> })
            .__FRENNIX_STARTUP_SNAPSHOTS__
            ?.flatMap((snapshot) => snapshot.uncaughtErrors ?? [])
        : undefined,
    feed_trace:
      typeof globalThis !== "undefined"
        ? (globalThis as { __FRENNIX_FEED_RENDER_TRACE__?: unknown }).__FRENNIX_FEED_RENDER_TRACE__
        : undefined,
    extra,
  };
}

export function formatDiagnosticReportText(report = buildDiagnosticReport()): string {
  return JSON.stringify(report, null, 2);
}
