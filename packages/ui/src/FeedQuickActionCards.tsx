import { memo } from "react";
import { Platform, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { ScalePressable } from "./ScalePressable";
import { applyShadow, colors, overlays, radius, spacing, typography } from "./theme";

export type FeedQuickAction = {
  key: string;
  emoji: string;
  title: string;
  onPress: () => void;
};

interface FeedQuickActionCardsProps {
  actions: FeedQuickAction[];
  style?: ViewStyle;
}

export const FeedQuickActionCards = memo(function FeedQuickActionCards({
  actions,
  style,
}: FeedQuickActionCardsProps) {
  return (
    <View style={[styles.grid, style]}>
      {actions.map((action) => (
        <ScalePressable
          key={action.key}
          onPress={action.onPress}
          pressedScale={0.96}
          containerStyle={styles.cardWrap}
          accessibilityRole="button"
          accessibilityLabel={action.title}
        >
          <View style={styles.card}>
            <View style={styles.iconBubble}>
              <Text style={styles.emoji}>{action.emoji}</Text>
            </View>
            <Text style={styles.title} numberOfLines={2}>
              {action.title}
            </Text>
          </View>
        </ScalePressable>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  cardWrap: {
    width: "48%",
    flexGrow: 1,
    flexBasis: "46%",
    maxWidth: "48%",
  },
  card: {
    minHeight: 88,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...applyShadow("md"),
    ...(Platform.OS === "web"
      ? ({
          backgroundImage:
            "linear-gradient(145deg, rgba(34,197,94,0.08) 0%, rgba(22,22,24,0.95) 42%, rgba(11,11,13,1) 100%)",
        } as ViewStyle)
      : null),
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: overlays.accentTint,
    borderWidth: 1,
    borderColor: overlays.accentBorder,
  },
  emoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  title: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "700",
    lineHeight: 18,
  },
});
