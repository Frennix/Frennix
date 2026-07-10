import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { usePathname } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
import { collectPostLoginDiagnosticSnapshot } from "@/lib/post-login-diagnostic-state";
import { reportClientError } from "@/lib/report-client-error";
import { buildStartupAuthState, recordStartupSnapshot } from "@/lib/startup-snapshot-log";
import { isIosSafariBrowser, isIosWebDevice, isWebStandalone } from "@/lib/pwa";
import { getStartupMountEvents } from "@/lib/startup-mount-trace";
import { measureAuthenticatedFeedVisibility } from "@/lib/authenticated-feed-visibility";

const POLL_MS = 2_000;
const REPORT_COOLDOWN_MS = 60_000;

function isSafariOrPwaTarget(): boolean {
  if (Platform.OS !== "web") return false;
  return isWebStandalone() || isIosSafariBrowser() || isIosWebDevice();
}

/**
 * Client-side logging for Safari/PWA post-login black screens.
 * Reports collapse pattern even when tab bar text satisfies legacy ready checks.
 */
export function PostLoginBlackScreenMonitor() {
  const pathname = usePathname();
  const { session, profile, authReady, loading, profileLoading } = useAuth();
  const lastReportRef = useRef(0);

  useEffect(() => {
    if (Platform.OS !== "web" || !session?.user.id || !authReady) return;

    const tick = () => {
      const snap = collectPostLoginDiagnosticSnapshot({
        authReady,
        hasSession: Boolean(session),
        profile,
        route: pathname ?? "/",
        mountTraceTail: getStartupMountEvents().slice(-12).map((e) => e.id),
      });

      const feedLayout = measureAuthenticatedFeedVisibility();
      const authState = buildStartupAuthState({
        authReady,
        loading,
        profileLoading,
        session,
        profile,
        passwordRecovery: false,
      });

      if (
        snap.blackScreenSuspected ||
        (feedLayout.feedTabSceneH > 80 && !feedLayout.feedRootVisible && !feedLayout.feedScrollVisible)
      ) {
        recordStartupSnapshot("snapshot:black-screen", {
          auth: authState,
          route: snap.route,
          detail: {
            ...snap,
            feed_layout: feedLayout,
            monitor: "PostLoginBlackScreenMonitor",
          },
        });

        const now = Date.now();
        if (now - lastReportRef.current < REPORT_COOLDOWN_MS) return;
        lastReportRef.current = now;

        if (!isSafariOrPwaTarget()) return;

        void reportClientError({
          source: "post-login-black-screen",
          error: new Error("Safari/PWA post-login black screen pattern"),
          userId: session.user.id,
          email: session.user.email ?? undefined,
          screen: snap.route,
          extra: {
            ...snap,
            feed_layout: feedLayout,
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          },
        });
      }
    };

    const id = window.setInterval(tick, POLL_MS);
    tick();
    return () => window.clearInterval(id);
  }, [
    authReady,
    loading,
    pathname,
    profile,
    profileLoading,
    session,
  ]);

  return null;
}
