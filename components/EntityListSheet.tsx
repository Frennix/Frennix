import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Avatar, colors, radius, spacing, typography } from "@frennix/ui";

export interface EntityListSheetItem {
  id: string;
  displayName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  subtitle?: string | null;
}

interface EntityListSheetProps {
  visible: boolean;
  title: string;
  items: EntityListSheetItem[];
  loading?: boolean;
  emptyMessage?: string;
  onClose: () => void;
}

export function EntityListSheet({
  visible,
  title,
  items,
  loading = false,
  emptyMessage = "Nothing to show yet.",
  onClose,
}: EntityListSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <ScrollView style={styles.list}>
              {items.length ? (
                items.map((item) => (
                  <View key={item.id} style={styles.row}>
                    <Avatar
                      uri={item.avatarUrl ?? undefined}
                      name={item.displayName ?? undefined}
                      size={40}
                    />
                    <View style={styles.rowText}>
                      <Text style={styles.name}>{item.displayName ?? "Athlete"}</Text>
                      {item.username ? (
                        <Text style={styles.username}>@{item.username}</Text>
                      ) : null}
                      {item.subtitle ? (
                        <Text style={styles.subtitle}>{item.subtitle}</Text>
                      ) : null}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.empty}>{emptyMessage}</Text>
              )}
            </ScrollView>
          )}
          <Pressable style={[styles.option, styles.cancelOption]} onPress={onClose}>
            <Text style={styles.cancelText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 10, 11, 0.72)",
    justifyContent: "flex-end",
    padding: spacing.md,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    maxHeight: "70%",
  },
  title: {
    ...typography.body,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  loadingWrap: { padding: spacing.xl, alignItems: "center" },
  list: { maxHeight: 360 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowText: { flex: 1 },
  name: { ...typography.body, fontWeight: "600", color: colors.text },
  username: { ...typography.caption, color: colors.textMuted },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    padding: spacing.lg,
  },
  option: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "center",
  },
  cancelOption: { backgroundColor: colors.surfaceElevated },
  cancelText: { ...typography.body, fontWeight: "600", color: colors.textSecondary },
});
