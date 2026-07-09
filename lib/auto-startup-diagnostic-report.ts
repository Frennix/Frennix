import { Platform } from "react-native";
import { submitCrashReport } from "@frennix/api";
import {
  buildDiagnosticReport,
  formatDiagnosticReportText,
  getDiagnosticContext,
  logDiagnostic,
  setDiagnosticContext,
} from "@/lib/client-diagnostics";
import { getFeedbackContext } from "@/lib/feedback-context";
import { getStartupSnapshots, getStartupCapturedErrors } from "@/lib/startup-snapshot-log";
import { getStartupMountGap, formatStartupMountSummary } from "@/lib/startup-mount-trace";
import { hasPersistedAuthToken } from "@/lib/auth-storage";

const STORAGE_SENT_KEY = "frennix:startup-report-sent";
const DEDUPE_MS = 60_000;
const recentSends = new Map<string, number>();

export type StartupDiagnosticSendResult = {
  sent: boolean;
  reportRef: string;
  error?: string;
};

function nextReportRef(source: string) {
  return `${source}-${Date.now().toString(36)}`;
}

function shouldSend(source: string): boolean {
  const now = Date.now();
  const last = recentSends.get(source) ?? 0;
  if (now - last < DEDUPE_MS) return false;
  recentSends.set(source, now);
  return true;
}

function readSessionFromStorage(): { userId?: string; email?: string } {
  if (Platform.OS !== "web" || typeof window === "undefined") return {};
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key?.includes("auth-token")) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { user?: { id?: string; email?: string } };
      return { userId: parsed.user?.id, email: parsed.user?.email };
    }
  } catch {
    // ignore
  }
  return {};
}

/** Full startup diagnostic payload for copy/share — no navigation required. */
export function buildStartupDiagnosticReport(extra?: Record<string, unknown>) {
  const gap = getStartupMountGap();
  const mountSummary = formatStartupMountSummary(12);
  return buildDiagnosticReport({
    startup_failure: true,
    startup_gap: gap,
    mount_summary: mountSummary,
    startup_snapshot_count: getStartupSnapshots().length,
    startup_captured_errors: getStartupCapturedErrors(),
    has_persisted_auth_token: hasPersistedAuthToken(),
    ...extra,
  });
}

export function formatStartupDiagnosticReportText(extra?: Record<string, unknown>) {
  return formatDiagnosticReportText(buildStartupDiagnosticReport(extra));
}

/** Auto-send startup failure report to Supabase — works after login before profile loads. */
export async function sendStartupDiagnosticReport(input: {
  source: string;
  reason: string;
  userId?: string;
  email?: string;
  screen?: string;
  extra?: Record<string, unknown>;
}): Promise<StartupDiagnosticSendResult> {
  const reportRef = nextReportRef(input.source);

  if (!shouldSend(input.source)) {
    return { sent: false, reportRef, error: "deduped" };
  }

  const stored = readSessionFromStorage();
  const userId = input.userId ?? stored.userId ?? getDiagnosticContext().userId;
  const email = input.email ?? stored.email ?? getDiagnosticContext().email;

  setDiagnosticContext({ userId, email, screen: input.screen ?? "startup-failure", lastFailure: input.reason });

  const report = buildStartupDiagnosticReport({
    source: input.source,
    reason: input.reason,
    report_ref: reportRef,
    user_email: email ?? null,
    ...input.extra,
  });

  logDiagnostic("startup-report", `preparing auto report (${input.source})`, "info", {
    report_ref: reportRef,
    user_id: userId?.slice(0, 8),
    reason: input.reason,
  });

  if (!userId) {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(
          "frennix:pending-startup-report",
          JSON.stringify({ reportRef, reason: input.reason, report, at: new Date().toISOString() })
        );
      } catch {
        // ignore
      }
    }
    return { sent: false, reportRef, error: "no user id — report saved locally for copy" };
  }

  const ctx = getFeedbackContext(input.screen ?? "startup-failure");

  try {
    await submitCrashReport({
      user_id: userId,
      message: `[${input.source}] ${input.reason}`.slice(0, 4000),
      screen_path: input.screen ?? ctx.screen_path,
      app_version: ctx.app_version,
      platform: ctx.platform,
      os_version: ctx.os_version,
      browser: ctx.browser,
      build_number: ctx.build_number,
      metadata: report,
    });

    if (Platform.OS === "web" && typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(STORAGE_SENT_KEY, JSON.stringify({ reportRef, at: Date.now(), source: input.source }));
      } catch {
        // ignore
      }
    }

    logDiagnostic("startup-report", "auto-sent startup diagnostic report", "info", { report_ref: reportRef });
    return { sent: true, reportRef };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logDiagnostic("startup-report", "failed to auto-send startup report", "error", { report_ref: reportRef, error: message });
    return { sent: false, reportRef, error: message };
  }
}

export function getLastSentStartupReportRef(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_SENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { reportRef?: string };
    return parsed.reportRef ?? null;
  } catch {
    return null;
  }
}
