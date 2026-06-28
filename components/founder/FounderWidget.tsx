import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors, spacing, typography } from "@frennix/ui";
import type { FounderExportFormat } from "@frennix/types";

type FounderWidgetProps = {
  title: string;
  subtitle?: string;
  loading?: boolean;
  error?: string | null;
  updatedAt?: Date | null;
  onRefresh?: () => void;
  onExport?: (format: FounderExportFormat) => void;
  exportEnabled?: boolean;
  filterSlot?: React.ReactNode;
  style?: ViewStyle;
  children: React.ReactNode;
};

function formatUpdatedAt(date: Date | null | undefined) {
  if (!date) return null;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Updated just now";
  if (seconds < 3600) return `Updated ${Math.floor(seconds / 60)}m ago`;
  return `Updated ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

export function FounderWidget({
  title,
  subtitle,
  loading,
  error,
  updatedAt,
  onRefresh,
  onExport,
  exportEnabled,
  filterSlot,
  style,
  children,
}: FounderWidgetProps) {
  const updatedLabel = useMemo(() => formatUpdatedAt(updatedAt), [updatedAt]);

  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.actions}>
          {exportEnabled && onExport ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Export CSV"
                hitSlop={8}
                style={styles.actionBtn}
                onPress={() => onExport("csv")}
              >
                <Text style={styles.actionText}>CSV</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Export JSON"
                hitSlop={8}
                style={styles.actionBtn}
                onPress={() => onExport("json")}
              >
                <Text style={styles.actionText}>JSON</Text>
              </Pressable>
            </>
          ) : null}
          {onRefresh ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh widget"
              hitSlop={8}
              style={styles.actionBtn}
              onPress={onRefresh}
            >
              <Text style={styles.actionText}>↻</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {filterSlot ? <View style={styles.filterSlot}>{filterSlot}</View> : null}

      {loading ? (
        <ActivityIndicator color={colors.accent} style={styles.loader} />
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          {onRefresh ? (
            <Pressable onPress={onRefresh} hitSlop={8}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        children
      )}

      {updatedLabel ? <Text style={styles.footer}>{updatedLabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { ...typography.body, fontWeight: "700", color: colors.text },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  actionBtn: {
    minWidth: 36,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionText: { ...typography.caption, color: colors.accent, fontWeight: "600" },
  filterSlot: { marginTop: spacing.xs },
  loader: { paddingVertical: spacing.lg },
  errorBox: { paddingVertical: spacing.md, gap: spacing.xs },
  errorText: { ...typography.caption, color: colors.danger },
  retryText: { ...typography.caption, color: colors.accent, fontWeight: "600" },
  footer: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
