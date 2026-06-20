import { AppState, Platform } from "react-native";
import { PRESENCE_HEARTBEAT_MS, setPresence } from "@frennix/api";

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let trackingUserId: string | null = null;

function clearHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

async function sendPresence(isOnline: boolean) {
  try {
    await setPresence(isOnline);
  } catch (error) {
    if (__DEV__) {
      console.warn("[presence] setPresence failed", { isOnline, error });
    }
  }
}

function startHeartbeat() {
  clearHeartbeat();
  heartbeatTimer = setInterval(() => {
    void sendPresence(true);
  }, PRESENCE_HEARTBEAT_MS);
}

/** Mark the signed-in user online with periodic heartbeats; offline on background/unmount. */
export function startPresenceTracking(userId: string) {
  if (trackingUserId === userId && heartbeatTimer) return;
  stopPresenceTracking(false);
  trackingUserId = userId;
  void sendPresence(true);
  startHeartbeat();
}

/** Stop heartbeats and mark offline (unless switching users). */
export function stopPresenceTracking(markOffline = true) {
  clearHeartbeat();
  if (markOffline && trackingUserId) {
    void sendPresence(false);
  }
  trackingUserId = null;
}

/** App-wide foreground/background hooks for presence. Returns cleanup. */
export function attachPresenceLifecycle(userId: string): () => void {
  startPresenceTracking(userId);

  const onForeground = () => {
    void sendPresence(true);
    startHeartbeat();
  };

  const onBackground = () => {
    clearHeartbeat();
    void sendPresence(false);
  };

  if (Platform.OS === "web" && typeof document !== "undefined") {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") onForeground();
      else onBackground();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    const onPageHide = () => {
      void sendPresence(false);
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      stopPresenceTracking(true);
    };
  }

  const subscription = AppState.addEventListener("change", (nextState) => {
    if (nextState === "active") onForeground();
    else if (nextState === "background" || nextState === "inactive") onBackground();
  });

  return () => {
    subscription.remove();
    stopPresenceTracking(true);
  };
}
