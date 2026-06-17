import { router, useRouter, useSegments, type Href } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "@/providers/AuthProvider";

const LOGIN_HREF = "/(auth)/login" as Href;

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

  useEffect(() => {
    if (loading) return;

    const root = segments[0];
    if (!root || root === "index") return;
    if (isPublicRoute(root)) return;
    if (isPasswordRecoveryRoute(root) && (session || passwordRecovery)) return;
    if (session) return;

    if (navigationRouter.canDismiss()) {
      navigationRouter.dismissAll();
    }
    navigationRouter.replace(LOGIN_HREF);
  }, [session, loading, passwordRecovery, segments, navigationRouter]);

  return null;
}
