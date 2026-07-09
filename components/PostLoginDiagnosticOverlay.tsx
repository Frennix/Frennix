import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { usePathname, useSegments } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
import { collectPostLoginDiagnosticSnapshot } from "@/lib/post-login-diagnostic-state";
import { getStartupMountEvents } from "@/lib/startup-mount-trace";
import { colors, spacing, typography } from "@frennix/ui";

/**
 * Temporary visible post-login diagnostic panel (production incident).
 * Shows auth/profile/route/tab/feed mount state so black-screen testers can report facts.
 */
export function PostLoginDiagnosticOverlay() {
  const pathname = usePathname();
  const segments = useSegments();
  const { session, profile, authReady } = useAuth();
  const tickRef = useRef(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "web" || !session?.user.id || !authReady) return;
    const id = window.setInterval(() => {
      tickRef.current += 1;
      setTick(tickRef.current);
    }, 1000);
    return () => window.clearInterval(id);
  }, [session?.user.id, authReady]);

  if (Platform.OS !== "web" || !session?.user.id || !authReady) {
    return null;
  }

  const snap = collectPostLoginDiagnosticSnapshot({
    authReady,
    hasSession: Boolean(session),
    profile,
    route: pathname ?? "/",
    mountTraceTail: getStartupMountEvents().slice(-8).map((e) => e.id),
  });

  const lines = [
    `BUILD: ${snap.buildLine}`,
    `auth: ${snap.authLoaded ? "yes" : "no"} · profile: ${snap.profileLoaded ? snap.profileUsername : "no"}`,
    `onboarding: ${String(snap.onboardingComplete)} · repair: ${String(snap.needsOnboardingRepair)}`,
    `route: ${snap.route} · segments: ${segments.join("/") || "—"}`,
    `tab: ${snap.activeTab ?? "—"}`,
    `feed scene: ${snap.feedTabSceneH}px · root: ${snap.feedRootH}px · scroll: ${snap.feedScrollH}px`,
    `feed mounted: ${snap.feedContentMounted ? "yes" : "no"} · feed text: ${snap.feedMeaningfulText ? "yes" : "no"}`,
    `supabase: ${snap.supabaseConfigured ? "ok" : "MISSING"} · token: ${snap.hasPersistedToken ? "yes" : "no"}`,
    `mode: ${snap.displayMode} · boot: ${snap.bootShellVisible ? "visible" : "hidden"}`,
    snap.blackScreenSuspected ? "⚠ BLACK SCREEN PATTERN" : "status: monitoring",
    `trace: ${snap.mountTraceTail.join(" → ") || "—"}`,
  ];

  return (
    <View
      style={styles.wrap}
      pointerEvents="box-none"
      nativeID="post-login-diagnostic-overlay"
      accessibilityLabel="Post-login diagnostic overlay"
    >
      <View style={styles.panel} pointerEvents="auto">
        <Text style={styles.title}>Post-login diagnostics</Text>
        {lines.map((line) => (
          <Text key={line} style={styles.line} selectable>
            {line}
          </Text>
        ))}
        <Pressable
          style={styles.button}
          onPress={() => {
            void navigator.clipboard?.writeText(JSON.stringify(snap, null, 2));
          }}
        >
          <Text style={styles.buttonText}>Copy snapshot</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 72,
    zIndex: 2147483640,
    alignItems: "center",
    paddingHorizontal: spacing.sm,
  },
  panel: {
    maxWidth: 420,
    width: "100%",
    backgroundColor: "rgba(20, 20, 22, 0.94)",
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 10,
    padding: spacing.sm,
    gap: 4,
  },
  title: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "800",
    marginBottom: 2,
  },
  line: {
    ...typography.caption,
    color: colors.text,
    fontFamily: Platform.OS === "web" ? "monospace" : undefined,
    fontSize: 11,
    lineHeight: 15,
  },
  button: {
    marginTop: spacing.xs,
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  buttonText: {
    ...typography.caption,
    color: colors.background,
    fontWeight: "700",
  },
});
