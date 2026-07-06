import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@frennix/ui";

export type MessagesBulkAction = "delete" | "archive" | "mark_read" | "mark_unread";

type MessagesInboxToolbarProps = {
  selectMode: boolean;
  selectedCount: number;
  totalSelectable: number;
  canEdit: boolean;
  bulkLoading?: boolean;
  onEnterSelectMode: () => void;
  onExitSelectMode: () => void;
  onSelectAll: () => void;
  onBulkAction: (action: MessagesBulkAction) => void;
};

function BulkChip({
  label,
  tone = "default",
  disabled,
  loading,
  onPress,
}: {
  label: string;
  tone?: "default" | "danger";
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.chip,
        tone === "danger" && styles.chipDanger,
        disabled && styles.chipDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator color={tone === "danger" ? colors.white : colors.text} size="small" />
      ) : (
        <Text style={[styles.chipText, tone === "danger" && styles.chipTextDanger]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function MessagesInboxToolbar({
  selectMode,
  selectedCount,
  totalSelectable,
  canEdit,
  bulkLoading = false,
  onEnterSelectMode,
  onExitSelectMode,
  onSelectAll,
  onBulkAction,
}: MessagesInboxToolbarProps) {
  if (!canEdit && !selectMode) return null;

  const hasSelection = selectedCount > 0;
  const allSelected = totalSelectable > 0 && selectedCount >= totalSelectable;

  return (
    <View style={styles.wrapper}>
      <View style={styles.bar}>
        {selectMode ? (
          <>
            <Pressable
              onPress={onExitSelectMode}
              accessibilityRole="button"
              accessibilityLabel="Cancel selection"
              hitSlop={8}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Text style={styles.selectedLabel}>
              {selectedCount === 0
                ? "Select conversations"
                : `${selectedCount} selected`}
            </Text>
            <Pressable
              onPress={onSelectAll}
              accessibilityRole="button"
              accessibilityLabel={allSelected ? "Deselect all conversations" : "Select all conversations"}
              hitSlop={8}
            >
              <Text style={styles.selectAllText}>{allSelected ? "Deselect All" : "Select All"}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.spacer} />
            <Pressable
              onPress={onEnterSelectMode}
              accessibilityRole="button"
              accessibilityLabel="Select conversations"
              hitSlop={8}
            >
              <Text style={styles.editText}>Edit</Text>
            </Pressable>
          </>
        )}
      </View>
      {selectMode ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.bulkRow}
        >
          <BulkChip
            label="Mark Read"
            disabled={!hasSelection || bulkLoading}
            onPress={() => onBulkAction("mark_read")}
          />
          <BulkChip
            label="Mark Unread"
            disabled={!hasSelection || bulkLoading}
            onPress={() => onBulkAction("mark_unread")}
          />
          <BulkChip
            label="Archive Selected"
            disabled={!hasSelection || bulkLoading}
            onPress={() => onBulkAction("archive")}
          />
          <BulkChip
            label="Delete Selected"
            tone="danger"
            disabled={!hasSelection || bulkLoading}
            loading={bulkLoading}
            onPress={() => onBulkAction("delete")}
          />
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bulkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  spacer: { flex: 1 },
  editText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: "600",
  },
  cancelText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  selectAllText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: "600",
  },
  selectedLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    textAlign: "center",
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  chipDanger: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "700",
  },
  chipTextDanger: {
    color: colors.white,
  },
});
