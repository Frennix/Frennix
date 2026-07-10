import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { usePathname, useRouter, useSegments } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
import { hideFrennixBootShell } from "@/lib/hide-boot-shell";
import { isAuthenticatedDestinationReady } from "@/lib/authenticated-startup-ready";
import {
  collectAuthRouteHandoffMetrics,
  isAuthenticatedHandoffStalled,
} from "@/lib/auth-route-handoff-metrics";
import { replaceWithAuthenticatedTabs } from "@/lib/auth-navigation";
import { getStartupMountEvents } from "@/lib/startup-mount-trace";
import { recordStartupSnapshot } from "@/lib/startup-snapshot-log";
import { WebAuthenticatedStartupFallback } from "@/components/WebAuthenticatedStartupFallback";
import {
  recordWebStartupCheckpoint,
  redactUserId,
  setWebStartupFailureCategory,
} from "@/lib/web-startup-checkpoints";
import { profileNeedsOnboardingRepair } from "@frennix/api";

const HANDOFF_RECOVERY_MS = 3_000;

/**
 * Web-only: if authenticated users remain on bootstrap "/" with empty root,
 * force tabs navigation and show a visible recovery screen after 3s.
 */
export function WebAuthRouteHandoffGuard() {
  const pathname = usePathname();
  const segments = useSegments();
  const router = useRouter();
  const { session, profile, authReady, signOut, refreshProfile } = useAuth();
  const [showRecovery, setShowRecovery] = useState(false);
  const handoffAttemptedRef = useRef(false);
  const reportedRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "web" || !authReady || !session?.user.id || !profile) {
      setShowRecovery(false);
      return;
    }
    if (!profile.onboarding_complete || profileNeedsOnboardingRepair(profile)) {
      setShowRecovery(false);
      return;
    }

    const metrics = collectAuthRouteHandoffMetrics({
      pathname,
      segments,
      mountTrace: getStartupMountEvents().map((event) => event.id),
    });

    recordStartupSnapshot("snapshot:interval", {
      route: pathname ?? "/",
      auth: {
        authReady,
        loading: false,
        profileLoading: false,
        hasSession: true,
        hasProfile: true,
        hasPersistedToken: true,
        passwordRecovery: false,
        userId: session.user.id,
      },
      detail: { handoff: metrics },
    });

    if (!handoffAttemptedRef.current && metrics.atBootstrapIndex) {
      handoffAttemptedRef.current = true;
      recordWebStartupCheckpoint("redirect:started", {
        target: "/(tabs)",
        method: "handoff-guard.replace",
        pathname: metrics.pathname,
        segments: metrics.segments,
      });
      replaceWithAuthenticatedTabs(router);
    }

    if (isAuthenticatedDestinationReady()) {
      setShowRecovery(false);
      hideFrennixBootShell();
      return;
    }

    const timer = setTimeout(() => {
      const latest = collectAuthRouteHandoffMetrics({
        pathname,
        segments,
        mountTrace: getStartupMountEvents().map((event) => event.id),
      });

      recordStartupSnapshot("snapshot:black-screen", {
        route: pathname ?? "/",
        auth: {
          authReady: true,
          loading: false,
          profileLoading: false,
          hasSession: true,
          hasProfile: true,
          hasPersistedToken: true,
          passwordRecovery: false,
          userId: session.user.id,
        },
        detail: { handoff: latest, reason: "auth-route-handoff-timeout" },
      });

      if (!isAuthenticatedHandoffStalled(latest, {
        authReady: true,
        hasSession: true,
        hasProfile: true,
      })) {
        return;
      }

      if (!reportedRef.current) {
        reportedRef.current = true;
        setWebStartupFailureCategory("timeout", "authenticated route handoff stalled on bootstrap index");
        recordWebStartupCheckpoint("startup:fallback-shown", {
          category: "timeout",
          route: pathname ?? "/",
          reason: "auth-route-handoff",
        });
      }

      hideFrennixBootShell();
      setShowRecovery(true);
    }, HANDOFF_RECOVERY_MS);

    return () => clearTimeout(timer);
  }, [
    authReady,
    pathname,
    profile,
    router,
    segments,
    session?.user.id,
  ]);

  if (!showRecovery || !session) return null;

  return (
    <WebAuthenticatedStartupFallback
      category="timeout"
      onRetry={() => {
        replaceWithAuthenticatedTabs(router);
        if (typeof window !== "undefined") {
          window.setTimeout(() => {
            if (!isAuthenticatedDestinationReady()) {
              window.location.reload();
            }
          }, 300);
        }
      }}
      onSignOut={() => {
        void signOut().finally(() => {
          if (typeof window !== "undefined") window.location.replace("/(auth)/login");
        });
      }}
    />
  );
}
