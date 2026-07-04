import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@frennix/ui";

type StoryWorkoutSlideCardProps = {
  title: string;
  activity?: string | null;
  distance?: string | null;
  duration?: string | null;
  calories?: string | null;
  gym?: string | null;
  location?: string | null;
  caption?: string | null;
};

export function StoryWorkoutSlideCard({
  title,
  activity,
  distance,
  duration,
  calories,
  gym,
  location,
  caption,
}: StoryWorkoutSlideCardProps) {
  const stats = [distance, duration, calories].filter(Boolean);

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.badge}>WORKOUT STORY</Text>
        <Text style={styles.title}>{title}</Text>
        {activity ? <Text style={styles.activity}>{activity}</Text> : null}

        {stats.length ? (
          <View style={styles.statsRow}>
            {distance ? (
              <View style={styles.stat}>
                <Text style={styles.statValue}>{distance}</Text>
                <Text style={styles.statLabel}>Distance</Text>
              </View>
            ) : null}
            {duration ? (
              <View style={styles.stat}>
                <Text style={styles.statValue}>{duration}</Text>
                <Text style={styles.statLabel}>Duration</Text>
              </View>
            ) : null}
            {calories ? (
              <View style={styles.stat}>
                <Text style={styles.statValue}>{calories}</Text>
                <Text style={styles.statLabel}>Calories</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {gym ? (
          <Text style={styles.meta}>🏋️ {gym}</Text>
        ) : null}
        {location ? (
          <Text style={styles.meta}>📍 {location}</Text>
        ) : null}
        {caption ? (
          <Text style={styles.caption} numberOfLines={3}>
            {caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.black,
    paddingHorizontal: spacing.lg,
  },
  card: {
    alignSelf: "stretch",
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: 24,
    backgroundColor: "rgba(18, 18, 20, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  badge: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  title: {
    ...typography.title,
    color: colors.text,
    fontWeight: "800",
  },
  activity: {
    ...typography.body,
    color: colors.textMuted,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  stat: {
    minWidth: 88,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 2,
  },
  statValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: "800",
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "600",
  },
  meta: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  caption: {
    ...typography.bodySmall,
    color: colors.textMuted,
    lineHeight: 20,
  },
});
