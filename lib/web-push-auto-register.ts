import type { QueryClient } from "@tanstack/react-query";
import {
  applyWebPushPreferenceOnSuccess,
  completeWebPushSubscription,
  getWebPushPermissionStatus,
  hasActiveWebPushSubscription,
  isWebPushFeatureEnabled,
  prewarmWebPushRegistration,
  type WebPushSubscribeFailureReason,
  type WebPushSubscribeResult,
} from "@/lib/web-push";
import { canPromptForWebPush } from "@/lib/pwa";
import { pushLog, logPushSetupFunnel } from "@/lib/web-push-diagnostics";
import { shouldShowPwaReopenNotice } from "@/lib/pwa-update-prompt";
import { showPwaReopenNotice } from "@/components/PwaReopenNotice";
import {
  clearWebPushPermissionDenied,
  markWebPushPermissionDenied,
  wasWebPushPermissionDenied,
} from "@/lib/web-push-prompt";

export type AutoRegisterOutcome =
  | { status: "skipped"; reason: string }
  | { status: "already_enabled" }
  | { status: "success"; endpoint: string; justRegistered: boolean }
  | { status: "failed"; result: WebPushSubscribeResult };

const RETRY_DELAYS_MS = [5_000, 15_000, 60_000, 300_000] as const;

let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;
let inFlight: Promise<AutoRegisterOutcome> | null = null;

function isRetryable(reason: WebPushSubscribeFailureReason): boolean {
  return reason === "save_failed" || reason === "subscribe_failed" || reason === "sw_failed";
}

function clearRetryTimer() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  retryAttempt = 0;
}

export function scheduleWebPushAutoRegisterRetry(
  userId: string,
  queryClient: QueryClient,
  onComplete?: (outcome: AutoRegisterOutcome) => void
) {
  clearRetryTimer();
  const delay = RETRY_DELAYS_MS[Math.min(retryAttempt, RETRY_DELAYS_MS.length - 1)];
  retryAttempt += 1;
  pushLog("auto_register.retry_scheduled", `in ${delay}ms`, { attempt: retryAttempt });

  retryTimer = setTimeout(() => {
    retryTimer = null;
    void runAutoWebPushRegistration(userId, queryClient, { source: "retry" }).then((outcome) => {
      onComplete?.(outcome);
      if (outcome.status === "failed" && isRetryable(outcome.result.reason)) {
        scheduleWebPushAutoRegisterRetry(userId, queryClient, onComplete);
      }
    });
  }, delay);
}

function maybeShowReopenNotice(latestVersion: string | null, permission: NotificationPermission | "unsupported") {
  if (permission !== "granted") return;
  if (!shouldShowPwaReopenNotice(latestVersion)) return;
  showPwaReopenNotice();
}

export async function runAutoWebPushRegistration(
  userId: string,
  queryClient: QueryClient,
  options?: { source?: "bootstrap" | "permission" | "retry" | "resume" | "activity" }
): Promise<AutoRegisterOutcome> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const source = options?.source ?? "bootstrap";
    pushLog("auto_register.start", source, { userId: userId.slice(0, 8) });

    if (!userId || !canPromptForWebPush()) {
      return { status: "skipped", reason: "unsupported_environment" };
    }

    if (!(await isWebPushFeatureEnabled())) {
      return { status: "skipped", reason: "feature_off" };
    }

    const swResult = await prewarmWebPushRegistration();
    if (!swResult.ok) {
      if (swResult.reason === "needs_reopen") {
        const permission = await getWebPushPermissionStatus();
        const alreadyWorking =
          permission === "granted" && (await hasActiveWebPushSubscription({ logStep: "subscribe.check" }));
        if (!alreadyWorking) {
          maybeShowReopenNotice(swResult.latestVersion, permission);
        }
        scheduleWebPushAutoRegisterRetry(userId, queryClient);
        return { status: "skipped", reason: "sw_needs_reopen" };
      }
      return { status: "skipped", reason: "unsupported_environment" };
    }

    const permission = await getWebPushPermissionStatus();
    if (permission === "denied") {
      await markWebPushPermissionDenied();
      return { status: "skipped", reason: "permission_denied" };
    }

    if (permission !== "granted") {
      return { status: "skipped", reason: "permission_not_granted" };
    }

    await clearWebPushPermissionDenied();

    const hadSubscription = await hasActiveWebPushSubscription({ logStep: "subscribe.check" });
    const result = await completeWebPushSubscription(userId);

    if (!result.ok) {
      pushLog("auto_register.failed", result.reason, result.message);
      if (result.reason === "sw_failed") {
        maybeShowReopenNotice(swResult.latestVersion, permission);
      }
      if (isRetryable(result.reason)) {
        scheduleWebPushAutoRegisterRetry(userId, queryClient);
      }
      return { status: "failed", result };
    }

    clearRetryTimer();

    const verified = await hasActiveWebPushSubscription({ logStep: "subscribe.post_check" });
    if (!verified) {
      const verifyFail: WebPushSubscribeResult = {
        ok: false,
        reason: "subscribe_failed",
        message: "Subscription was not verified after save.",
      };
      scheduleWebPushAutoRegisterRetry(userId, queryClient);
      return { status: "failed", result: verifyFail };
    }

    await applyWebPushPreferenceOnSuccess(userId, queryClient);
    logPushSetupFunnel("preference_enabled", "push_enabled set to true", { source });
    pushLog("auto_register.success", result.endpoint.slice(0, 72), { source, hadSubscription });

    return {
      status: "success",
      endpoint: result.endpoint,
      justRegistered: !hadSubscription || source === "permission",
    };
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

/** Silent registration when permission is already granted (e.g. re-opened from Settings). */
export async function resumeWebPushRegistrationIfNeeded(
  userId: string,
  queryClient: QueryClient,
  onEnabled?: () => void
): Promise<void> {
  if (!userId || !canPromptForWebPush()) return;

  const permission = await getWebPushPermissionStatus();
  if (permission === "granted") {
    const wasDenied = await wasWebPushPermissionDenied();
    if (wasDenied) await clearWebPushPermissionDenied();
    const outcome = await runAutoWebPushRegistration(userId, queryClient, { source: "resume" });
    if (outcome.status === "success" && outcome.justRegistered) {
      onEnabled?.();
    }
    return;
  }

  if (permission === "denied") {
    await markWebPushPermissionDenied();
  }
}
