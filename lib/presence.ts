import { AppState, Platform } from "react-native";
import { getSupabase, PRESENCE_HEARTBEAT_MS, setPresence } from "@frennix/api";

const PRESENCE_LOG = "[presence]";
const PRESENCE_RPC_LOG = "[presence:rpc]";
const PRESENCE_FALSE_LOG = "[presence:false]";

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let trackingUserId: string | null = null;
let presenceRpcSeq = 0;

function captureCallStack(): string {
  return new Error("presence offline").stack?.split("\n").slice(1, 12).join("\n") ?? "";
}

/** Always-on log when the client is about to send set_presence(false). */
function logSetPresenceFalse(
  reason: string,
  source: string,
  extra?: Record<string, unknown>
) {
  console.warn(PRESENCE_FALSE_LOG, "setPresence(false)", {
    reason,
    source,
    trackingUserId,
    stack: captureCallStack(),
    ...extra,
  });
}

function clearHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
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

  if (!isOnline) {
    logSetPresenceFalse(reasonLabel, "sendPresence", { rpcId, enqueuedAt });
  }

  console.info(PRESENCE_RPC_LOG, "enqueue", {
    rpcId,
    reason: reasonLabel,
    isOnline,
    enqueuedAt,
    trackingUserId,
  });

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

    await setPresence(isOnline);

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
  }
}

function startHeartbeat() {
  clearHeartbeat();
  heartbeatTimer = setInterval(() => {
    void sendPresence(true, "heartbeat");
  }, PRESENCE_HEARTBEAT_MS);
}

/** Wait for Supabase auth session, then mark online and start heartbeats. */
export async function ensurePresenceOnline(userId: string, reason?: string) {
  console.info(PRESENCE_LOG, "ensurePresenceOnline", { userId, reason: reason ?? "unspecified" });
  const authUserId = await waitForAuthSession(userId);
  if (!authUserId) {
    console.warn(PRESENCE_LOG, "ensurePresenceOnline aborted — no session after retries", {
      userId,
      reason,
    });
    return;
  }
  startPresenceTracking(authUserId, reason);
}

/** Mark the signed-in user online with periodic heartbeats; offline on background/sign-out. */
export function startPresenceTracking(userId: string, reason?: string) {
  console.log("[presence] tracking started", {
    userId,
    reason: reason ?? "unspecified",
  });
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
    const switchReason = `switch-away-${previousUserId}`;
    logSetPresenceFalse(switchReason, "startPresenceTracking.user-switch", {
      previousUserId,
      nextUserId: userId,
    });
    void sendPresence(false, switchReason);
  } else {
    clearHeartbeat();
  }

  trackingUserId = userId;
  void sendPresence(true, reason ?? "start");
  startHeartbeat();
}

/** Stop heartbeats and mark offline (unless switching users). */
export function stopPresenceTracking(markOffline = true, callerReason = "unspecified") {
  console.info(PRESENCE_LOG, "stopPresenceTracking", {
    markOffline,
    callerReason,
    trackingUserId,
  });
  if (markOffline) {
    logSetPresenceFalse("stop", "stopPresenceTracking", {
      callerReason,
      willSendRpc: Boolean(trackingUserId),
    });
  }
  clearHeartbeat();
  if (markOffline && trackingUserId) {
    void sendPresence(false, "stop");
  }
  trackingUserId = null;
}

/** App-wide foreground/background hooks for presence. Returns cleanup. */
export function attachPresenceLifecycle(userId: string): () => void {
  console.info(PRESENCE_LOG, "attachPresenceLifecycle", { userId });
  void ensurePresenceOnline(userId, "lifecycle-attach");

  const onForeground = () => {
    void sendPresence(true, "foreground");
    startHeartbeat();
  };

  const onBackground = (lifecycleSource: string) => {
    logSetPresenceFalse("background", lifecycleSource, { userId });
    clearHeartbeat();
    void sendPresence(false, "background");
  };

  if (Platform.OS === "web" && typeof document !== "undefined") {
    const onVisibilityChange = () => {
      console.info(PRESENCE_LOG, "visibilitychange", {
        state: document.visibilityState,
        userId,
      });
      if (document.visibilityState === "visible") onForeground();
      else onBackground("attachPresenceLifecycle.visibilitychange");
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    const onPageHide = () => {
      console.info(PRESENCE_LOG, "pagehide", { userId });
      logSetPresenceFalse("pagehide", "attachPresenceLifecycle.pagehide", { userId });
      void sendPresence(false, "pagehide");
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      console.info(PRESENCE_LOG, "detachPresenceLifecycle (web)", { userId });
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      clearHeartbeat();
    };
  }

  const subscription = AppState.addEventListener("change", (nextState) => {
    console.info(PRESENCE_LOG, "AppState change", { nextState, userId });
    if (nextState === "active") onForeground();
    else if (nextState === "background" || nextState === "inactive") {
      onBackground(`attachPresenceLifecycle.AppState.${nextState}`);
    }
  });

  return () => {
    console.info(PRESENCE_LOG, "detachPresenceLifecycle (native)", { userId });
    subscription.remove();
    clearHeartbeat();
  };
}
