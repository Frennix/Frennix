import { memo } from "react";
import { Platform, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { ScalePressable } from "./ScalePressable";
import { colors, overlays, spacing } from "./theme";

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

const ICON_SIZE = 56;

export const FeedQuickActionCards = memo(function FeedQuickActionCards({
  actions,
  style,
}: FeedQuickActionCardsProps) {
  return (
    <View style={[styles.row, style]} nativeID="feed-shortcut-row">
      {actions.map((action) => (
        <ScalePressable
          key={action.key}
          onPress={action.onPress}
          pressedScale={0.96}
          containerStyle={styles.item}
          accessibilityRole="button"
          accessibilityLabel={action.title}
        >
          <View style={styles.itemInner}>
            <View style={styles.iconCircle}>
              <Text style={styles.emoji}>{action.emoji}</Text>
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {action.title}
            </Text>
          </View>
        </ScalePressable>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    overflow: "hidden",
    paddingVertical: spacing.xxs,
  },
  item: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
  },
  itemInner: {
    width: "100%",
    minWidth: 0,
    alignItems: "center",
    gap: spacing.xxs,
  },
  iconCircle: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: overlays.glassMedium,
    borderWidth: 1,
    borderColor: overlays.glassBorder,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        } as ViewStyle)
      : null),
  },
  emoji: {
    fontSize: 22,
    lineHeight: 26,
  },
  label: {
    width: "100%",
    minWidth: 0,
    color: colors.textMuted,
    fontWeight: "600",
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
  },
});
