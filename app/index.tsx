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
  const {
    session,
    profile,
    authReady,
    passwordRecovery,
    loading,
    profileLoading,
    profileFetchFailed,
    refreshProfile,
  } = useAuth();

  return (
    <StartupMountProbe id="index-route">
      <IndexGate
        session={session}
        profile={profile}
        authReady={authReady}
        passwordRecovery={passwordRecovery}
        loading={loading}
        profileLoading={profileLoading}
        profileFetchFailed={profileFetchFailed}
        refreshProfile={refreshProfile}
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
  profileFetchFailed,
  refreshProfile,
}: {
  session: ReturnType<typeof useAuth>["session"];
  profile: ReturnType<typeof useAuth>["profile"];
  authReady: boolean;
  passwordRecovery: boolean;
  loading: boolean;
  profileLoading: boolean;
  profileFetchFailed: boolean;
  refreshProfile: ReturnType<typeof useAuth>["refreshProfile"];
}) {
  const [authTimedOut, setAuthTimedOut] = useState(false);
  const reportedStallRef = useRef(false);

  useEffect(() => {
    if (authReady) {
      hideFrennixBootShell();
    }
  }, [authReady]);

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
    if (profileLoading) {
      return (
        <StartupRetryScreen
          title="Loading your profile"
          message="Finishing account setup before opening the app."
          loading
          showDiagnostics={false}
          showMountTrace={false}
        />
      );
    }

    if (profileFetchFailed) {
      return (
        <StartupRetryScreen
          title="Could not load your profile"
          message="You're signed in, but profile data did not load. Check your connection and try again."
          detail="If this keeps happening, open Diagnostics and share the report."
          onRetry={() => {
            void refreshProfile(session.user.id);
          }}
        />
      );
    }

    logStartupStep("auth:session:loaded", { hasProfile: false, route: "onboarding" });
    return <Redirect href="/onboarding" />;
  }

  if (!profile.onboarding_complete) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}
