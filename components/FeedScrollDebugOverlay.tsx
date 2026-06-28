import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { FeedScrollDebugSnapshot } from "@/lib/useFeedScrollDebug";

type FeedScrollDebugOverlayProps = {
  snapshot: FeedScrollDebugSnapshot;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, warn && styles.valueWarn]} numberOfLines={4}>
        {value}
      </Text>
    </View>
  );
}

function boolLabel(value: boolean) {
  return value ? "YES ✓" : "NO ✗";
}

export function FeedScrollDebugOverlay({
  snapshot,
  collapsed,
  onToggleCollapsed,
}: FeedScrollDebugOverlayProps) {
  const modalMounted =
    snapshot.storyVisible || snapshot.shareSheetVisible || snapshot.lightboxVisible;

  return (
    <View style={styles.host} pointerEvents="box-none" {...({ "data-feed-scroll-debug": "1" } as object)}>
      <View style={styles.panel} pointerEvents="auto">
        <Pressable style={styles.header} onPress={onToggleCollapsed}>
          <Text style={styles.title}>Feed scroll debug</Text>
          <Text style={styles.toggle}>{collapsed ? "Show" : "Hide"}</Text>
        </Pressable>

        {!collapsed ? (
          <ScrollView style={styles.body} nestedScrollEnabled>
            <Row
              label="Scrollable?"
              value={boolLabel(snapshot.scrollable)}
              warn={!snapshot.scrollable}
            />
            <Row label="Content height" value={`${snapshot.contentHeight}px`} />
            <Row label="List height" value={`${snapshot.listLayoutHeight}px`} />
            <Row label="Viewport height" value={`${snapshot.viewportHeight}px`} />
            <Row
              label="Scroll events firing?"
              value={
                snapshot.scrollEventsFiring
                  ? `YES ✓ (y=${snapshot.lastScrollOffsetY ?? 0})`
                  : "NO ✗"
              }
              warn={!snapshot.scrollEventsFiring}
            />
            <Row
              label="scrollEnabled"
              value={boolLabel(snapshot.scrollEnabled)}
              warn={!snapshot.scrollEnabled}
            />
            <Row label="Last touch target" value={snapshot.lastTouchTarget} />
            <Row
              label="Modal / overlay mounted?"
              value={
                modalMounted
                  ? [
                      snapshot.storyVisible && "StoryViewer",
                      snapshot.shareSheetVisible && "ShareSheet",
                      snapshot.lightboxVisible && "Lightbox",
                    ]
                      .filter(Boolean)
                      .join(", ") || "none"
                  : "none"
              }
              warn={modalMounted}
            />
            <Row label="Body overflow" value={snapshot.bodyOverflow} />
            <Row label="Scroll container" value={snapshot.scrollContainerSummary} />
            <Row
              label="Gesture handler suspect"
              value={snapshot.gestureHandlerSuspect ?? "none detected"}
              warn={Boolean(snapshot.gestureHandlerSuspect)}
            />

            {snapshot.blockingOverlay ? (
              <View style={styles.blockerBox}>
                <Text style={styles.blockerTitle}>⚠ Likely touch blocker</Text>
                <Text style={styles.blockerValue}>{snapshot.blockingOverlay}</Text>
              </View>
            ) : null}

            {snapshot.mountedOverlays.length > 0 ? (
              <View style={styles.overlayList}>
                <Text style={styles.overlayListTitle}>Full-screen layers detected</Text>
                {snapshot.mountedOverlays.map((item) => (
                  <Text key={item} style={styles.overlayItem}>
                    • {item}
                  </Text>
                ))}
              </View>
            ) : null}

            <Text style={styles.hint}>Add ?feedDebug=1 to URL. Remove before final prod deploy.</Text>
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 56,
    zIndex: 99999,
    paddingHorizontal: 8,
  },
  panel: {
    backgroundColor: "rgba(8, 8, 10, 0.94)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 200, 0, 0.55)",
    maxHeight: 320,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.12)",
  },
  title: {
    color: "#ffc800",
    fontWeight: "800",
    fontSize: 13,
  },
  toggle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  body: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  row: {
    marginBottom: 8,
    gap: 2,
  },
  label: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  value: {
    color: "#fff",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  valueWarn: {
    color: "#ff6b6b",
  },
  blockerBox: {
    marginTop: 4,
    marginBottom: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255, 60, 60, 0.2)",
    borderWidth: 1,
    borderColor: "#ff4444",
  },
  blockerTitle: {
    color: "#ff8888",
    fontWeight: "800",
    fontSize: 11,
    marginBottom: 4,
  },
  blockerValue: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  overlayList: {
    marginBottom: 8,
    gap: 4,
  },
  overlayListTitle: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  overlayItem: {
    color: "#ddd",
    fontSize: 11,
    lineHeight: 15,
  },
  hint: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 10,
    marginTop: 4,
    marginBottom: 6,
  },
});
