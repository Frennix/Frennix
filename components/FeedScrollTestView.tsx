import { useCallback, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { flexFill, webVerticalScrollStyle } from "@/lib/flex-layout";

type FeedScrollTestViewProps = {
  onScroll?: (offsetY: number) => void;
};

/** Minimal scroll surface to isolate parent-container vs feed bugs on web Safari. */
export function FeedScrollTestView({ onScroll }: FeedScrollTestViewProps) {
  const [lastOffset, setLastOffset] = useState(0);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = Math.round(event.nativeEvent.contentOffset.y);
      setLastOffset(y);
      onScroll?.(y);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("frennix:feed-scroll-test"));
      }
    },
    [onScroll]
  );

  return (
    <ScrollView
      style={[styles.scroll, webVerticalScrollStyle]}
      contentContainerStyle={styles.content}
      nestedScrollEnabled
      scrollEventThrottle={16}
      onScroll={handleScroll}
    >
      <View style={styles.callout}>
        <Text style={styles.calloutTitle}>SCROLL TEST MODE</Text>
        <Text style={styles.calloutBody}>
          Swipe vertically. If these colored rows scroll but the normal feed does not, the bug is
          in FlatList on web. The production web feed now uses ScrollView instead.
        </Text>
        <Text style={styles.calloutMeta}>Last scroll offset: {lastOffset}px</Text>
      </View>
      {Array.from({ length: 36 }, (_, index) => (
        <View
          key={index}
          style={[styles.row, index % 2 === 0 ? styles.rowA : styles.rowB]}
        >
          <Text style={styles.rowText}>Test row {index + 1}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    ...flexFill,
    backgroundColor: "#12121a",
  },
  content: {
    padding: 16,
    paddingBottom: 120,
    gap: 10,
  },
  callout: {
    backgroundColor: "#2a2200",
    borderWidth: 2,
    borderColor: "#ffc800",
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  calloutTitle: {
    color: "#ffc800",
    fontWeight: "900",
    fontSize: 15,
  },
  calloutBody: {
    color: "#fff",
    fontSize: 13,
    lineHeight: 18,
  },
  calloutMeta: {
    color: "#6bff6b",
    fontWeight: "700",
    fontSize: 12,
  },
  row: {
    minHeight: 72,
    borderRadius: 10,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  rowA: { backgroundColor: "#2d2d44" },
  rowB: { backgroundColor: "#3d3d5c" },
  rowText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});
