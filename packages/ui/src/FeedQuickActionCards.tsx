import { memo } from "react";
import { Platform, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { ScalePressable } from "./ScalePressable";
import { applyShadow, colors, overlays, spacing } from "./theme";

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

const CARD_GAP = 12;
const CARD_RADIUS = 17;
const CARD_MIN_HEIGHT = 92;
const CARD_PADDING = 16;

function pairActions(actions: FeedQuickAction[]): FeedQuickAction[][] {
  const rows: FeedQuickAction[][] = [];
  for (let i = 0; i < actions.length; i += 2) {
    rows.push(actions.slice(i, i + 2));
  }
  return rows;
}

export const FeedQuickActionCards = memo(function FeedQuickActionCards({
  actions,
  style,
}: FeedQuickActionCardsProps) {
  const rows = pairActions(actions);

  return (
    <View style={[styles.grid, style]} nativeID="feed-quick-actions-grid">
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
          {row.map((action) => (
            <View key={action.key} style={styles.cardWrap}>
              <ScalePressable
                onPress={action.onPress}
                pressedScale={0.97}
                containerStyle={styles.cardPressable}
                accessibilityRole="button"
                accessibilityLabel={action.title}
              >
                <View style={styles.card}>
                  <View style={styles.iconBubble}>
                    <Text style={styles.emoji}>{action.emoji}</Text>
                  </View>
                  <Text style={styles.title}>{action.title}</Text>
                </View>
              </ScalePressable>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
});

const webTitleStyle: ViewStyle =
  Platform.OS === "web"
    ? ({
        whiteSpace: "normal",
        wordBreak: "normal",
        overflowWrap: "normal",
      } as ViewStyle)
    : {};

const webGridStyle: ViewStyle =
  Platform.OS === "web"
    ? ({
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: CARD_GAP,
        width: "100%",
      } as ViewStyle)
    : {};

const styles = StyleSheet.create({
  grid: {
    width: "100%",
    gap: CARD_GAP,
    ...webGridStyle,
  },
  row: {
    flexDirection: "row",
    gap: CARD_GAP,
    width: "100%",
    ...(Platform.OS === "web" ? ({ display: "contents" } as ViewStyle) : null),
  },
  cardWrap: {
    flex: 1,
    minWidth: 0,
    ...(Platform.OS === "web" ? ({ minWidth: 0 } as ViewStyle) : null),
  },
  cardPressable: {
    width: "100%",
  },
  card: {
    minHeight: CARD_MIN_HEIGHT,
    borderRadius: CARD_RADIUS,
    padding: CARD_PADDING,
    flexDirection: "row",
    alignItems: "center",
    gap: CARD_GAP,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    backgroundColor: overlays.accentTintStrong,
    borderWidth: 1,
    borderColor: overlays.accentBorder,
  },
  emoji: {
    fontSize: 20,
    lineHeight: 24,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 19,
    color: colors.text,
    ...webTitleStyle,
  },
});
