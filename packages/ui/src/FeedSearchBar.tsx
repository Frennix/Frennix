import { memo } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { Search, SlidersHorizontal, X } from "lucide-react-native";
import { colors, overlays, spacing, touchTarget, typography } from "./theme";

interface FeedSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  inputRef?: TextInputProps["ref"];
  onFocus?: () => void;
  onBlur?: () => void;
  onFilterPress?: () => void;
  onClear?: () => void;
  placeholder?: string;
  editable?: boolean;
}

const BAR_HEIGHT = 48;
const BAR_RADIUS = 17;

export const FeedSearchBar = memo(function FeedSearchBar({
  value,
  onChangeText,
  inputRef,
  onFocus,
  onBlur,
  onFilterPress,
  onClear,
  placeholder = "Search athletes, workouts, events",
  editable = true,
}: FeedSearchBarProps) {
  const showClear = value.length > 0 && editable;

  return (
    <View style={styles.wrap} nativeID="feed-search-bar">
      <View style={styles.bar}>
        <Search size={18} color={colors.textMuted} strokeWidth={2.25} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          editable={editable}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="never"
          accessibilityRole="search"
          accessibilityLabel={placeholder}
        />
        {showClear ? (
          <Pressable
            style={styles.iconButton}
            onPress={onClear}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <X size={16} color={colors.textMuted} strokeWidth={2.25} />
          </Pressable>
        ) : null}
        {onFilterPress ? (
          <Pressable
            style={styles.iconButton}
            onPress={onFilterPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Open Discover filters"
          >
            <SlidersHorizontal size={18} color={colors.textMuted} strokeWidth={2.25} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});

const webBarStyle: ViewStyle =
  Platform.OS === "web"
    ? ({
        width: "100%",
        maxWidth: "100%",
      } as ViewStyle)
    : {};

const webInputStyle: ViewStyle =
  Platform.OS === "web"
    ? ({
        outlineStyle: "none",
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
  input: {
    ...typography.bodySmall,
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
    paddingVertical: Platform.OS === "web" ? spacing.xs : spacing.sm,
    ...webInputStyle,
  },
  iconButton: {
    width: touchTarget,
    height: touchTarget,
    marginRight: -spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
