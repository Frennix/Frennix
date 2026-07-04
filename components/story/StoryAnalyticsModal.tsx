import { memo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { StoryAnalytics, StoryInsights } from "@frennix/types";
import { colors, spacing, typography } from "@frennix/ui";

type StoryAnalyticsModalProps = {
  visible: boolean;
  analytics: StoryAnalytics | StoryInsights | null;
  onClose: () => void;
  onOpenViewers?: () => void;
  onOpenReactions?: () => void;
};

function metricValue(
  analytics: StoryAnalytics | StoryInsights,
  key: "views" | "reactions" | "replies"
) {
  return analytics[key] ?? 0;
}

function challengeJoins(analytics: StoryAnalytics | StoryInsights) {
  if ("challenge_joins" in analytics) return analytics.challenge_joins;
  return analytics.challenges ?? 0;
}

function profileVisits(analytics: StoryAnalytics | StoryInsights) {
  if ("profile_visits" in analytics) return analytics.profile_visits ?? 0;
  return 0;
}

export const StoryAnalyticsModal = memo(function StoryAnalyticsModal({
  visible,
  analytics,
  onClose,
  onOpenViewers,
  onOpenReactions,
}: StoryAnalyticsModalProps) {
  if (!analytics) return null;

  const metrics = [
    { label: "Views", value: metricValue(analytics, "views"), onPress: onOpenViewers },
    { label: "Reactions", value: metricValue(analytics, "reactions"), onPress: onOpenReactions },
    { label: "Replies", value: metricValue(analytics, "replies") },
    { label: "Challenge joins", value: challengeJoins(analytics) },
    { label: "Profile visits", value: profileVisits(analytics) },
  ];

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.title}>Story Analytics</Text>
          <View style={styles.grid}>
            {metrics.map((metric) => {
              const Tile = metric.onPress ? Pressable : View;
              return (
                <Tile
                  key={metric.label}
                  style={styles.metric}
                  {...(metric.onPress ? { onPress: metric.onPress } : {})}
                >
                  <Text style={styles.metricValue}>{metric.value}</Text>
                  <Text style={styles.metricLabel}>{metric.label}</Text>
                </Tile>
              );
            })}
          </View>
          {onOpenViewers ? (
            <Pressable style={styles.cta} onPress={onOpenViewers}>
              <Text style={styles.ctaText}>See who viewed</Text>
            </Pressable>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    fontWeight: "800",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metric: {
    width: "30%",
    flexGrow: 1,
    alignItems: "center",
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    gap: 4,
  },
  metricValue: {
    ...typography.heading,
    color: colors.text,
    fontWeight: "800",
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "700",
    textAlign: "center",
  },
  cta: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  ctaText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: "700",
  },
});
