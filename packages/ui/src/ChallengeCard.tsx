import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Challenge } from "@frennix/types";
import { colors, radius, spacing, typography } from "./theme";

interface ChallengeCardProps {
  challenge: Challenge;
  onPress?: () => void;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ChallengeCard({ challenge, onPress }: ChallengeCardProps) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Text style={styles.title}>{challenge.title}</Text>
      {challenge.description ? (
        <Text style={styles.description} numberOfLines={2}>{challenge.description}</Text>
      ) : null}
      <View style={styles.footer}>
        <Text style={styles.dates}>
          {formatDate(challenge.start_date)} – {formatDate(challenge.end_date)}
        </Text>
        <Text style={styles.participants}>{challenge.participant_count ?? 0} joined</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  title: { ...typography.heading, fontSize: 18 },
  description: { ...typography.bodySmall },
  footer: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
  dates: { ...typography.caption, color: colors.accent },
  participants: { ...typography.caption },
});
