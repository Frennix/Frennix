import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useAuth } from "@/providers/AuthProvider";
import { hideFrennixBootShell } from "@/lib/hide-boot-shell";
import { isAuthenticatedDestinationReady } from "@/lib/authenticated-startup-ready";
import { logDiagnostic } from "@/lib/client-diagnostics";
import { reportStartupStall } from "@/lib/startup-diagnostics";
import { PostLoginFailureScreen } from "@/components/PostLoginFailureScreen";

const AUTHENTICATED_STARTUP_TIMEOUT_MS = 5_000;

/**
 * Hard fallback after login: if feed/onboarding/error UI is not visible within 5s,
 * show retry + logout instead of a blank black screen.
 */
export function AuthenticatedStartupWatchdog() {
  const { session, authReady, signOut, refreshProfile } = useAuth();
  const [stalled, setStalled] = useState(false);
  const armedRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!session?.user.id || !authReady) {
      armedRef.current = false;
      setStalled(false);
      return;
    }

    armedRef.current = true;
    setStalled(false);

    const clearIfReady = () => {
      if (isAuthenticatedDestinationReady()) {
        setStalled(false);
        return true;
      }
      return false;
    };

    if (clearIfReady()) return;

    const poll = setInterval(clearIfReady, 200);
    const timer = setTimeout(() => {
      if (!armedRef.current) return;
      if (isAuthenticatedDestinationReady()) return;

      logDiagnostic("auth", "authenticated startup stalled past 5s", "error", {
        userId: session.user.id.slice(0, 8),
        path: typeof location !== "undefined" ? location.pathname : undefined,
      });
      reportStartupStall("Authenticated startup stalled past 5s", {
        hasSession: true,
        hasProfile: null,
        userId: session.user.id,
        email: session.user.email ?? undefined,
      });
      hideFrennixBootShell();
      setStalled(true);
    }, AUTHENTICATED_STARTUP_TIMEOUT_MS);

    return () => {
      clearInterval(poll);
      clearTimeout(timer);
    };
  }, [session?.user.id, session?.user.email, authReady]);

  if (!stalled || !session) return null;

  return (
    <PostLoginFailureScreen
      title="Account loading stalled"
      message="We're having trouble loading your account. Please retry or log out."
      detail={
        typeof location !== "undefined"
          ? `Stuck at ${location.pathname} — diagnostics can share this with support.`
          : undefined
      }
      onRetry={() => {
        hideFrennixBootShell();
        void refreshProfile(session.user.id).finally(() => {
          if (typeof window !== "undefined") window.location.reload();
        });
      }}
      onLogout={() => {
        void signOut().finally(() => {
          if (typeof window !== "undefined") window.location.replace("/(auth)/login");
        });
      }}
      overlay
      diagnosticSource="authenticated-startup-watchdog"
      diagnosticReason="Authenticated startup stalled past 5s without feed or onboarding"
    />
  );
}
