import { memo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { StoryAnalytics, StoryInsights } from "@frennix/types";
import { colors, spacing, typography } from "@frennix/ui";

type StoryAnalyticsModalProps = {
  visible: boolean;
  analytics: StoryAnalytics | StoryInsights | null;
  onClose: () => void;
  onOpenViewers?: () => void;
};

function metricValue(analytics: StoryAnalytics | StoryInsights, key: "views" | "reactions" | "replies") {
  return analytics[key] ?? 0;
}

export const StoryAnalyticsModal = memo(function StoryAnalyticsModal({
  visible,
  analytics,
  onClose,
  onOpenViewers,
}: StoryAnalyticsModalProps) {
  if (!analytics) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.title}>Story Analytics</Text>
          <View style={styles.grid}>
            <Pressable style={styles.metric} onPress={onOpenViewers}>
              <Text style={styles.metricValue}>{metricValue(analytics, "views")}</Text>
              <Text style={styles.metricLabel}>Views</Text>
            </Pressable>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{metricValue(analytics, "reactions")}</Text>
              <Text style={styles.metricLabel}>Reactions</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{metricValue(analytics, "replies")}</Text>
              <Text style={styles.metricLabel}>Replies</Text>
            </View>
          </View>
          {"challenge_joins" in analytics ? (
            <Text style={styles.extra}>
              {analytics.challenge_joins} challenge joins
            </Text>
          ) : analytics.challenges > 0 ? (
            <Text style={styles.extra}>{analytics.challenges} challenge responses</Text>
          ) : null}
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
    gap: spacing.sm,
  },
  metric: {
    flex: 1,
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
  },
  extra: {
    ...typography.bodySmall,
    color: colors.textMuted,
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
