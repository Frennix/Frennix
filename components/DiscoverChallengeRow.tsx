import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import type { Challenge } from "@frennix/types";
import { useChallengeActions } from "@/lib/useChallengeActions";
import { ChallengeCard, MenuIconButton, spacing } from "@frennix/ui";

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
          <MenuIconButton onPress={openChallengeActions} accessibilityLabel="Challenge options" />
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
});
