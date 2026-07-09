import { Redirect } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StartupMountProbe } from "@/components/StartupMountProbe";
import { StartupRetryScreen } from "@/components/StartupRetryScreen";
import { useAuth } from "@/providers/AuthProvider";
import { hasPersistedAuthToken } from "@/lib/auth-storage";
import { hideFrennixBootShell } from "@/lib/hide-boot-shell";
import { isSupabaseConfigured } from "@/lib/config";
import { logDiagnostic } from "@/lib/client-diagnostics";
import { trackAppStartup } from "@/lib/beta-health-analytics";
import { reportStartupStall } from "@/lib/startup-diagnostics";
import { describeAuthBootstrapPhase } from "@/lib/startup-mount-trace";
import { logStartupStep } from "@/lib/startup-step-log";

const APP_BOOT_MARK =
  typeof performance !== "undefined" ? performance.now() : Date.now();

const AUTH_BOOTSTRAP_TIMEOUT_MS = 10_000;

export default function Index() {
  const { session, profile, authReady, passwordRecovery, loading, profileLoading, signOut } = useAuth();

  return (
    <StartupMountProbe id="index-route">
      <IndexGate
        session={session}
        profile={profile}
        authReady={authReady}
        passwordRecovery={passwordRecovery}
        loading={loading}
        profileLoading={profileLoading}
        signOut={signOut}
      />
    </StartupMountProbe>
  );
}

function IndexGate({
  session,
  profile,
  authReady,
  passwordRecovery,
  loading,
  profileLoading,
  signOut,
}: {
  session: ReturnType<typeof useAuth>["session"];
  profile: ReturnType<typeof useAuth>["profile"];
  authReady: boolean;
  passwordRecovery: boolean;
  loading: boolean;
  profileLoading: boolean;
  signOut: ReturnType<typeof useAuth>["signOut"];
}) {
  const [authTimedOut, setAuthTimedOut] = useState(false);
  const reportedStallRef = useRef(false);
  const clearedStaleSessionRef = useRef(false);

  useEffect(() => {
    if (!authReady || !session || profile || profileLoading || clearedStaleSessionRef.current) {
      return;
    }

    clearedStaleSessionRef.current = true;
    logStartupStep("auth:session:invalid", { reason: "profile-unresolved" });
    void signOut();
  }, [authReady, session, profile, profileLoading, signOut]);

  useEffect(() => {
    if (authReady && (!session || !hasPersistedAuthToken())) {
      hideFrennixBootShell();
    }
  }, [authReady, session]);

  useEffect(() => {
    if (authReady) {
      setAuthTimedOut(false);
      const elapsed =
        (typeof performance !== "undefined" ? performance.now() : Date.now()) - APP_BOOT_MARK;
      trackAppStartup(elapsed);
      return;
    }

    const timer = setTimeout(() => {
      if (reportedStallRef.current) return;
      reportedStallRef.current = true;

      logDiagnostic("auth", "index gate timed out waiting for authReady", "error", {
        loading,
        profileLoading,
        hasSession: Boolean(session),
        hasProfile: Boolean(profile),
      });

      reportStartupStall("Index gate timed out waiting for authReady", {
        loading,
        profileLoading,
        hasSession: Boolean(session),
        hasProfile: Boolean(profile),
        userId: session?.user.id,
        email: session?.user.email ?? undefined,
      });

      setAuthTimedOut(true);
    }, AUTH_BOOTSTRAP_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [authReady, loading, profileLoading, profile, session]);

  if (!isSupabaseConfigured()) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!authReady || (passwordRecovery && !session)) {
    const bootstrapMessage = describeAuthBootstrapPhase({
      loading,
      profileLoading,
      hasSession: Boolean(session),
    });

    if (authTimedOut) {
      return (
        <StartupRetryScreen
          title="Signing you in"
          message="Account setup is taking longer than expected. You can retry or continue with a limited connection."
          detail={
            session
              ? profileLoading
                ? "Profile load timed out — we'll try again in the app."
                : loading
                  ? "Session restore timed out."
                  : undefined
              : "No active session yet — try signing in again."
          }
          onRetry={() => {
            if (typeof window !== "undefined") window.location.reload();
          }}
        />
      );
    }

    return (
      <StartupRetryScreen
        title="Signing you in"
        message={bootstrapMessage}
        loading
        showDiagnostics={false}
        showMountTrace={false}
      />
    );
  }

  if (passwordRecovery && session) {
    return <Redirect href="/reset-password" />;
  }

  if (!session || !hasPersistedAuthToken()) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!profile) {
    if (!profileLoading) {
      return <Redirect href="/(auth)/login" />;
    }

    return (
      <StartupRetryScreen
        title="Loading your profile"
        message="Finishing account setup before opening the app."
        loading={profileLoading}
        showDiagnostics={false}
        showMountTrace={false}
      />
    );
  }

  if (!profile.onboarding_complete) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}
