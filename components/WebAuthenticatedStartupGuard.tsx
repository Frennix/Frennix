import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useAuth } from "@/providers/AuthProvider";
import {
  dismissInlineStartupFailureOverlay,
  hideFrennixBootShell,
} from "@/lib/hide-boot-shell";
import { isAuthenticatedDestinationReady } from "@/lib/authenticated-startup-ready";
import { measureAuthenticatedFeedVisibility } from "@/lib/authenticated-feed-visibility";
import {
  isAuthenticatedStartupComplete,
  markAuthenticatedStartupComplete,
} from "@/lib/authenticated-startup-complete";
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
 * Web-only guard: protects the initial login/startup flow only.
 * Does not re-arm on later authenticated navigation (e.g. /create-post modals).
 */
export function WebAuthenticatedStartupGuard() {
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

    if (isAuthenticatedStartupComplete()) {
      armedRef.current = false;
      setShowFallback(false);
      return;
    }

    const evaluate = () => {
      if (!isAuthenticatedDestinationReady()) return false;

      markAuthenticatedStartupComplete();
      const visibility = measureAuthenticatedFeedVisibility();
      if (visibility.ready) {
        recordWebStartupCheckpoint("feed-root:visible", {
          feedRootH: visibility.feedRootH,
          feedScrollH: visibility.feedScrollH,
          feedTabSceneH: visibility.feedTabSceneH,
        });
      }
      setShowFallback(false);
      hideFrennixBootShell();
      return true;
    };

    if (evaluate()) return;

    armedRef.current = true;
    setShowFallback(false);
    reportedRef.current = false;

    const poll = setInterval(evaluate, 250);
    const timer = setTimeout(() => {
      if (!armedRef.current) return;
      if (isAuthenticatedDestinationReady()) {
        markAuthenticatedStartupComplete();
        return;
      }

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
      recordWebStartupCheckpoint("startup:fallback-shown", {
        category,
        route: typeof window !== "undefined" ? window.location.pathname : "/",
      });

      if (!reportedRef.current) {
        reportedRef.current = true;
        logDiagnostic("auth", "web authenticated startup fallback shown", "error", {
          userId: redactUserId(session.user.id),
          path: typeof window !== "undefined" ? window.location.pathname : "/",
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
          screen: typeof window !== "undefined" ? window.location.pathname : "/",
          extra: { category, visibility },
        });
      }

      hideFrennixBootShell();
      setFailureCategory(category);
      setShowFallback(true);
    }, AUTHENTICATED_STARTUP_TIMEOUT_MS);

    return () => {
      armedRef.current = false;
      clearInterval(poll);
      clearTimeout(timer);
    };
  }, [authReady, profile, profileFetchFailed, session?.user.email, session?.user.id]);

  if (!showFallback || !session) return null;

  return (
    <WebAuthenticatedStartupFallback
      category={failureCategory}
      onRetry={() => {
        clearSafeTransientStartupState();
        dismissInlineStartupFailureOverlay();
        hideFrennixBootShell();
        setShowFallback(false);

        if (isAuthenticatedDestinationReady()) {
          markAuthenticatedStartupComplete();
          return;
        }

        if (profile && !profileFetchFailed) {
          markAuthenticatedStartupComplete();
          return;
        }

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
