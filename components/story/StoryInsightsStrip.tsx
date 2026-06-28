import { StyleSheet, Text, View } from "react-native";
import type { StoryInsights } from "@frennix/types";
import { colors, overlays, spacing, typography } from "@frennix/ui";

interface StoryInsightsStripProps {
  insights: StoryInsights;
}

/** Compact creator insights — views, reactions, invites, etc. */
export function StoryInsightsStrip({ insights }: StoryInsightsStripProps) {
  const items = [
    { label: "Views", value: insights.views },
    { label: "Reactions", value: insights.reactions },
    { label: "Replies", value: insights.replies },
    { label: "Invites", value: insights.train_invites },
    { label: "Profile", value: insights.profile_visits },
    { label: "Follows", value: insights.new_followers },
  ].filter((item) => item.value > 0);

  if (!items.length) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.empty}>Story insights will appear as people engage.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {items.map((item) => (
        <View key={item.label} style={styles.chip}>
          <Text style={styles.value}>{item.value}</Text>
          <Text style={styles.label}>{item.label}</Text>
        </View>
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
