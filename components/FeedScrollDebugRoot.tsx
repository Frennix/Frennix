import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { usePathname } from "expo-router";
import {
  getFeedDebugStatusLine,
  isFeedScrollDebugEnabled,
  isFeedScrollTestMode,
} from "@/lib/feed-scroll-debug";

/**
 * Root-level debug strip — mounts from app/_layout before any screen.
 * Visible whenever ?feedDebug=1 was used (persisted in localStorage through login).
 */
export function FeedScrollDebugRoot() {
  const pathname = usePathname();
  const [visible] = useState(() => isFeedScrollDebugEnabled());
  const [statusLine, setStatusLine] = useState(getFeedDebugStatusLine);
  const [href, setHref] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);
  const [scrollTestHits, setScrollTestHits] = useState(0);

  useEffect(() => {
    if (!visible || Platform.OS !== "web" || typeof window === "undefined") return;

    setHref(window.location.href);
    setStatusLine(getFeedDebugStatusLine());

    const onError = (event: ErrorEvent) => {
      const msg = event.message || "Unknown error";
      const loc = event.filename ? `${event.filename}:${event.lineno}` : "unknown";
      setLastError(`${msg} (${loc})`);
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      setLastError(String(event.reason ?? "Unhandled promise rejection"));
    };

    const onScrollTest = () => setScrollTestHits((n) => n + 1);

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("frennix:feed-scroll-test", onScrollTest as EventListener);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("frennix:feed-scroll-test", onScrollTest as EventListener);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <View
      style={styles.banner}
      pointerEvents="none"
      {...({ "data-feed-scroll-debug": "root" } as object)}
    >
      <Text style={styles.title}>FEED DEBUG ACTIVE</Text>
      <Text style={styles.line}>Detect: {statusLine}</Text>
      <Text style={styles.line} numberOfLines={2}>
        Path: {pathname}
      </Text>
      <Text style={styles.line} numberOfLines={2}>
        Mode: {isFeedScrollTestMode() ? "ScrollView test (add &feedScrollTest=0 for real feed)" : "Real FlatList feed"}
      </Text>
      {scrollTestHits > 0 ? (
        <Text style={styles.ok}>Scroll test events: {scrollTestHits}</Text>
      ) : null}
      {lastError ? (
        <Text style={styles.error} numberOfLines={4}>
          JS error: {lastError}
        </Text>
      ) : (
        <Text style={styles.line}>JS error: none captured</Text>
      )}
      <Text style={styles.hint} numberOfLines={2}>
        {href ? `Loaded: ${href}` : "Loading URL…"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999999,
    backgroundColor: "rgba(120, 0, 0, 0.94)",
    borderBottomWidth: 3,
    borderBottomColor: "#ffc800",
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 10,
    gap: 2,
  },
  title: {
    color: "#ffc800",
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  line: {
    color: "#fff",
    fontSize: 11,
    lineHeight: 14,
  },
  ok: {
    color: "#6bff6b",
    fontSize: 11,
    fontWeight: "700",
  },
  error: {
    color: "#ff8888",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
  },
  hint: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    lineHeight: 12,
  },
});
