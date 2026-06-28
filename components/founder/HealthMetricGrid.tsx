import { StyleSheet, Text, View } from "react-native";
import type { HealthMetric } from "@frennix/types";
import { colors, spacing, typography } from "@frennix/ui";

type HealthMetricGridProps = {
  metrics: HealthMetric[];
};

function formatValue(metric: HealthMetric): string {
  if (metric.value === null || metric.value === undefined) return "—";
  if (typeof metric.value === "number") {
    const formatted = metric.value.toLocaleString();
    return metric.suffix ? `${formatted}${metric.suffix}` : formatted;
  }
  return String(metric.value);
}

export function HealthMetricGrid({ metrics }: HealthMetricGridProps) {
  return (
    <View style={styles.grid}>
      {metrics.map((metric) => (
        <View key={metric.key} style={styles.card}>
          <Text style={styles.emoji}>{metric.emoji}</Text>
          <Text style={styles.value}>{formatValue(metric)}</Text>
          <Text style={styles.label}>{metric.label}</Text>
          {metric.placeholder ? <Text style={styles.placeholder}>Soon</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  card: {
    width: "47%",
    minWidth: 140,
    flexGrow: 1,
    padding: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  emoji: { fontSize: 18 },
  value: { ...typography.body, fontWeight: "700", color: colors.text },
  label: { ...typography.caption, color: colors.textSecondary },
  placeholder: { ...typography.caption, color: colors.textMuted, fontStyle: "italic" },
});
