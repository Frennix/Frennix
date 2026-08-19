import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import {
  collectFeedVideoDebugSnapshot,
  copyFeedVideoDebugReportToClipboard,
  isFeedVideoDebugPanelEnabled,
  persistFeedVideoDebugFlagFromUrl,
} from "../../packages/ui/src/feedVideoPlaybackDebug";
import { colors, spacing } from "@frennix/ui";

/** Temporary iPhone-friendly feed video diagnostics — preview/local only. */
export function FeedVideoDebugPanel() {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [eventCount, setEventCount] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    persistFeedVideoDebugFlagFromUrl();
    setVisible(isFeedVideoDebugPanelEnabled());
  }, []);

  useEffect(() => {
    if (!visible || Platform.OS !== "web") return;

    const refresh = () => {
      const count =
        typeof window !== "undefined"
          ? window.__FRENNIX_FEED_VIDEO_DEBUG_LOG__?.length ?? 0
          : 0;
      setEventCount(count);
    };

    refresh();
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, [visible]);

  if (Platform.OS !== "web" || !visible) {
    return null;
  }

  const handleCopy = async () => {
    const snapshot = collectFeedVideoDebugSnapshot();
    setStatus("Copying…");
    const copied = await copyFeedVideoDebugReportToClipboard();
    if (copied) {
      setStatus(
        `Copied ${snapshot.fullEventLog.length} events · videos=${snapshot.htmlVideoElementCount}`
      );
      return;
    }
    setStatus("Copy failed — try again");
  };

  return (
    <View pointerEvents="box-none" style={styles.wrap} nativeID="feed-video-debug-panel">
      <View style={styles.card}>
        <Text style={styles.title}>Feed Video Debug</Text>
        <Text style={styles.meta}>Events logged: {eventCount}</Text>
        <Text style={styles.meta}>{status}</Text>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => void handleCopy()}
          accessibilityRole="button"
          accessibilityLabel="Copy Video Debug Report"
        >
          <Text style={styles.buttonLabel}>Copy Video Debug Report</Text>
        </Pressable>
        <Text style={styles.hint}>
          Play a video, scroll past it, then tap copy and paste into Notes.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...(Platform.OS === "web"
      ? ({
          position: "fixed",
        } as const)
      : {
          position: "absolute",
        }),
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.lg,
    zIndex: 9999,
    elevation: 9999,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: "rgba(10, 10, 11, 0.92)",
    padding: spacing.md,
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  button: {
    marginTop: spacing.xs,
    borderRadius: 10,
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonLabel: {
    color: colors.background,
    fontSize: 14,
    fontWeight: "700",
  },
  hint: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
});
