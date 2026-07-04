import { memo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { StoryViewerRecord } from "@frennix/types";
import { BottomOverlayShell } from "@/components/BottomOverlayShell";
import {
  Avatar,
  colors,
  formatPresenceStatus,
  formatRelativeTime,
  isProfileOnline,
  spacing,
  typography,
} from "@frennix/ui";

export type StoryViewerAction = "message" | "follow" | "invite" | "profile";

type StoryViewersModalProps = {
  visible: boolean;
  viewers: StoryViewerRecord[];
  loading?: boolean;
  onClose: () => void;
  onViewerAction?: (viewer: StoryViewerRecord, action: StoryViewerAction) => void;
};

export const StoryViewersModal = memo(function StoryViewersModal({
  visible,
  viewers,
  loading,
  onClose,
  onViewerAction,
}: StoryViewersModalProps) {
  const [activeViewerId, setActiveViewerId] = useState<string | null>(null);

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
      <Text style={styles.title}>Viewed By</Text>
      <Text style={styles.subtitle}>Tap a viewer to message, follow, invite, or view profile.</Text>
      {loading ? (
        <Text style={styles.empty}>Loading viewers…</Text>
      ) : viewers.length ? (
        <FlatList
          data={viewers}
          keyExtractor={(item) => item.viewer_id}
          renderItem={({ item }) => {
                const online = isProfileOnline(item.profile);
                const menuOpen = activeViewerId === item.viewer_id;

                return (
                  <View style={styles.rowWrap}>
                    <Pressable
                      style={styles.row}
                      onPress={() =>
                        setActiveViewerId((current) =>
                          current === item.viewer_id ? null : item.viewer_id
                        )
                      }
                    >
                      <View style={styles.avatarWrap}>
                        <Avatar
                          uri={item.profile.avatar_url}
                          name={item.profile.display_name}
                          size={44}
                        />
                        {online ? <View style={styles.onlineDot} /> : null}
                      </View>
                      <View style={styles.meta}>
                        <Text style={styles.name} numberOfLines={1}>
                          {item.profile.display_name}
                        </Text>
                        <Text style={styles.detail} numberOfLines={1}>
                          @{item.profile.username} · Viewed {formatRelativeTime(item.viewed_at)}
                        </Text>
                        <Text style={styles.status} numberOfLines={1}>
                          {online
                            ? "Online now"
                            : formatPresenceStatus(item.profile)}{" "}
                          {item.is_following ? "· Following" : item.follows_you ? "· Follows you" : ""}
                        </Text>
                      </View>
                    </Pressable>
                    {menuOpen && onViewerAction ? (
                      <View style={styles.actions}>
                        <Pressable
                          style={styles.actionChip}
                          onPress={() => onViewerAction(item, "message")}
                        >
                          <Text style={styles.actionText}>Message</Text>
                        </Pressable>
                        {!item.is_following ? (
                          <Pressable
                            style={styles.actionChip}
                            onPress={() => onViewerAction(item, "follow")}
                          >
                            <Text style={styles.actionText}>Follow</Text>
                          </Pressable>
                        ) : null}
                        <Pressable
                          style={styles.actionChip}
                          onPress={() => onViewerAction(item, "invite")}
                        >
                          <Text style={styles.actionText}>Invite to Train</Text>
                        </Pressable>
                        <Pressable
                          style={styles.actionChip}
                          onPress={() => onViewerAction(item, "profile")}
                        >
                          <Text style={styles.actionText}>Profile</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              }}
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
  subtitle: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  rowWrap: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  avatarWrap: {
    position: "relative",
  },
  onlineDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.background,
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
  detail: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  status: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingBottom: spacing.sm,
    paddingLeft: 56,
  },
  actionChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "700",
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    paddingVertical: spacing.lg,
  },
});
