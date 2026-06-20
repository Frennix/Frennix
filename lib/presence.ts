import { AppState, Platform } from "react-native";
import { getSupabase, PRESENCE_HEARTBEAT_MS, setPresence } from "@frennix/api";

const PRESENCE_LOG = "[presence]";

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let trackingUserId: string | null = null;

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
  console.info(PRESENCE_LOG, "sendPresence", {
    isOnline,
    reason: reason ?? "unspecified",
    trackingUserId,
  });

  try {
    const {
      data: { session },
    } = await getSupabase().auth.getSession();

    if (!session?.user?.id) {
      console.warn(PRESENCE_LOG, "sendPresence skipped — no auth session on Supabase client", {
        isOnline,
        reason,
      });
      return;
    }

    console.info(PRESENCE_LOG, "calling setPresence RPC", {
      isOnline,
      userId: session.user.id,
      reason,
    });
    await setPresence(isOnline);
    console.info(PRESENCE_LOG, "setPresence OK", {
      isOnline,
      userId: session.user.id,
      reason,
    });
  } catch (error) {
    console.warn(PRESENCE_LOG, "setPresence failed", { isOnline, reason, error });
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
    void sendPresence(false, `switch-away-${previousUserId}`);
  } else {
    clearHeartbeat();
  }

  trackingUserId = userId;
  void sendPresence(true, reason ?? "start");
  startHeartbeat();
}

/** Stop heartbeats and mark offline (unless switching users). */
export function stopPresenceTracking(markOffline = true) {
  console.info(PRESENCE_LOG, "stopPresenceTracking", {
    markOffline,
    trackingUserId,
  });
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

  const onBackground = () => {
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
      else onBackground();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    const onPageHide = () => {
      console.info(PRESENCE_LOG, "pagehide", { userId });
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
    else if (nextState === "background" || nextState === "inactive") onBackground();
  });

  return () => {
    console.info(PRESENCE_LOG, "detachPresenceLifecycle (native)", { userId });
    subscription.remove();
    clearHeartbeat();
  };
}
