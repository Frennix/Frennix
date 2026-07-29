import { StyleSheet, Text, View } from "react-native";
import type { PartnershipTimelineEntry } from "@frennix/types";
import { colors, spacing, typography } from "@frennix/ui";

type PartnershipTimelineProps = {
  entries: PartnershipTimelineEntry[];
};

export function PartnershipTimeline({ entries }: PartnershipTimelineProps) {
  const achieved = entries.filter((entry) => entry.status === "achieved");
  const upcoming = entries.filter((entry) => entry.status === "upcoming");

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Compatibility Timeline</Text>
      <Text style={styles.subheading}>
        A living history of your training partnership — milestones unlock as you grow together.
      </Text>

      {achieved.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your story so far</Text>
          {achieved.map((entry, index) => (
            <View key={entry.code} style={styles.row}>
              <View style={styles.rail}>
                <View style={[styles.dot, styles.dotAchieved]} />
                {index < achieved.length - 1 || upcoming.length ? (
                  <View style={styles.line} />
                ) : null}
              </View>
              <View style={styles.content}>
                <Text style={styles.emoji}>{entry.emoji}</Text>
                <View style={styles.textBlock}>
                  <Text style={styles.label}>{entry.storyText}</Text>
                  {entry.occurredAtLabel ? (
                    <Text style={styles.timestamp}>{entry.occurredAtLabel}</Text>
                  ) : null}
                  {entry.locationLabel ? (
                    <Text style={styles.location}>{entry.locationLabel}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {upcoming.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coming up on your journey</Text>
          {upcoming.slice(0, 6).map((entry, index) => (
            <View key={entry.code} style={styles.row}>
              <View style={styles.rail}>
                <View style={[styles.dot, styles.dotUpcoming]} />
                {index < Math.min(upcoming.length, 6) - 1 ? <View style={styles.lineMuted} /> : null}
              </View>
              <View style={styles.content}>
                <Text style={[styles.emoji, styles.emojiMuted]}>{entry.emoji}</Text>
                <View style={styles.textBlock}>
                  <Text style={[styles.label, styles.labelMuted]}>{entry.label}</Text>
                  <Text style={styles.futureHint}>{entry.storyText}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  heading: { ...typography.heading, color: colors.text },
  subheading: { ...typography.bodySmall, color: colors.textMuted, lineHeight: 22 },
  section: { gap: spacing.sm },
  sectionTitle: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  row: { flexDirection: "row", gap: spacing.md },
  rail: { width: 16, alignItems: "center" },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 6,
  },
  dotAchieved: { backgroundColor: colors.accent },
  dotUpcoming: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: colors.accentMuted,
    marginVertical: spacing.xxs,
  },
  lineMuted: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginVertical: spacing.xxs,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  emoji: { fontSize: 22, lineHeight: 28 },
  emojiMuted: { opacity: 0.55 },
  textBlock: { flex: 1, gap: spacing.xxs },
  label: { ...typography.body, fontWeight: "600", color: colors.text },
  labelMuted: { color: colors.textSecondary },
  story: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },
  futureHint: { ...typography.bodySmall, color: colors.textMuted, lineHeight: 20 },
  timestamp: { ...typography.caption, color: colors.accent, fontWeight: "600", lineHeight: 18 },
  location: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
});
