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
import { colors, spacing, touchTarget, typography } from "./theme";

interface FeedSearchBarProps {
  value?: string;
  onChangeText?: (text: string) => void;
  inputRef?: TextInputProps["ref"];
  onFocus?: () => void;
  onBlur?: () => void;
  onBarPress?: () => void;
  onFilterPress?: () => void;
  onClear?: () => void;
  placeholder?: string;
  editable?: boolean;
  autoFocus?: boolean;
}

const BAR_HEIGHT = 48;
const BAR_RADIUS = 17;

export const FeedSearchBar = memo(function FeedSearchBar({
  value = "",
  onChangeText,
  inputRef,
  onFocus,
  onBlur,
  onBarPress,
  onFilterPress,
  onClear,
  placeholder = "Search athletes, workouts, events",
  editable = true,
  autoFocus = false,
}: FeedSearchBarProps) {
  const isTrigger = Boolean(onBarPress);
  const inputEditable = editable && !isTrigger;
  const showClear = value.length > 0 && inputEditable && onClear;

  const input = (
    <TextInput
      ref={inputRef}
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      onFocus={isTrigger ? onBarPress : onFocus}
      onBlur={onBlur}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      editable={inputEditable}
      autoFocus={autoFocus}
      autoCorrect={false}
      autoCapitalize="none"
      returnKeyType="search"
      clearButtonMode="never"
      showSoftInputOnFocus={!isTrigger}
      accessibilityRole="search"
      accessibilityLabel={placeholder}
      {...(isTrigger ? { pointerEvents: "none" as const } : null)}
    />
  );

  return (
    <View style={styles.wrap} nativeID="feed-search-bar">
      <View style={styles.bar}>
        <View pointerEvents="none" style={styles.leadingIcon}>
          <Search size={18} color={colors.textMuted} strokeWidth={2.25} />
        </View>
        {isTrigger ? (
          <Pressable
            style={styles.inputPressable}
            onPress={onBarPress}
            accessibilityRole="search"
            accessibilityLabel={placeholder}
            accessibilityHint="Opens search"
          >
            {input}
          </Pressable>
        ) : (
          input
        )}
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

const webInputStyle: ViewStyle =
  Platform.OS === "web"
    ? ({
        outlineStyle: "none",
      } as ViewStyle)
    : {};

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    flexShrink: 1,
    overflow: "hidden",
  },
  bar: {
    minHeight: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    flexShrink: 1,
    overflow: "hidden",
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  leadingIcon: {
    flexShrink: 0,
  },
  inputPressable: {
    flex: 1,
    minWidth: 0,
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
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
