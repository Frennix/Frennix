import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@frennix/ui";

type TrendSparklineProps = {
  label: string;
  data: Array<{ value: number | null; label?: string }>;
  suffix?: string;
  color?: string;
};

export function TrendSparkline({ label, data, suffix = "ms", color = colors.accent }: TrendSparklineProps) {
  const values = data.map((d) => d.value ?? 0);
  const max = Math.max(...values, 1);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.bars}>
        {data.map((point, index) => {
          const height = Math.max(4, ((point.value ?? 0) / max) * 48);
          return (
            <View key={`${point.label ?? index}`} style={styles.barCol}>
              <View style={[styles.bar, { height, backgroundColor: color }]} />
            </View>
          );
        })}
      </View>
      <Text style={styles.meta}>
        {data.length ? `${data[data.length - 1]?.value ?? "—"}${suffix} latest` : "No data"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs, marginBottom: spacing.sm },
  label: { ...typography.caption, fontWeight: "700", color: colors.textSecondary },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 3, height: 52 },
  barCol: { flex: 1, justifyContent: "flex-end" },
  bar: { borderRadius: 2, minWidth: 4 },
  meta: { ...typography.caption, color: colors.textMuted },
});
