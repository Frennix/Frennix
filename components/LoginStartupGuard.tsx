import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { usePathname } from "expo-router";
import { LoginFailureScreen } from "@/components/LoginFailureScreen";
import { authStartupTargetForPath, type AuthStartupTarget } from "@/lib/auth-startup-target";
import { hasPersistedAuthToken, isPersistedSessionExpired } from "@/lib/auth-storage";
import { hideFrennixBootShell } from "@/lib/hide-boot-shell";
import { logStartupStep } from "@/lib/startup-step-log";
import { getStartupMountEvents, getStartupMountGap } from "@/lib/startup-mount-trace";

const AUTH_SCREEN_RENDER_TIMEOUT_MS = 15_000;

function screenReady(target: AuthStartupTarget): boolean {
  const mounted = getStartupMountEvents().some((event) => event.id === target.mountId);
  const node = document.getElementById(target.nodeId);
  return mounted && Boolean(node);
}

function failureGap(target: AuthStartupTarget): string {
  const gap = getStartupMountGap();
  if (
    !gap ||
    gap === "index-route:render" ||
    gap === "index-route:mounted" ||
    gap.startsWith("tabs-")
  ) {
    return target.mountId;
  }
  return gap;
}

/** Surfaces a visible error if the active auth screen never mounts on web. */
export function LoginStartupGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [failedTarget, setFailedTarget] = useState<AuthStartupTarget | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [startupGap, setStartupGap] = useState<string | undefined>();

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const target = authStartupTargetForPath(pathname);
    setFailedTarget(null);
    setErrorMessage(undefined);
    setStartupGap(undefined);
    if (!target) return;

    logStartupStep("login:render:start", { path: pathname, screen: target.kind });

    const startedAt = Date.now();
    const timer = setTimeout(() => {
      if (screenReady(target)) {
        logStartupStep("login:render:end", { screen: target.kind });
        hideFrennixBootShell();
        return;
      }

      const mounted = getStartupMountEvents().some((event) => event.id === target.mountId);
      const hasNode = Boolean(document.getElementById(target.nodeId));
      const expiredSession = hasPersistedAuthToken() && isPersistedSessionExpired();
      logStartupStep("login:failure", {
        screen: target.kind,
        path: pathname,
        mounted,
        hasNode,
        expiredSession,
        waitedMs: Date.now() - startedAt,
      });
      setErrorMessage(mounted ? target.missingNodeMessage : target.missingMountMessage);
      setStartupGap(failureGap(target));
      setFailedTarget(target);
      hideFrennixBootShell();
    }, AUTH_SCREEN_RENDER_TIMEOUT_MS);

    const poll = setInterval(() => {
      if (!screenReady(target)) return;
      logStartupStep("login:render:end", { screen: target.kind });
      hideFrennixBootShell();
      clearTimeout(timer);
      clearInterval(poll);
    }, 250);

    return () => {
      clearTimeout(timer);
      clearInterval(poll);
    };
  }, [pathname]);

  if (failedTarget) {
    const expiredSession = hasPersistedAuthToken() && isPersistedSessionExpired();
    const sessionNote = expiredSession ? " A saved sign-in on this browser has expired." : "";
    return (
      <LoginFailureScreen
        title={failedTarget.title}
        message={
          failedTarget.kind === "signup"
            ? `The create-account form did not finish loading.${sessionNote}`
            : `The sign-in form did not finish loading.${sessionNote}`
        }
        detail={
          failedTarget.kind === "signup"
            ? "Try Retry below. Create account does not use the sign-in screen."
            : "Try Retry below. If you installed Frennix to your Home Screen, open it once from Safari to refresh."
        }
        errorMessage={errorMessage}
        startupGap={startupGap}
        onRetry={() => {
          if (typeof window !== "undefined") window.location.reload();
        }}
      />
    );
  }

  return <>{children}</>;
}
