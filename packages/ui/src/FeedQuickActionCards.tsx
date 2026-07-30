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

const ICON_SIZE = 60;

const webLabelStyle: ViewStyle =
  Platform.OS === "web"
    ? ({
        whiteSpace: "nowrap",
        overflow: "visible",
        textOverflow: "clip",
        wordBreak: "normal",
      } as ViewStyle)
    : {};

export const FeedQuickActionCards = memo(function FeedQuickActionCards({
  actions,
  style,
}: FeedQuickActionCardsProps) {
  return (
    <View style={[styles.row, style]} nativeID="feed-shortcut-row">
      {actions.map((action) => (
        <View key={action.key} style={styles.itemWrap}>
          <ScalePressable
            onPress={action.onPress}
            pressedScale={0.96}
            containerStyle={styles.itemPressable}
            accessibilityRole="button"
            accessibilityLabel={action.title}
          >
            <View style={styles.item}>
              <View style={styles.iconCircle}>
                <Text style={styles.emoji}>{action.emoji}</Text>
              </View>
              <Text style={styles.label}>{action.title}</Text>
            </View>
          </ScalePressable>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    width: "100%",
    gap: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  itemWrap: {
    width: "25%",
    minWidth: 0,
    flexGrow: 0,
    flexShrink: 0,
  },
  itemPressable: {
    width: "100%",
  },
  item: {
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
    fontSize: 24,
    lineHeight: 28,
  },
  label: {
    width: "100%",
    minWidth: 0,
    color: colors.textMuted,
    fontWeight: "600",
    fontSize: 12,
    lineHeight: 15,
    textAlign: "center",
    flexShrink: 0,
    ...webLabelStyle,
  },
});
