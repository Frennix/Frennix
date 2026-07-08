import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { StartupMountProbe } from "@/components/StartupMountProbe";
import { StartupRetryScreen } from "@/components/StartupRetryScreen";
import { useAuth } from "@/providers/AuthProvider";
import { isSupabaseConfigured } from "@/lib/config";
import { logDiagnostic } from "@/lib/client-diagnostics";

const AUTH_BOOTSTRAP_TIMEOUT_MS = 12_000;

export default function Index() {
  const { session, profile, authReady, passwordRecovery, loading, profileLoading } = useAuth();

  return (
    <StartupMountProbe id="index-route">
      <IndexGate
        session={session}
        profile={profile}
        authReady={authReady}
        passwordRecovery={passwordRecovery}
        loading={loading}
        profileLoading={profileLoading}
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
}: {
  session: ReturnType<typeof useAuth>["session"];
  profile: ReturnType<typeof useAuth>["profile"];
  authReady: boolean;
  passwordRecovery: boolean;
  loading: boolean;
  profileLoading: boolean;
}) {
  const [authTimedOut, setAuthTimedOut] = useState(false);

  useEffect(() => {
    if (authReady) {
      setAuthTimedOut(false);
      return;
    }
    const timer = setTimeout(() => {
      logDiagnostic("auth", "index gate timed out waiting for authReady", "error", {
        loading,
        profileLoading,
        hasSession: Boolean(session),
        hasProfile: Boolean(profile),
      });
      setAuthTimedOut(true);
    }, AUTH_BOOTSTRAP_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [authReady, loading, profileLoading, profile, session]);

  if (!isSupabaseConfigured()) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!authReady || (passwordRecovery && !session)) {
    if (authTimedOut) {
      return (
        <StartupRetryScreen
          title="Signing you in"
          message="Account setup is taking longer than expected. Check your connection and try again."
          detail={
            session
              ? profileLoading
                ? "Still loading your profile…"
                : loading
                  ? "Still restoring your session…"
                  : undefined
              : "No active session yet."
          }
          loading={!authTimedOut}
          onRetry={() => {
            if (typeof window !== "undefined") window.location.reload();
          }}
        />
      );
    }

    return (
      <StartupRetryScreen
        title="Signing you in"
        message={
          session
            ? profileLoading
              ? "Loading your profile…"
              : "Restoring your session…"
            : "Starting Frennix…"
        }
        loading
        showDiagnostics={false}
      />
    );
  }

  if (passwordRecovery && session) {
    return <Redirect href="/reset-password" />;
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!profile?.onboarding_complete) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}
