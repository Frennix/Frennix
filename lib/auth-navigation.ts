import { router, useRouter, useSegments, type Href } from "expo-router";
import { useEffect, useRef } from "react";
import { getSession } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";

const LOGIN_HREF = "/(auth)/login" as Href;

/** Grace period while Supabase refreshes the session after tab resume (ms). */
const SESSION_RECOVERY_MS = 1500;

/** Reset stack on web and go to login (settings/tabs stay mounted after a plain replace). */
export function redirectToLogin() {
  if (router.canDismiss()) {
    router.dismissAll();
  }
  router.replace(LOGIN_HREF);
}

function isPublicRoute(root: string | undefined) {
  return root === "(auth)" || root === "join";
}

function isPasswordRecoveryRoute(root: string | undefined) {
  return root === "reset-password";
}

/** Redirect signed-out users away from protected screens without a full page refresh. */
export function AuthNavigationGuard() {
  const { session, loading, passwordRecovery } = useAuth();
  const segments = useSegments();
  const navigationRouter = useRouter();
  const hadSessionRef = useRef(false);

  useEffect(() => {
    if (session) {
      hadSessionRef.current = true;
    }
  }, [session]);

  useEffect(() => {
    if (loading) return;

    const root = segments[0];
    if (!root || root === "index") return;
    if (isPublicRoute(root)) return;
    if (isPasswordRecoveryRoute(root) && (session || passwordRecovery)) return;
    if (session) return;

    let cancelled = false;

    async function redirectIfStillSignedOut() {
      // Session can briefly appear null while Supabase refreshes after tab resume.
      if (hadSessionRef.current) {
        await new Promise((resolve) => setTimeout(resolve, SESSION_RECOVERY_MS));
        if (cancelled) return;

        try {
          const recovered = await getSession();
          if (recovered) return;
        } catch {
          // Fall through to login redirect.
        }
      }

      if (cancelled) return;

      if (navigationRouter.canDismiss()) {
        navigationRouter.dismissAll();
      }
      navigationRouter.replace(LOGIN_HREF);
    }

    void redirectIfStillSignedOut();

    return () => {
      cancelled = true;
    };
  }, [session, loading, passwordRecovery, segments, navigationRouter]);

  return null;
}
