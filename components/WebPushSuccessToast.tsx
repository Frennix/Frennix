import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@frennix/ui";

let showToastHandler: ((message: string) => void) | null = null;

export function showWebPushSuccessToast(
  message = "✅ Notifications are enabled. You're all set!"
) {
  showToastHandler?.(message);
}

export function WebPushSuccessToastHost() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    showToastHandler = (next) => {
      setMessage(next);
      if (typeof window !== "undefined") {
        window.setTimeout(() => setMessage(null), 3200);
      }
    };
    return () => {
      showToastHandler = null;
    };
  }, []);

  if (Platform.OS !== "web" || !message) return null;

  return (
    <View style={styles.host} pointerEvents="none">
      <View style={styles.toast}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "fixed" as unknown as "absolute",
    left: 0,
    right: 0,
    bottom: 96,
    alignItems: "center",
    zIndex: 9999,
  },
  toast: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: 340,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  text: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "600",
    textAlign: "center",
  },
});
