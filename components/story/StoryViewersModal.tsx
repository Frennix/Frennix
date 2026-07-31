import { memo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { StoryViewerRecord } from "@frennix/types";
import { BottomOverlayShell } from "@/components/BottomOverlayShell";
import {
  Avatar,
  colors,
  formatRelativeTime,
  spacing,
  typography,
} from "@frennix/ui";

export type StoryViewerAction = "message" | "follow" | "invite" | "profile";

type StoryViewersModalProps = {
  visible: boolean;
  viewers: StoryViewerRecord[];
  loading?: boolean;
  onClose: () => void;
  onViewerPress?: (viewer: StoryViewerRecord) => void;
};

export const StoryViewersModal = memo(function StoryViewersModal({
  visible,
  viewers,
  loading,
  onClose,
  onViewerPress,
}: StoryViewersModalProps) {
  return (
    <BottomOverlayShell
      visible={visible}
      onClose={onClose}
      animationType="slide"
      expanded
      backdropColor="rgba(0,0,0,0.45)"
      horizontalPadding={0}
      sheetMaxHeight="78%"
      sheetStyle={styles.sheet}
    >
      <Text style={styles.title}>Viewed by</Text>
      {loading ? (
        <Text style={styles.empty}>Loading viewers…</Text>
      ) : viewers.length ? (
        <FlatList
          data={viewers}
          keyExtractor={(item) => item.viewer_id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => onViewerPress?.(item)}
              accessibilityRole="button"
              accessibilityLabel={`View ${item.profile.display_name}'s profile`}
            >
              <Avatar uri={item.profile.avatar_url} name={item.profile.display_name} size={44} />
              <View style={styles.meta}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.profile.display_name}
                </Text>
                <Text style={styles.username} numberOfLines={1}>
                  @{item.profile.username}
                </Text>
                <Text style={styles.viewedAt} numberOfLines={1}>
                  {formatRelativeTime(item.viewed_at)}
                </Text>
              </View>
            </Pressable>
          )}
        />
      ) : (
        <Text style={styles.empty}>No views yet.</Text>
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
    gap: spacing.sm,
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
  username: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  viewedAt: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    paddingVertical: spacing.lg,
  },
});
