import { memo } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { StoryViewerRecord } from "@frennix/types";
import { Avatar, colors, formatRelativeTime, spacing, typography } from "@frennix/ui";

type StoryViewersModalProps = {
  visible: boolean;
  viewers: StoryViewerRecord[];
  loading?: boolean;
  onClose: () => void;
};

export const StoryViewersModal = memo(function StoryViewersModal({
  visible,
  viewers,
  loading,
  onClose,
}: StoryViewersModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.title}>Viewed By</Text>
          {loading ? (
            <Text style={styles.empty}>Loading viewers…</Text>
          ) : viewers.length ? (
            <FlatList
              data={viewers}
              keyExtractor={(item) => item.viewer_id}
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
                      @{item.profile.username} • Viewed {formatRelativeTime(item.viewed_at)}
                    </Text>
                  </View>
                </View>
              )}
            />
          ) : (
            <Text style={styles.empty}>No views yet.</Text>
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
