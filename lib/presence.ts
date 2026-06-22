import { AppState, Platform } from "react-native";
import { getSupabase, PRESENCE_HEARTBEAT_MS, setPresence } from "@frennix/api";

const PRESENCE_LOG = "[presence]";
const PRESENCE_RPC_LOG = "[presence:rpc]";

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let trackingUserId: string | null = null;
let signingOut = false;
let presenceEpoch = 0;
let presenceRpcSeq = 0;
let presenceRpcChain: Promise<void> = Promise.resolve();

function clearHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function enqueuePresenceRpc(run: () => Promise<void>) {
  presenceRpcChain = presenceRpcChain.then(run).catch(() => undefined);
}

function canSendOnlinePresence() {
  return !signingOut && Boolean(trackingUserId);
}

async function sendPresence(isOnline: boolean, reason?: string, offlineEpoch?: number) {
  if (isOnline && !canSendOnlinePresence()) {
    console.info(PRESENCE_RPC_LOG, "skipped online", {
      reason: reason ?? "unspecified",
      signingOut,
      trackingUserId,
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
            signingOut,
            trackingUserId,
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

          console.warn(PRESENCE_RPC_LOG, "skipped", {
            rpcId,
            reason: reasonLabel,
            isOnline,
            enqueuedAt,
            note: "no auth session on Supabase client",
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
              userId: session.user.id,
            });
            return;
          }
        }

        await setPresence(isOnline, isOnline ? undefined : reasonLabel);

        const completedAt = new Date().toISOString();
        console.info(PRESENCE_RPC_LOG, "complete", {
          rpcId,
          reason: reasonLabel,
          isOnline,
          enqueuedAt,
          completedAt,
          durationMs: Date.now() - enqueuedAtMs,
          userId: session.user.id,
        });
      } catch (error) {
        const completedAt = new Date().toISOString();
        console.warn(PRESENCE_RPC_LOG, "failed", {
          rpcId,
          reason: reasonLabel,
          isOnline,
          enqueuedAt,
          completedAt,
          durationMs: Date.now() - enqueuedAtMs,
          error,
        });
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

/** Mark the signed-in user online with periodic heartbeats. Offline only via stopPresenceTracking (sign-out). */
export function startPresenceTracking(userId: string, reason?: string) {
  signingOut = false;
  presenceEpoch += 1;

  console.info(PRESENCE_LOG, "startPresenceTracking", {
    userId,
    reason: reason ?? "unspecified",
    trackingUserId,
    hasHeartbeat: Boolean(heartbeatTimer),
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

/**
 * Stop heartbeats and mark offline — sign-out only.
 * Pass explicitUserId from AuthProvider session so offline still runs if module tracking state was lost.
 */
export async function stopPresenceTracking(
  markOffline = true,
  callerReason = "unspecified",
  explicitUserId?: string | null
) {
  const userIdForOffline = explicitUserId ?? trackingUserId;

  signingOut = true;
  clearHeartbeat();
  trackingUserId = null;
  presenceEpoch += 1;

  console.info(PRESENCE_LOG, "stopPresenceTracking", {
    markOffline,
    callerReason,
    userIdForOffline,
    explicitUserId: explicitUserId ?? null,
    presenceEpoch,
  });

  try {
    if (!markOffline || !userIdForOffline) {
      if (markOffline) {
        console.info(PRESENCE_LOG, "stopPresenceTracking skipped offline — no user id", {
          callerReason,
        });
      }
      return;
    }

    await presenceRpcChain;

    const {
      data: { session },
    } = await getSupabase().auth.getSession();

    if (!session?.user?.id) {
      console.warn(PRESENCE_LOG, "stopPresenceTracking skipped offline — no auth session", {
        callerReason,
        userIdForOffline,
      });
      return;
    }

    console.info(PRESENCE_LOG, "stopPresenceTracking direct offline RPC", {
      callerReason,
      userId: session.user.id,
    });
    await setPresence(false, `stop:${callerReason}`);
  } catch (error) {
    console.warn(PRESENCE_LOG, "stopPresenceTracking offline RPC failed", {
      callerReason,
      userIdForOffline,
      error,
    });
  } finally {
    signingOut = false;
  }
}

/** Foreground hooks only — refresh online + heartbeat. Cold start is owned by AuthProvider. */
export function attachPresenceLifecycle(userId: string): () => void {
  let activeGeneration = 0;
  const generation = ++activeGeneration;

  console.info(PRESENCE_LOG, "attachPresenceLifecycle", { userId, generation });

  const onForeground = () => {
    if (generation !== activeGeneration) return;
    if (!canSendOnlinePresence()) return;
    void sendPresence(true, "foreground");
    startHeartbeat();
  };

  if (Platform.OS === "web" && typeof document !== "undefined") {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") onForeground();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      activeGeneration += 1;
      console.info(PRESENCE_LOG, "detachPresenceLifecycle (web)", { userId, generation });
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearHeartbeat();
    };
  }

  const subscription = AppState.addEventListener("change", (nextState) => {
    if (nextState === "active") onForeground();
  });

  return () => {
    activeGeneration += 1;
    console.info(PRESENCE_LOG, "detachPresenceLifecycle (native)", { userId, generation });
    subscription.remove();
    clearHeartbeat();
  };
}
