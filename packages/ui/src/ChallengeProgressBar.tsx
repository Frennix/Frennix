import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "./theme";

type Props = {
  progressPct: number;
  myCheckIns?: number;
  totalDays?: number;
  label?: string;
};

export function ChallengeProgressBar({
  progressPct,
  myCheckIns,
  totalDays,
  label = "Your progress",
}: Props) {
  const clamped = Math.min(100, Math.max(0, progressPct));
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>
          {myCheckIns != null && totalDays != null
            ? `${myCheckIns}/${totalDays} days · ${clamped}%`
            : `${clamped}%`}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${clamped}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { ...typography.bodySmall, fontWeight: "600", color: colors.textSecondary },
  value: { ...typography.caption, color: colors.accent, fontWeight: "600" },
  track: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
});
