import {
  formatStartupMountSummary,
  getStartupMountEvents,
  getStartupMountGap,
} from "@/lib/startup-mount-trace";
import { logDiagnostic } from "@/lib/client-diagnostics";
import { trackStartupStall } from "@/lib/beta-health-analytics";
import { reportClientError } from "@/lib/report-client-error";

export type StartupStallContext = {
  loading?: boolean;
  profileLoading?: boolean;
  hasSession?: boolean;
  hasProfile?: boolean;
  authForced?: boolean;
  userId?: string;
  email?: string;
};

let lastReportAt = 0;
const REPORT_COOLDOWN_MS = 30_000;

/** Auto-report startup/auth stalls to Beta Diagnostics + product analytics. */
export function reportStartupStall(
  reason: string,
  context: StartupStallContext = {}
): void {
  const now = Date.now();
  if (now - lastReportAt < REPORT_COOLDOWN_MS) return;
  lastReportAt = now;

  const gap = getStartupMountGap();
  const summary = formatStartupMountSummary(12);
  const trace = getStartupMountEvents().slice(-24).map((event) => event.id);

  logDiagnostic("startup", reason, "error", {
    startup_gap: gap,
    mount_summary: summary,
    trace,
    ...context,
  });

  trackStartupStall(gap ?? reason);

  void reportClientError({
    source: "startup.stall",
    error: new Error(reason),
    userId: context.userId,
    email: context.email,
    screen: "startup",
    extra: {
      startup_gap: gap,
      mount_summary: summary,
      trace,
      ...context,
    },
  });
}
