import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ExecutiveKpi } from "@frennix/types";
import { useRouter } from "expo-router";
import { colors, spacing, typography } from "@frennix/ui";

function formatKpiValue(kpi: ExecutiveKpi): string {
  if (kpi.value == null) return kpi.placeholder ? "—" : "0";
  if (typeof kpi.value === "number") {
    if (kpi.key === "push_delivery_rate") return `${kpi.value.toFixed(1)}%`;
    return kpi.value.toLocaleString();
  }
  return String(kpi.value);
}

function statusColor(value: string | number | null | undefined) {
  const text = String(value ?? "").toLowerCase();
  if (text === "healthy" || text === "ok") return colors.accent;
  if (text === "degraded" || text === "unknown") return colors.warning ?? colors.textSecondary;
  if (text === "down" || text === "error") return colors.danger;
  return colors.text;
}

export function ExecutiveKpiGrid({ kpis }: { kpis: ExecutiveKpi[] }) {
  const router = useRouter();

  return (
    <View style={styles.grid}>
      {kpis.map((kpi) => {
        const isStatus = kpi.key === "system_status" || kpi.key === "server_health";
        return (
          <Pressable
            key={kpi.key}
            accessibilityRole="button"
            accessibilityLabel={`${kpi.label}: ${formatKpiValue(kpi)}`}
            style={styles.card}
            onPress={() => {
              if (kpi.drillDown) router.push(kpi.drillDown as never);
            }}
          >
            <Text style={styles.emoji}>{kpi.emoji}</Text>
            <Text
              style={[
                styles.value,
                isStatus && { color: statusColor(kpi.value) },
                kpi.placeholder && styles.placeholder,
              ]}
              numberOfLines={1}
            >
              {formatKpiValue(kpi)}
            </Text>
            <Text style={styles.label} numberOfLines={2}>
              {kpi.label}
            </Text>
            {kpi.placeholder ? <Text style={styles.badge}>Soon</Text> : null}
          </Pressable>
        );
      })}
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
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    minHeight: 88,
  },
  emoji: { fontSize: 16, marginBottom: 4 },
  value: { ...typography.heading, fontSize: 20, color: colors.text },
  label: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  placeholder: { color: colors.textMuted },
  badge: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
