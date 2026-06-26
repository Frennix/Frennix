import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Challenge } from "@frennix/types";
import { useChallengeActions } from "@/lib/useChallengeActions";
import { ChallengeCard, colors, radius, spacing } from "@frennix/ui";

interface DiscoverChallengeRowProps {
  challenge: Challenge;
  userId: string;
}

export function DiscoverChallengeRow({ challenge, userId }: DiscoverChallengeRowProps) {
  const { openChallengeActions, challengeActionSheets } = useChallengeActions({
    userId,
    challenge,
  });

  return (
    <>
      {challengeActionSheets}
      <View style={styles.row}>
        <View style={styles.cardWrap}>
          <ChallengeCard
            challenge={challenge}
            onPress={() => router.push(`/challenge/${challenge.id}`)}
          />
        </View>
        {userId ? (
          <Pressable
            style={styles.menuButton}
            onPress={openChallengeActions}
            hitSlop={8}
            accessibilityLabel="Challenge options"
          >
            <Text style={styles.menuIcon}>⋯</Text>
          </Pressable>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  cardWrap: { flex: 1 },
  menuButton: {
    width: 36,
    height: 36,
    marginTop: spacing.sm,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuIcon: { fontSize: 22, lineHeight: 24, color: colors.textSecondary, fontWeight: "700" },
});
