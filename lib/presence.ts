import { AppState, Platform } from "react-native";
import { getSupabase, PRESENCE_HEARTBEAT_MS, setPresence } from "@frennix/api";

const PRESENCE_LOG = "[presence]";
const PRESENCE_RPC_LOG = "[presence:rpc]";

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let trackingUserId: string | null = null;
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

async function waitForAuthSession(
  expectedUserId: string,
  maxAttempts = 10
): Promise<string | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const {
      data: { session },
      error,
    } = await getSupabase().auth.getSession();

    if (error) {
      console.warn(PRESENCE_LOG, "getSession error while waiting for auth", {
        attempt,
        expectedUserId,
        message: error.message,
      });
    } else if (session?.user?.id) {
      if (session.user.id !== expectedUserId) {
        console.warn(PRESENCE_LOG, "auth session user mismatch", {
          expectedUserId,
          actualUserId: session.user.id,
        });
      }
      console.info(PRESENCE_LOG, "auth session ready", {
        userId: session.user.id,
        attempt,
      });
      return session.user.id;
    }

    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  return null;
}

async function sendPresence(isOnline: boolean, reason?: string) {
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
  });

  await new Promise<void>((resolve) => {
    enqueuePresenceRpc(async () => {
      try {
        const {
          data: { session },
        } = await getSupabase().auth.getSession();

        if (!session?.user?.id) {
          console.warn(PRESENCE_RPC_LOG, "skipped", {
            rpcId,
            reason: reasonLabel,
            isOnline,
            enqueuedAt,
            note: "no auth session on Supabase client",
          });
          return;
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
  clearHeartbeat();
  heartbeatTimer = setInterval(() => {
    void sendPresence(true, "heartbeat");
  }, PRESENCE_HEARTBEAT_MS);
}

/** Mark the signed-in user online with periodic heartbeats. Offline only via stopPresenceTracking (sign-out). */
export function startPresenceTracking(userId: string, reason?: string) {
  console.info(PRESENCE_LOG, "startPresenceTracking", {
    userId,
    reason: reason ?? "unspecified",
    trackingUserId,
    hasHeartbeat: Boolean(heartbeatTimer),
  });

  if (trackingUserId === userId && heartbeatTimer) {
    void sendPresence(true, `${reason ?? "resume"}-already-active`);
    return;
  }

  if (trackingUserId && trackingUserId !== userId) {
    const previousUserId = trackingUserId;
    clearHeartbeat();
    trackingUserId = null;
    void sendPresence(false, `switch-away-${previousUserId}`);
  } else {
    clearHeartbeat();
  }

  trackingUserId = userId;
  void sendPresence(true, reason ?? "start");
  startHeartbeat();
}

/** Stop heartbeats and mark offline — sign-out only. */
export function stopPresenceTracking(markOffline = true, callerReason = "unspecified") {
  console.info(PRESENCE_LOG, "stopPresenceTracking", {
    markOffline,
    callerReason,
    trackingUserId,
  });
  clearHeartbeat();
  if (markOffline && trackingUserId) {
    void sendPresence(false, `stop:${callerReason}`);
  }
  trackingUserId = null;
}

/** App-wide foreground hooks: refresh online + heartbeat. Never mark offline on blur (sign-out only). */
export function attachPresenceLifecycle(userId: string): () => void {
  let activeGeneration = 0;
  const generation = ++activeGeneration;

  console.info(PRESENCE_LOG, "attachPresenceLifecycle", { userId, generation });

  void (async () => {
    const authUserId = await waitForAuthSession(userId);
    if (generation !== activeGeneration) {
      console.info(PRESENCE_LOG, "attachPresenceLifecycle stale — skipped start", {
        userId,
        generation,
      });
      return;
    }
    if (!authUserId) {
      console.warn(PRESENCE_LOG, "attachPresenceLifecycle aborted — no session", { userId });
      return;
    }
    startPresenceTracking(authUserId, "lifecycle-attach");
  })();

  const onForeground = () => {
    if (generation !== activeGeneration) return;
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
