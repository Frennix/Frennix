import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { STORY_CHALLENGE_RESPONSES, type StoryChallengeKey } from "@frennix/types";
import { colors, overlays, spacing, typography } from "@frennix/ui";

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
    backgroundColor: overlays.glass,
    borderWidth: 1,
    borderColor: overlays.glassBorder,
  },
  buttonActive: {
    borderColor: colors.accent,
    backgroundColor: overlays.accentTint,
  },
  label: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "700",
    textAlign: "center",
  },
});
