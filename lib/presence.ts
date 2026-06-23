import { AppState, Platform } from "react-native";
import { getSupabase, PRESENCE_HEARTBEAT_MS, setPresence } from "@frennix/api";
import { logMatchmakingError } from "@/lib/matchmaking-observability";

const PRESENCE_LOG = "[presence]";
const PRESENCE_RPC_LOG = "[presence:rpc]";
const OFFLINE_DEBOUNCE_MS = 2000;

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let offlineTimer: ReturnType<typeof setTimeout> | null = null;
let trackingUserId: string | null = null;
let signingOut = false;
let appInForeground = true;
let presenceEpoch = 0;
let presenceRpcSeq = 0;
let presenceRpcChain: Promise<void> = Promise.resolve();

function clearHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function cancelScheduledOffline() {
  if (offlineTimer) {
    clearTimeout(offlineTimer);
    offlineTimer = null;
  }
}

function enqueuePresenceRpc(run: () => Promise<void>) {
  presenceRpcChain = presenceRpcChain.then(run).catch(() => undefined);
}

function canSendOnlinePresence() {
  return !signingOut && Boolean(trackingUserId) && appInForeground;
}

async function sendPresence(isOnline: boolean, reason?: string, offlineEpoch?: number) {
  if (isOnline && !canSendOnlinePresence()) {
    console.info(PRESENCE_RPC_LOG, "skipped online", {
      reason: reason ?? "unspecified",
      signingOut,
      trackingUserId,
      appInForeground,
    });
    return;
  }

  const rpcId = ++presenceRpcSeq;
  const reasonLabel = reason ?? "unspecified";
  const enqueuedAt = new Date().toISOString();
  const enqueuedAtMs = Date.now();

  console.info(PRESENCE_RPC_LOG, "enqueue", {
    rpcId,
    reason: reasonLabel,
    isOnline,
    enqueuedAt,
    trackingUserId,
    signingOut,
    appInForeground,
    offlineEpoch: offlineEpoch ?? null,
    presenceEpoch,
  });

  await new Promise<void>((resolve) => {
    enqueuePresenceRpc(async () => {
      try {
        if (isOnline && !canSendOnlinePresence()) {
          console.info(PRESENCE_RPC_LOG, "skipped online at execution", {
            rpcId,
            reason: reasonLabel,
          });
          return;
        }

        const {
          data: { session },
        } = await getSupabase().auth.getSession();

        if (!session?.user?.id) {
          if (!isOnline) {
            console.info(PRESENCE_RPC_LOG, "skipped offline — no session", {
              rpcId,
              reason: reasonLabel,
            });
            return;
          }

          console.warn(PRESENCE_RPC_LOG, "skipped online — no session", {
            rpcId,
            reason: reasonLabel,
          });
          return;
        }

        if (!isOnline) {
          if (offlineEpoch !== undefined && offlineEpoch !== presenceEpoch) {
            console.info(PRESENCE_RPC_LOG, "skipped stale offline", {
              rpcId,
              reason: reasonLabel,
              offlineEpoch,
              presenceEpoch,
            });
            return;
          }

          if (reasonLabel.startsWith("background") && appInForeground) {
            console.info(PRESENCE_RPC_LOG, "skipped offline — back in foreground", {
              rpcId,
              reason: reasonLabel,
            });
            return;
          }
        }

        await setPresence(isOnline, isOnline ? undefined : reasonLabel);

        console.info(PRESENCE_RPC_LOG, "complete", {
          rpcId,
          reason: reasonLabel,
          isOnline,
          durationMs: Date.now() - enqueuedAtMs,
          userId: session.user.id,
        });
      } catch (error) {
        console.warn(PRESENCE_RPC_LOG, "failed", {
          rpcId,
          reason: reasonLabel,
          isOnline,
          durationMs: Date.now() - enqueuedAtMs,
          error,
        });
        logMatchmakingError("presence", error, { reason: reasonLabel, isOnline });
      } finally {
        resolve();
      }
    });
  });
}

