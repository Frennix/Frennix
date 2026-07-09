import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { usePathname } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
import { subscribeStartupMount } from "@/lib/startup-mount-trace";
import {
  buildStartupAuthState,
  installStartupSnapshotCapture,
  recordStartupSnapshot,
  type StartupAuthState,
} from "@/lib/startup-snapshot-log";

const INTERVAL_MS = [0, 500, 1000, 2000, 3000, 6000, 10000, 15000];

/** Periodic startup snapshots for black-screen triage without tester involvement. */
export function StartupSnapshotBootstrap() {
  const pathname = usePathname();
  const { session, profile, authReady, loading, profileLoading, passwordRecovery } = useAuth();
  const lastRouteRef = useRef<string | null>(null);
  const lastAuthSignatureRef = useRef<string | null>(null);
  const pathnameRef = useRef(pathname);
  const authRef = useRef<StartupAuthState | null>(null);

  const authState = buildStartupAuthState({
    session,
    profile,
    authReady,
    loading,
    profileLoading,
    passwordRecovery,
  });

  pathnameRef.current = pathname;
  authRef.current = authState;

  useEffect(() => {
    installStartupSnapshotCapture();
    recordStartupSnapshot("app:mount", { route: pathnameRef.current, auth: authRef.current });
  }, []);

  useEffect(() => {
    if (!pathname || pathname === lastRouteRef.current) return;
    lastRouteRef.current = pathname;
    recordStartupSnapshot("snapshot:route-change", { route: pathname, auth: authRef.current });
  }, [pathname]);

  useEffect(() => {
    const signature = JSON.stringify(authState);
    if (signature === lastAuthSignatureRef.current) return;
    lastAuthSignatureRef.current = signature;
    recordStartupSnapshot("snapshot:auth-change", { route: pathnameRef.current, auth: authState });
  }, [authState]);

  useEffect(() => {
    if (Platform.OS !== "web") return undefined;
    const timers = INTERVAL_MS.map((delay) =>
      setTimeout(() => {
        recordStartupSnapshot("snapshot:interval", {
          route: pathnameRef.current ?? "/",
          auth: authRef.current,
          detail: { interval_ms: delay },
        });
      }, delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return undefined;
    return subscribeStartupMount(() => {
      recordStartupSnapshot("snapshot:interval", {
        route: pathnameRef.current ?? "/",
        auth: authRef.current,
        detail: { reason: "mount-trace-update" },
      });
    });
  }, []);

  return null;
}
