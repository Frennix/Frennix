import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { usePathname } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
import { hideFrennixBootShell } from "@/lib/hide-boot-shell";
import { isAuthenticatedDestinationReady } from "@/lib/authenticated-startup-ready";
import { measureAuthenticatedFeedVisibility } from "@/lib/authenticated-feed-visibility";
import { logDiagnostic } from "@/lib/client-diagnostics";
import { reportStartupStall } from "@/lib/startup-diagnostics";
import { reportClientError } from "@/lib/report-client-error";
import { WebAuthenticatedStartupFallback } from "@/components/WebAuthenticatedStartupFallback";
import {
  clearSafeTransientStartupState,
  recordWebStartupCheckpoint,
  redactUserId,
  setWebStartupFailureCategory,
  type WebStartupFailureCategory,
} from "@/lib/web-startup-checkpoints";

const AUTHENTICATED_STARTUP_TIMEOUT_MS = 8_000;

function resolveFailureCategory(input: {
  profileFetchFailed: boolean;
  profile: unknown;
  visibility: ReturnType<typeof measureAuthenticatedFeedVisibility>;
}): WebStartupFailureCategory {
  if (input.profileFetchFailed) return "profile";
  if (!input.profile) return "profile";
  if (!input.visibility.feedRootVisible && !input.visibility.feedScrollVisible) return "layout";
  return "timeout";
}

/**
 * Web-only guard: structured checkpoints, strict visual readiness, visible fallback.
 */
export function WebAuthenticatedStartupGuard() {
  const pathname = usePathname();
  const { session, profile, authReady, profileFetchFailed, signOut, refreshProfile } = useAuth();
  const [showFallback, setShowFallback] = useState(false);
  const [failureCategory, setFailureCategory] = useState<WebStartupFailureCategory>("timeout");
  const armedRef = useRef(false);
  const reportedRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "web" || !session?.user.id || !authReady) {
      armedRef.current = false;
      setShowFallback(false);
      return;
    }

    armedRef.current = true;
    setShowFallback(false);
    reportedRef.current = false;

    const evaluate = () => {
      const visibility = measureAuthenticatedFeedVisibility();
      if (visibility.ready) {
        recordWebStartupCheckpoint("feed-root:visible", {
          feedRootH: visibility.feedRootH,
          feedScrollH: visibility.feedScrollH,
          feedTabSceneH: visibility.feedTabSceneH,
        });
        setShowFallback(false);
        hideFrennixBootShell();
        return true;
      }
      return false;
    };

    if (evaluate()) return;

    const poll = setInterval(evaluate, 250);
    const timer = setTimeout(() => {
      if (!armedRef.current) return;
      if (isAuthenticatedDestinationReady()) return;

      const visibility = measureAuthenticatedFeedVisibility();
      const category = resolveFailureCategory({
        profileFetchFailed,
        profile,
        visibility,
      });

      setWebStartupFailureCategory(category, "authenticated startup did not become visually ready");
      recordWebStartupCheckpoint("feed-root:hidden", {
        feedRootH: visibility.feedRootH,
        feedScrollH: visibility.feedScrollH,
        feedTabSceneH: visibility.feedTabSceneH,
        tabBarH: visibility.tabBarH,
        feedRootDisplay: visibility.feedRootDisplay,
        feedRootOpacity: visibility.feedRootOpacity,
        userId: redactUserId(session.user.id),
      });
      recordWebStartupCheckpoint("startup:fallback-shown", { category, route: pathname ?? "/" });

      if (!reportedRef.current) {
        reportedRef.current = true;
        logDiagnostic("auth", "web authenticated startup fallback shown", "error", {
          userId: redactUserId(session.user.id),
          path: pathname,
          category,
          visibility,
        });
        reportStartupStall("Web authenticated startup fallback shown", {
          hasSession: true,
          hasProfile: Boolean(profile),
          userId: session.user.id,
          email: session.user.email ?? undefined,
        });
        void reportClientError({
          source: "web-authenticated-startup-guard",
          error: new Error(`Web startup fallback: ${category}`),
          userId: session.user.id,
          email: session.user.email ?? undefined,
          screen: pathname ?? "/",
          extra: { category, visibility },
        });
      }

      hideFrennixBootShell();
      setFailureCategory(category);
      setShowFallback(true);
    }, AUTHENTICATED_STARTUP_TIMEOUT_MS);

    return () => {
      clearInterval(poll);
      clearTimeout(timer);
    };
  }, [
    authReady,
    pathname,
    profile,
    profileFetchFailed,
    session?.user.email,
    session?.user.id,
  ]);

  if (!showFallback || !session) return null;

  return (
    <WebAuthenticatedStartupFallback
      category={failureCategory}
      onRetry={() => {
        clearSafeTransientStartupState();
        hideFrennixBootShell();
        void refreshProfile(session.user.id).finally(() => {
          if (typeof window !== "undefined") window.location.reload();
        });
      }}
      onSignOut={() => {
        void signOut().finally(() => {
          if (typeof window !== "undefined") window.location.replace("/(auth)/login");
        });
      }}
    />
  );
}
