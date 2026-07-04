import { memo } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { StoryReactionRecord } from "@frennix/types";
import { BottomOverlayShell } from "@/components/BottomOverlayShell";
import { Avatar, colors, formatRelativeTime, spacing, typography } from "@frennix/ui";

type StoryReactionsModalProps = {
  visible: boolean;
  reactions: StoryReactionRecord[];
  loading?: boolean;
  onClose: () => void;
};

export const StoryReactionsModal = memo(function StoryReactionsModal({
  visible,
  reactions,
  loading,
  onClose,
}: StoryReactionsModalProps) {
  return (
    <BottomOverlayShell
      visible={visible}
      onClose={onClose}
      animationType="slide"
      expanded
      backdropColor="rgba(0,0,0,0.45)"
      horizontalPadding={0}
      sheetMaxHeight="70%"
      sheetStyle={styles.sheet}
    >
      <Text style={styles.title}>Reactions</Text>
      {loading ? (
        <Text style={styles.empty}>Loading reactions…</Text>
      ) : reactions.length ? (
        <FlatList
          data={reactions}
          keyExtractor={(item) => `${item.user_id}-${item.created_at}`}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Avatar uri={item.profile.avatar_url} name={item.profile.display_name} size={44} />
              <View style={styles.meta}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.profile.display_name}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {item.reaction} · {formatRelativeTime(item.created_at)}
                </Text>
              </View>
            </View>
          )}
        />
      ) : (
        <Text style={styles.empty}>No reactions yet.</Text>
      )}
    </BottomOverlayShell>
  );
});

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    fontWeight: "800",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typography.body,
    color: colors.text,
    fontWeight: "700",
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    paddingVertical: spacing.lg,
  },
});
