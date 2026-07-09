import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { LoginFailureScreen } from "@/components/LoginFailureScreen";
import { hideFrennixBootShell } from "@/lib/hide-boot-shell";
import { logStartupStep } from "@/lib/startup-step-log";
import { getStartupMountEvents } from "@/lib/startup-mount-trace";

const LOGIN_RENDER_TIMEOUT_MS = 15_000;

/** Surfaces a visible error if the login screen never mounts on web. */
export function LoginStartupGuard({ children }: { children: React.ReactNode }) {
  const [failed, setFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    if (Platform.OS !== "web") return;

    logStartupStep("login:render:start");

    const startedAt = Date.now();
    const timer = setTimeout(() => {
      const mounted = getStartupMountEvents().some((event) => event.id === "auth-login:mounted");
      const loginNode = document.getElementById("auth-login-screen");
      if (mounted && loginNode) {
        logStartupStep("login:render:end");
        hideFrennixBootShell();
        return;
      }

      logStartupStep("login:failure", {
        mounted,
        hasLoginNode: Boolean(loginNode),
        waitedMs: Date.now() - startedAt,
      });
      setErrorMessage(
        mounted
          ? "Login UI did not appear in the page."
          : "Login screen did not finish mounting."
      );
      setFailed(true);
      hideFrennixBootShell();
    }, LOGIN_RENDER_TIMEOUT_MS);

    const poll = setInterval(() => {
      const mounted = getStartupMountEvents().some((event) => event.id === "auth-login:mounted");
      const loginNode = document.getElementById("auth-login-screen");
      if (mounted && loginNode) {
        logStartupStep("login:render:end");
        hideFrennixBootShell();
        clearTimeout(timer);
        clearInterval(poll);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      clearInterval(poll);
    };
  }, []);

  if (failed) {
    return (
      <LoginFailureScreen
        message="The sign-in form did not load. This can happen after an app update or with a stale session."
        detail="Try Retry below. If you installed Frennix to your Home Screen, open it once from Safari to refresh."
        errorMessage={errorMessage}
        onRetry={() => {
          if (typeof window !== "undefined") window.location.reload();
        }}
      />
    );
  }

  return <>{children}</>;
}
