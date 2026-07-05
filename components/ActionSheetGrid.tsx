import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Platform, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { ScalePressable, colors, radius, spacing, typography } from "@frennix/ui";

export const ACTION_SHEET_FONT_SCALE_MAX = 1.35;

/** Max tiles visible without scrolling in a 2-column grid (2 cols × 3 rows). */
export const ACTION_SHEET_GRID_SCROLL_THRESHOLD = 6;

export const ACTION_SHEET_GRID_COLUMNS = 2;

export const ACTION_SHEET_TILE_HEIGHT_PRIMARY = 92;
export const ACTION_SHEET_TILE_HEIGHT_SECONDARY = 76;
export const ACTION_SHEET_TILE_HEIGHT_STANDARD = 84;

export type ActionSheetTileVariant = "primary" | "secondary" | "standard";

export type ActionSheetTileProps = {
  emoji: string;
  label: string;
  active?: boolean;
  highlighted?: boolean;
  variant?: ActionSheetTileVariant;
  onPress: () => void;
  accessibilityHint?: string;
};

const TILE_VARIANT_STYLES: Record<
  ActionSheetTileVariant,
  { height: number; emojiSize: number; emojiLine: number; labelStyle: object }
> = {
  primary: {
    height: ACTION_SHEET_TILE_HEIGHT_PRIMARY,
    emojiSize: 30,
    emojiLine: 34,
    labelStyle: { ...typography.bodySmall, fontWeight: "700" as const },
  },
  secondary: {
    height: ACTION_SHEET_TILE_HEIGHT_SECONDARY,
    emojiSize: 24,
    emojiLine: 28,
    labelStyle: { ...typography.caption, fontWeight: "600" as const },
  },
  standard: {
    height: ACTION_SHEET_TILE_HEIGHT_STANDARD,
    emojiSize: 26,
    emojiLine: 30,
    labelStyle: { ...typography.caption, fontWeight: "700" as const },
  },
};

export function ActionSheetTile({
  emoji,
  label,
  active,
  highlighted,
  variant = "standard",
  onPress,
  accessibilityHint,
}: ActionSheetTileProps) {
  const pulse = useRef(new Animated.Value(1)).current;
  const variantStyle = TILE_VARIANT_STYLES[variant];

  useEffect(() => {
    if (!highlighted) {
      pulse.setValue(1);
      return;
    }
    Animated.sequence([
      Animated.spring(pulse, {
        toValue: 1.08,
        useNativeDriver: true,
        damping: 14,
        stiffness: 340,
      }),
      Animated.timing(pulse, {
        toValue: 1.02,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start();
  }, [highlighted, pulse]);

  return (
    <ScalePressable
      style={[
        styles.tile,
        variant === "primary" && styles.tilePrimary,
        variant === "secondary" && styles.tileSecondary,
        { height: variantStyle.height },
        (active || highlighted) && styles.tileActive,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected: Boolean(active || highlighted) }}
    >
      <Animated.View
        style={[
          styles.tileInner,
          (active || highlighted) && styles.tileInnerActive,
          { transform: [{ scale: pulse }] },
        ]}
      >
        <Text
          style={[
            styles.emoji,
            { fontSize: variantStyle.emojiSize, lineHeight: variantStyle.emojiLine },
          ]}
          allowFontScaling
          maxFontSizeMultiplier={ACTION_SHEET_FONT_SCALE_MAX}
        >
          {emoji}
        </Text>
        <Text
          style={[
            styles.label,
            variantStyle.labelStyle,
            (active || highlighted) && styles.labelActive,
          ]}
          numberOfLines={1}
          allowFontScaling
          maxFontSizeMultiplier={ACTION_SHEET_FONT_SCALE_MAX}
        >
          {label}
        </Text>
      </Animated.View>
    </ScalePressable>
  );
}

export type ActionSheetGridProps<T extends { id: string }> = {
  items: T[];
  columns?: number;
  style?: ViewStyle;
  regionStyle?: ViewStyle;
  renderItem: (item: T) => ReactNode;
};

/**
 * Equal 2-column grid — use when action count exceeds the priority layout (5+ actions).
 * Scroll is enabled by the parent sheet once items exceed ACTION_SHEET_GRID_SCROLL_THRESHOLD.
 */
export function ActionSheetGrid<T extends { id: string }>({
  items,
  style,
  regionStyle,
  renderItem,
}: ActionSheetGridProps<T>) {
  return (
    <View style={[styles.region, regionStyle]}>
      <View style={[styles.equalGrid, style]}>
        {items.map((item) => (
          <View key={item.id} style={styles.equalCell}>
            {renderItem(item)}
          </View>
        ))}
      </View>
    </View>
  );
}

export type ActionSheetPriorityGridProps<T extends { id: string }> = {
  primaryRow: T[];
  secondaryRow: T[];
  regionStyle?: ViewStyle;
  renderItem: (item: T, tier: "primary" | "secondary") => ReactNode;
};

/**
 * Instagram-style priority layout — emphasized top row (Like, Reply), secondary bottom row.
 * Content-sized; no scrolling for the standard four-action set.
 */
export function ActionSheetPriorityGrid<T extends { id: string }>({
  primaryRow,
  secondaryRow,
  regionStyle,
  renderItem,
}: ActionSheetPriorityGridProps<T>) {
  return (
    <View style={[styles.region, regionStyle]}>
      <View style={styles.priorityRows}>
        <View style={styles.priorityRow}>
          {primaryRow.map((item) => (
            <View key={item.id} style={styles.priorityCell}>
              {renderItem(item, "primary")}
            </View>
          ))}
        </View>
        <View style={styles.priorityRow}>
          {secondaryRow.map((item) => (
            <View key={item.id} style={styles.priorityCell}>
              {renderItem(item, "secondary")}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  region: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  priorityRows: {
    gap: spacing.sm,
    width: "100%",
  },
  priorityRow: {
    flexDirection: "row",
    gap: spacing.sm,
    width: "100%",
  },
  priorityCell: {
    flex: 1,
    minWidth: 0,
  },
  equalGrid: {
    width: "100%",
    ...(Platform.OS === "web"
      ? ({
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          columnGap: spacing.sm,
          rowGap: spacing.sm,
        } as object)
      : {
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          rowGap: spacing.sm,
        }),
  },
  equalCell: {
    flexGrow: 0,
    flexShrink: 0,
    ...(Platform.OS === "web"
      ? ({} as object)
      : ({ width: "48%", maxWidth: "48%" } as object)),
  },
  tile: {
    width: "100%",
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? ({
          boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
        } as object)
      : null),
  },
  tilePrimary: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.1)",
  },
  tileSecondary: {
    backgroundColor: colors.surfaceElevated,
    borderColor: "rgba(255,255,255,0.06)",
  },
  tileInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  tileInnerActive: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
  },
  tileActive: {
    borderColor: colors.accent,
  },
  emoji: {},
  label: {
    color: colors.text,
    textAlign: "center",
    letterSpacing: 0.1,
  },
  labelActive: { color: colors.accent },
});
