import { Pressable, StyleSheet, Text, View } from "react-native";
import type { StoryInsights } from "@frennix/types";
import { colors, overlays, spacing, typography } from "@frennix/ui";

interface StoryInsightsStripProps {
  insights: StoryInsights;
  /** Per-slide unique viewer count — overrides insights.views when set. */
  viewCount?: number;
  onViewsPress?: () => void;
  onReactionsPress?: () => void;
  onPress?: () => void;
}

/** Compact creator insights — tap views for viewer list. */
export function StoryInsightsStrip({
  insights,
  viewCount,
  onViewsPress,
  onReactionsPress,
  onPress,
}: StoryInsightsStripProps) {
  const views = viewCount ?? insights.views;
  const items = [
    { label: "Views", value: views, onPress: onViewsPress ?? onPress },
    { label: "Reactions", value: insights.reactions, onPress: onReactionsPress ?? onPress },
    { label: "Replies", value: insights.replies, onPress },
  ].filter((item) => item.value > 0 || item.label === "Views");

  if (!items.some((item) => item.value > 0)) {
    return (
      <Pressable onPress={onPress} style={styles.wrap}>
        <Text style={styles.empty}>Story insights will appear as people engage.</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.wrap}>
      {items.map((item) => (
        <Pressable key={item.label} style={styles.chip} onPress={item.onPress}>
          <Text style={styles.value}>{item.value}</Text>
          <Text style={styles.label}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: overlays.glassMedium,
    borderWidth: 1,
    borderColor: overlays.glassBorderStrong,
    alignItems: "center",
    minWidth: 56,
  },
  value: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "800",
  },
  label: {
    ...typography.caption,
    fontSize: 9,
    color: overlays.whiteSoft,
    fontWeight: "600",
  },
  empty: {
    ...typography.caption,
    color: overlays.whiteFaint,
    fontWeight: "600",
  },
});
