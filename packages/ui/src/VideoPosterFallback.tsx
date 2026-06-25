import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors, typography } from "./theme";

interface VideoPosterFallbackProps {
  style?: ViewStyle;
  compact?: boolean;
  label?: string;
}

/** Non-blank placeholder when a video poster cannot be loaded. */
export function VideoPosterFallback({
  style,
  compact,
  label = "Workout video",
}: VideoPosterFallbackProps) {
  return (
    <View style={[styles.wrap, compact && styles.compact, style]}>
      <View style={styles.badge}>
        <Text style={[styles.icon, compact && styles.iconCompact]}>🎬</Text>
      </View>
      <Text style={[styles.label, compact && styles.labelCompact]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.surfaceElevated,
  },
  compact: {
    gap: 4,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    fontSize: 26,
    lineHeight: 30,
  },
  iconCompact: {
    fontSize: 18,
    lineHeight: 22,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "600",
  },
  labelCompact: {
    fontSize: 10,
  },
});
