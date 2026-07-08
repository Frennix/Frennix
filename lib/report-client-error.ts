import { Platform } from "react-native";
import { submitCrashReport } from "@frennix/api";
import {
  buildDiagnosticReport,
  formatDiagnosticError,
  formatDiagnosticErrorStack,
  logDiagnostic,
  setDiagnosticContext,
} from "@/lib/client-diagnostics";
import { getFeedbackContext } from "@/lib/feedback-context";
import { Sentry } from "@/lib/sentry";

type ReportInput = {
  source: string;
  error: unknown;
  componentStack?: string | null;
  userId?: string;
  email?: string;
  screen?: string;
  extra?: Record<string, unknown>;
};

const reportedFingerprints = new Set<string>();
const REPORT_DEDUPE_MS = 60_000;
const recentReports = new Map<string, number>();

function fingerprint(source: string, error: unknown): string {
  const message = formatDiagnosticError(error);
  return `${source}::${message}`.slice(0, 240);
}

function shouldReport(fp: string): boolean {
  const now = Date.now();
  const last = recentReports.get(fp);
  if (last && now - last < REPORT_DEDUPE_MS) return false;
  recentReports.set(fp, now);
  return true;
}

export async function reportClientError(input: ReportInput): Promise<void> {
  const fp = fingerprint(input.source, input.error);
  if (reportedFingerprints.has(fp) && !shouldReport(fp)) return;
  reportedFingerprints.add(fp);

  const message = formatDiagnosticError(input.error);
  const stack = formatDiagnosticErrorStack(input.error);
  setDiagnosticContext({
    userId: input.userId,
    email: input.email,
    screen: input.screen,
    lastFailure: `${input.source}: ${message}`,
  });

  logDiagnostic(input.source, message, "error", {
    stack,
    componentStack: input.componentStack ?? undefined,
    ...input.extra,
  });

  try {
    Sentry.captureException(input.error instanceof Error ? input.error : new Error(message), {
      tags: { source: input.source, platform: Platform.OS },
      extra: {
        componentStack: input.componentStack,
        screen: input.screen,
        ...input.extra,
      },
    });
  } catch {
    // Sentry optional
  }

  if (!input.userId) return;

  const ctx = getFeedbackContext(input.screen);
  const report = buildDiagnosticReport({
    source: input.source,
    error_message: message,
    stack,
    component_stack: input.componentStack,
    ...input.extra,
  });

  try {
    await submitCrashReport({
      user_id: input.userId,
      message: `[${input.source}] ${message}`,
      screen_path: input.screen ?? ctx.screen_path,
      app_version: ctx.app_version,
      platform: ctx.platform,
      os_version: ctx.os_version,
      browser: ctx.browser,
      build_number: ctx.build_number,
      metadata: report,
    });
    logDiagnostic("crash-report", "saved diagnostic report to Supabase", "info", { source: input.source });
  } catch (reportError) {
    logDiagnostic("crash-report", "failed to save diagnostic report", "error", {
      error: formatDiagnosticError(reportError),
    });
  }
}
