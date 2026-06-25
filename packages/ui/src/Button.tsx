import { useRef } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
} from "react-native";
import { colors, radius, spacing } from "./theme";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends PressableProps {
  title: string;
  loadingTitle?: string;
  variant?: ButtonVariant;
  loading?: boolean;
  /** Ignore repeat presses within this window (ms). Default 450. */
  pressCooldownMs?: number;
}

export function Button({
  title,
  loadingTitle,
  variant = "primary",
  loading,
  disabled,
  style,
  onPress,
  pressCooldownMs = 450,
  ...props
}: ButtonProps) {
  const lockedRef = useRef(false);
  const isDisabled = disabled && !loading;

  function handlePress(event: Parameters<NonNullable<PressableProps["onPress"]>>[0]) {
    if (isDisabled || lockedRef.current) return;
    lockedRef.current = true;
    onPress?.(event);
    setTimeout(() => {
      lockedRef.current = false;
    }, pressCooldownMs);
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !isDisabled && styles.pressed,
        (isDisabled || loading) && styles.disabled,
        style,
      ]}
      disabled={isDisabled}
      onPress={handlePress}
      android_ripple={
        Platform.OS === "android"
          ? { color: variant === "primary" ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)" }
          : undefined
      }
      {...props}
    >
      {loading ? (
        loadingTitle ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={variant === "primary" ? colors.black : colors.text} />
            <Text style={[styles.text, styles[`${variant}Text` as keyof typeof styles]]}>
              {loadingTitle}
            </Text>
          </View>
        ) : (
          <ActivityIndicator color={variant === "primary" ? colors.black : colors.text} />
        )
      ) : (
        <Text style={[styles.text, styles[`${variant}Text` as keyof typeof styles]]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  ghost: { backgroundColor: "transparent" },
  danger: { backgroundColor: colors.danger },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  text: { fontSize: 16, fontWeight: "600" },
  primaryText: { color: colors.black },
  secondaryText: { color: colors.text },
  ghostText: { color: colors.accent },
  dangerText: { color: colors.white },
});
