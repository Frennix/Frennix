import { Pressable, StyleSheet, Text, View } from "react-native";
import { FRENIX_MATCH_BRAND, formatFrennixMatchDisplay } from "@frennix/matching";
import { colors, overlays, radius, spacing, typography } from "@frennix/ui";

type TrainingPartnerMatchBadgeProps = {
  score: number;
  onLearnMore?: () => void;
};

const TRAINING_MATCH_LABEL = "Great Training Match";

/** Compact deck match pill — percentage-first, training-focused copy. */
export function TrainingPartnerMatchBadge({ score, onLearnMore }: TrainingPartnerMatchBadgeProps) {
  const display = formatFrennixMatchDisplay(score);
  if (!display) return null;

  const percentLabel = `${display.score}% ${FRENIX_MATCH_BRAND.name}`;

  const content = (
    <View style={styles.wrap}>
      <View style={styles.pill}>
        <Text style={styles.pillText}>{percentLabel}</Text>
      </View>
      <Text style={styles.level}>{TRAINING_MATCH_LABEL}</Text>
    </View>
  );

  if (!onLearnMore) return content;

  return (
    <Pressable
      onPress={onLearnMore}
      accessibilityRole="button"
      accessibilityLabel={`${percentLabel}. ${TRAINING_MATCH_LABEL}. Tap for details.`}
      hitSlop={6}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 2,
    alignSelf: "flex-start",
  },
  pill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: overlays.accentTintSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: overlays.accentBorder,
  },
  pillText: {
    fontSize: 10,
    color: colors.accent,
    fontWeight: "700",
    lineHeight: 14,
  },
  level: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "600",
    fontSize: 10,
    lineHeight: 13,
    paddingLeft: 2,
  },
});
