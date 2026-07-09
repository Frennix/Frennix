import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { StartupRetryScreen } from "@/components/StartupRetryScreen";
import {
  getStartupMountGap,
  subscribeStartupMount,
} from "@/lib/startup-mount-trace";
import { logDiagnostic } from "@/lib/client-diagnostics";
import { reportStartupStall } from "@/lib/startup-diagnostics";

const STARTUP_STALL_MS = 10_000;

import { hideFrennixBootShell } from "@/lib/hide-boot-shell";

function isStartupComplete(): boolean {
  const gap = getStartupMountGap();
  if (!gap) return true;
  // App is usable once the router stack mounted — tabs may lazy-load after.
  const events = (typeof window !== "undefined"
    ? (window as Window & { __FRENNIX_MOUNT_TRACE__?: { id: string }[] }).__FRENNIX_MOUNT_TRACE__
    : undefined) ?? [];
  return events.some(
    (event) =>
      event.id === "stack:mounted" ||
      event.id === "index-route:mounted" ||
      event.id === "auth-login:mounted"
  );
}

/** Hides the HTML boot shell and surfaces a retry UI if React startup stalls. */
export function StartupWatchdog() {
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    hideFrennixBootShell();

    const check = () => {
      if (isStartupComplete()) {
        hideFrennixBootShell();
        setStalled(false);
      }
    };

    check();
    const unsub = subscribeStartupMount(check);
    const poll = setInterval(check, 500);

    const stallTimer = setTimeout(() => {
      if (!isStartupComplete()) {
        const gap = getStartupMountGap();
        logDiagnostic("startup", `stall detected before ${gap ?? "unknown"}`, "error");
        reportStartupStall(`Startup watchdog stall before ${gap ?? "unknown"}`, {
          authForced: false,
        });
        setStalled(true);
      }
    }, STARTUP_STALL_MS);

    return () => {
      unsub();
      clearInterval(poll);
      clearTimeout(stallTimer);
    };
  }, []);

  if (!stalled) return null;

  return (
    <StartupRetryScreen
      title="Frennix is taking longer than usual"
      message="The app did not finish starting. This can happen on a slow connection or after an update."
      detail={
        Platform.OS === "web"
          ? "Try closing other tabs, then tap Retry. If you installed the Home Screen app, open from Safari once to refresh."
          : undefined
      }
      onRetry={() => {
        if (typeof window !== "undefined") window.location.reload();
      }}
    />
  );
}
