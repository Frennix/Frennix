import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { usePathname, useSegments } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
import { EMERGENCY_DEBUG_BUILD } from "@/lib/emergency-debug";
import {
  formatStartupMountSummary,
  getStartupMountEvents,
  getStartupMountGap,
  subscribeStartupMount,
} from "@/lib/startup-mount-trace";
import {
  formatFeedLayoutBanner,
  getFeedLayoutSnapshot,
  sampleFeedLayout,
  subscribeFeedLayout,
} from "@/lib/feed-layout-diagnostics";
import {
  formatFeedRenderSummary,
  getFeedRenderEvents,
  getFeedRenderGap,
  subscribeFeedRender,
} from "@/lib/feed-render-trace";

/**
 * Always-visible web diagnostic strip — mounts before auth-dependent UI.
 * Uses position:fixed on web so it stays above blank/crashed shells.
 */
export function EmergencyDebugBanner() {
  if (Platform.OS !== "web") return null;

  return <EmergencyDebugBannerInner />;
}

function EmergencyDebugBannerInner() {
  const pathname = usePathname();
  const segments = useSegments();
  const { session, authReady, profile } = useAuth();
  const [jsError, setJsError] = useState<string | null>(null);
  const [mountedAt] = useState(() => new Date().toISOString());
  const [mountTrace, setMountTrace] = useState(formatStartupMountSummary);
  const [feedTrace, setFeedTrace] = useState(formatFeedRenderSummary);
  const [layoutTrace, setLayoutTrace] = useState(() =>
    formatFeedLayoutBanner(getFeedLayoutSnapshot())
  );

  useEffect(() => {
    const unsubscribeStartup = subscribeStartupMount(() => setMountTrace(formatStartupMountSummary()));
    const unsubscribeFeed = subscribeFeedRender(() => setFeedTrace(formatFeedRenderSummary()));
    const unsubscribeLayout = subscribeFeedLayout(() =>
      setLayoutTrace(formatFeedLayoutBanner(getFeedLayoutSnapshot()))
    );

    if (typeof window === "undefined") {
      return () => {
        unsubscribeStartup();
        unsubscribeFeed();
        unsubscribeLayout();
      };
    }

    const onError = (event: ErrorEvent) => {
      setJsError(`${event.message} @ ${event.filename ?? "?"}:${event.lineno ?? "?"}`);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      setJsError(String(event.reason ?? "unhandled rejection"));
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    const layoutPoll = window.setInterval(() => {
      sampleFeedLayout();
      setLayoutTrace(formatFeedLayoutBanner(getFeedLayoutSnapshot()));
    }, 2500);

    return () => {
      window.clearInterval(layoutPoll);
      unsubscribeStartup();
      unsubscribeFeed();
      unsubscribeLayout();
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  const mountGap = getStartupMountGap();
  const feedGap = getFeedRenderGap();
  const layoutSnapshot = getFeedLayoutSnapshot();
  const layoutIssue = layoutSnapshot?.issue ?? null;
  const recentMounts = getStartupMountEvents()
    .slice(-6)
    .map((event) => event.id)
    .join(" → ");
  const recentFeed = getFeedRenderEvents()
    .slice(-8)
    .map((event) => (event.detail ? `${event.id}(${event.detail})` : event.id))
    .join(" → ");

  return (
    <View style={styles.banner} pointerEvents="none" {...({ id: "frennix-emergency-debug" } as object)}>
      <Text style={styles.title}>EMERGENCY DEBUG — FEED LAYOUT + MOUNT TRACE</Text>
      <Text style={styles.line}>Build: {EMERGENCY_DEBUG_BUILD}</Text>
      <Text style={styles.line}>React banner mounted: {mountedAt}</Text>
      <Text style={styles.line}>Path: {pathname || "/"}</Text>
      <Text style={styles.line}>Segments: {segments.join(" / ") || "—"}</Text>
      <Text style={styles.line}>
        Auth: ready={String(authReady)} session={session ? "yes" : "no"} onboarding=
        {profile?.onboarding_complete == null ? "?" : String(profile.onboarding_complete)}
      </Text>
      <Text style={mountGap ? styles.error : styles.line}>
        Startup: {mountGap ? `STUCK BEFORE ${mountGap}` : "all expected phases reached"}
      </Text>
      <Text style={styles.line} numberOfLines={2}>
        Startup recent: {recentMounts || "—"}
      </Text>
      <Text style={layoutIssue ? styles.error : styles.line} numberOfLines={4}>
        {layoutTrace}
      </Text>
      {layoutSnapshot ? (
        <Text style={styles.line} numberOfLines={3}>
          Surfaces: {layoutSnapshot.surfaces}
        </Text>
      ) : null}
      {layoutSnapshot && layoutSnapshot.overlays.length > 0 ? (
        <Text style={styles.error} numberOfLines={4}>
          Overlay detail:{" "}
          {layoutSnapshot.overlays
            .map(
              (overlay) =>
                `${overlay.label} ${overlay.rectH}x${overlay.rectW} z=${overlay.zIndex} pe=${overlay.pointerEvents} bg=${overlay.backgroundColor}`
            )
            .join(" | ")}
        </Text>
      ) : null}
      <Text style={feedGap ? styles.error : styles.line}>
        Feed: {feedGap ? `STUCK BEFORE ${feedGap}` : "all expected phases reached"}
      </Text>
      <Text style={styles.line} numberOfLines={3}>
        Feed recent: {recentFeed || "—"}
      </Text>
      <Text style={styles.line} numberOfLines={2}>
        {feedTrace}
      </Text>
      <Text style={styles.line} numberOfLines={2}>
        {mountTrace}
      </Text>
      {jsError ? (
        <Text style={styles.error} numberOfLines={5}>
          JS error: {jsError}
        </Text>
      ) : (
        <Text style={styles.line}>JS error: none captured yet</Text>
      )}
    </View>
  );
}

const WEB_FIXED: object =
  Platform.OS === "web"
    ? {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2147483647,
      }
    : {};

const styles = StyleSheet.create({
  banner: {
    ...WEB_FIXED,
    backgroundColor: "#b00020",
    borderBottomWidth: 4,
    borderBottomColor: "#ffea00",
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 12,
    gap: 3,
  },
  title: {
    color: "#ffea00",
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 0.4,
  },
  line: {
    color: "#ffffff",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
  },
  error: {
    color: "#ffb4b4",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
  },
});
