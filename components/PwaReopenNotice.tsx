import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@frennix/ui";

const DEFAULT_MESSAGE =
  "Frennix has been updated. Please close and reopen the app to finish setup.";

let showNoticeHandler: ((message: string) => void) | null = null;

export function showPwaReopenNotice(message = DEFAULT_MESSAGE) {
  showNoticeHandler?.(message);
}

export function PwaReopenNoticeHost() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    showNoticeHandler = (next) => setMessage(next);
    return () => {
      showNoticeHandler = null;
    };
  }, []);

  if (Platform.OS !== "web" || !message) return null;

  return (
    <View style={styles.host} pointerEvents="box-none">
      <View style={styles.banner}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "fixed" as unknown as "absolute",
    left: spacing.md,
    right: spacing.md,
    top: spacing.md,
    zIndex: 9998,
    alignItems: "center",
  },
  banner: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  text: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 20,
  },
});
