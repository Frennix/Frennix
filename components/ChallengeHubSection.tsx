import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Challenge } from "@frennix/types";
import { ChallengeCard } from "@frennix/ui";
import { EmptyState, colors, spacing, typography } from "@frennix/ui";

type Props = {
  title: string;
  challenges: Challenge[];
  onPressChallenge: (challenge: Challenge) => void;
  emptyMessage?: string;
};

export function ChallengeHubSection({
  title,
  challenges,
  onPressChallenge,
  emptyMessage,
}: Props) {
  if (!challenges.length) {
    if (!emptyMessage) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.title}>{title}</Text>
        <EmptyState
          icon="🏆"
          title="Nothing here yet"
          description={emptyMessage}
        />
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {challenges.map((challenge) => (
          <Pressable
            key={challenge.id}
            style={styles.cardWrap}
            onPress={() => onPressChallenge(challenge)}
          >
            <ChallengeCard challenge={challenge} compact />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm, marginBottom: spacing.lg },
  title: { ...typography.section, paddingHorizontal: spacing.md },
  row: { paddingHorizontal: spacing.md, gap: spacing.sm },
  cardWrap: { width: 280 },
  empty: {
    ...typography.bodySmall,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
  },
});
