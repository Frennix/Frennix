import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { STORY_CHALLENGE_RESPONSES, type StoryChallengeKey } from "@frennix/types";
import { colors, spacing, typography } from "@frennix/ui";

interface StoryChallengeBarProps {
  disabled?: boolean;
  onChallenge: (key: StoryChallengeKey) => void | Promise<void>;
}

export function StoryChallengeBar({ disabled, onChallenge }: StoryChallengeBarProps) {
  const [sentKey, setSentKey] = useState<StoryChallengeKey | null>(null);

  return (
    <View style={styles.wrap}>
      {STORY_CHALLENGE_RESPONSES.map((challenge) => (
        <Pressable
          key={challenge.key}
          style={[styles.button, sentKey === challenge.key && styles.buttonActive]}
          disabled={disabled}
          onPress={async () => {
            setSentKey(challenge.key);
            await onChallenge(challenge.key);
          }}
          accessibilityRole="button"
          accessibilityLabel={challenge.label}
        >
          <Text style={styles.label} numberOfLines={2}>
            {challenge.label}
          </Text>
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
  },
  button: {
    flexGrow: 1,
    flexBasis: "47%",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    backgroundColor: "rgba(10, 10, 11, 0.62)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  buttonActive: {
    borderColor: colors.accent,
    backgroundColor: "rgba(34, 197, 94, 0.16)",
  },
  label: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "700",
    textAlign: "center",
  },
});