function startHeartbeat() {
  if (!canSendOnlinePresence()) return;

  clearHeartbeat();
  heartbeatTimer = setInterval(() => {
    void sendPresence(true, "heartbeat");
  }, PRESENCE_HEARTBEAT_MS);
}

function scheduleOffline(reason: string) {
  cancelScheduledOffline();
  const offlineEpoch = presenceEpoch;

  offlineTimer = setTimeout(() => {
    offlineTimer = null;
    if (appInForeground) return;
    if (!trackingUserId) return;
    void sendPresence(false, reason, offlineEpoch);
  }, OFFLINE_DEBOUNCE_MS);
}

function markForeground(reason: string) {
  appInForeground = true;
  presenceEpoch += 1;
  cancelScheduledOffline();

  if (!trackingUserId) return;

  void sendPresence(true, reason);
  startHeartbeat();
}

function markBackground(reason: string) {
  appInForeground = false;
  clearHeartbeat();
  scheduleOffline(reason);
}

/** Mark the signed-in user online with periodic heartbeats while foregrounded. */
export function startPresenceTracking(userId: string, reason?: string) {
  signingOut = false;
  appInForeground = true;
  presenceEpoch += 1;
  cancelScheduledOffline();

  console.info(PRESENCE_LOG, "startPresenceTracking", {
    userId,
    reason: reason ?? "unspecified",
    presenceEpoch,
  });

  if (trackingUserId === userId && heartbeatTimer) {
    void sendPresence(true, `${reason ?? "resume"}-already-active`);
    return;
  }

  if (trackingUserId && trackingUserId !== userId) {
    const previousUserId = trackingUserId;
    const switchEpoch = presenceEpoch;
    clearHeartbeat();
    trackingUserId = null;
    void sendPresence(false, `switch-away-${previousUserId}`, switchEpoch);
  } else {
    clearHeartbeat();
  }

  trackingUserId = userId;
  void sendPresence(true, reason ?? "start");
  startHeartbeat();
}

/** Stop heartbeats and mark offline — sign-out or background (after debounce). */
export async function stopPresenceTracking(
  markOffline = true,
  callerReason = "unspecified",
  explicitUserId?: string | null
) {
  const userIdForOffline = explicitUserId ?? trackingUserId;

  signingOut = true;
  clearHeartbeat();
  cancelScheduledOffline();
  trackingUserId = null;
  const offlineEpoch = ++presenceEpoch;

  console.info(PRESENCE_LOG, "stopPresenceTracking", {
    markOffline,
    callerReason,
    userIdForOffline,
    offlineEpoch,
  });

  try {
    if (!markOffline || !userIdForOffline) return;

    await sendPresence(false, `stop:${callerReason}`, offlineEpoch);
  } finally {
    signingOut = false;
  }
}

/** Foreground / background lifecycle — complements AuthProvider cold start. */
export function attachPresenceLifecycle(userId: string): () => void {
  let detached = false;

  console.info(PRESENCE_LOG, "attachPresenceLifecycle", { userId });

  if (Platform.OS === "web" && typeof document !== "undefined") {
    const onVisibilityChange = () => {
      if (detached) return;
      if (document.visibilityState === "visible") {
        markForeground("foreground-web");
      } else {
        markBackground("background-web-hidden");
      }
    };

    const onPageHide = () => {
      if (detached) return;
      markBackground("background-web-pagehide");
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      detached = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      clearHeartbeat();
      cancelScheduledOffline();
    };
  }

  const subscription = AppState.addEventListener("change", (nextState) => {
    if (detached) return;

    if (nextState === "active") {
      markForeground("foreground-native");
      return;
    }

    // iOS "inactive" (control center, app switcher) — stay online.
    if (nextState === "background") {
      markBackground("background-native");
    }
  });

  return () => {
    detached = true;
    subscription.remove();
    clearHeartbeat();
    cancelScheduledOffline();
  };
}
