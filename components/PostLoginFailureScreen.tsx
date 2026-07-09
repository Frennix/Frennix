import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@frennix/ui";
import { flexFill, webAppShell } from "@/lib/flex-layout";
import { pushScreen } from "@/lib/press-utils";

type PostLoginFailureScreenProps = {
  title?: string;
  message: string;
  detail?: string;
  onRetry?: () => void;
};

/** Visible fallback when post-login startup fails — never leave a black screen. */
export function PostLoginFailureScreen({
  title = "Frennix could not finish loading",
  message,
  detail,
  onRetry,
}: PostLoginFailureScreenProps) {
  return (
    <View style={styles.container} nativeID="post-login-failure-screen">
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      <View style={styles.actions}>
        {onRetry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry"
            onPress={onRetry}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open diagnostics"
          onPress={() => pushScreen("/beta-diagnostics")}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.secondaryButtonText}>Diagnostics</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...flexFill,
    ...(Platform.OS === "web" ? webAppShell : null),
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  message: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 340,
  },
  detail: {
    color: colors.danger,
    fontSize: 13,
    textAlign: "center",
    maxWidth: 360,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: spacing.md,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.accent,
  },
  secondaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
});
