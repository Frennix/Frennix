import { memo } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { StoryReactionRecord } from "@frennix/types";
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.title}>Reactions</Text>
          {loading ? (
            <Text style={styles.empty}>Loading reactions…</Text>
          ) : reactions.length ? (
            <FlatList
              data={reactions}
              keyExtractor={(item) => `${item.user_id}-${item.created_at}`}
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <Avatar
                    uri={item.profile.avatar_url}
                    name={item.profile.display_name}
                    size={44}
                  />
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
        </Pressable>
      </Pressable>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "70%",
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
