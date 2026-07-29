import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  FRENIX_MATCH_BRAND,
  formatFrennixMatchDisplay,
} from "@frennix/matching";
import { showAlert } from "@/lib/alerts";
import { colors, spacing, typography } from "@frennix/ui";

type FrennixMatchDisplayProps = {
  score: number;
  variant?: "full" | "compact" | "inline";
  showInfo?: boolean;
  /** Opens explainer modal when provided; otherwise falls back to a short alert. */
  onLearnMore?: () => void;
};

function showFrennixMatchTooltip() {
  showAlert(FRENIX_MATCH_BRAND.tooltipTitle, FRENIX_MATCH_BRAND.tooltip);
}

export function FrennixMatchDisplay({
  score,
  variant = "full",
  showInfo = true,
  onLearnMore,
}: FrennixMatchDisplayProps) {
  const display = formatFrennixMatchDisplay(score);
  if (!display) return null;

  const isInline = variant === "inline";
  const isCompact = variant === "compact";

  function handleLearnMore() {
    if (onLearnMore) {
      onLearnMore();
      return;
    }
    showFrennixMatchTooltip();
  }

  return (
    <Pressable
      onPress={handleLearnMore}
      style={[styles.badge, isInline && styles.badgeInline]}
      accessibilityRole="button"
      accessibilityLabel={`${display.percentLabel}. ${display.levelLabel}. Tap for details.`}
    >
      <View style={styles.scoreRow}>
        <Text style={[styles.percent, isCompact && styles.percentCompact]} numberOfLines={1}>
          {display.percentLabel}
        </Text>
        {showInfo ? (
          <View style={styles.infoInline} accessibilityElementsHidden importantForAccessibility="no">
            <Text style={styles.infoIcon}>ⓘ</Text>
          </View>
        ) : null}
      </View>
      {!isInline ? (
        <Text style={[styles.level, isCompact && styles.levelCompact]}>{display.levelLabel}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.accent,
    alignSelf: "flex-start",
  },
  badgeInline: {
    paddingVertical: 4,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  percent: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "800",
    fontSize: 13,
    flexShrink: 1,
  },
  percentCompact: {
    fontSize: 12,
  },
  level: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: 11,
  },
  levelCompact: {
    fontSize: 10,
  },
  infoInline: {
    minWidth: 28,
    minHeight: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  infoIcon: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "800",
    fontSize: 13,
    lineHeight: 16,
  },
});
