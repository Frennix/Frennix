import { memo, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { Search, SlidersHorizontal } from "lucide-react-native";
import { colors, overlays, spacing, touchTarget, typography } from "./theme";

interface FeedSearchBarProps {
  onPress: () => void;
  onFilterPress?: () => void;
  placeholder?: string;
}

const BAR_HEIGHT = 48;
const BAR_RADIUS = 17;

export const FeedSearchBar = memo(function FeedSearchBar({
  onPress,
  onFilterPress,
  placeholder = "Search athletes, workouts, events",
}: FeedSearchBarProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <View style={styles.wrap} nativeID="feed-search-bar">
      <Pressable
        style={[styles.bar, pressed && styles.barPressed]}
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="search"
        accessibilityLabel={placeholder}
        accessibilityHint="Opens Discover search"
      >
        <Search size={18} color={colors.textMuted} strokeWidth={2.25} />
        <Text style={styles.placeholder} numberOfLines={1}>
          {placeholder}
        </Text>
        {onFilterPress ? (
          <Pressable
            style={styles.filterButton}
            onPress={(event) => {
              event.stopPropagation?.();
              onFilterPress();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Open Discover filters"
          >
            <SlidersHorizontal size={18} color={colors.textMuted} strokeWidth={2.25} />
          </Pressable>
        ) : null}
      </Pressable>
    </View>
  );
});

const webBarStyle: ViewStyle =
  Platform.OS === "web"
    ? ({
        cursor: "pointer",
        width: "100%",
        maxWidth: "100%",
      } as ViewStyle)
    : {};

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },
  bar: {
    minHeight: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...webBarStyle,
  },
  barPressed: {
    borderColor: overlays.accentBorder,
    backgroundColor: colors.surfaceElevated,
    ...(Platform.OS === "web"
      ? ({ boxShadow: `0 0 0 1px ${overlays.accentTintStrong}` } as ViewStyle)
      : null),
  },
  placeholder: {
    ...typography.bodySmall,
    flex: 1,
    minWidth: 0,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 18,
  },
  filterButton: {
    width: touchTarget,
    height: touchTarget,
    marginRight: -spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
