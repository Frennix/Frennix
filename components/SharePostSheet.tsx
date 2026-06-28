import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Challenge, Conversation, Group, Post } from "@frennix/types";
import { Avatar, colors, radius, spacing, typography } from "@frennix/ui";

type ShareStep = "menu" | "message" | "group" | "challenge";
type ShareDestination = "message" | "group" | "challenge";

interface SharePostSheetProps {
  visible: boolean;
  post: Post | null;
  onClose: () => void;
  conversations: Conversation[];
  groups: Group[];
  challenges: Challenge[];
  loading?: boolean;
  sharing?: boolean;
  onShare: (destination: ShareDestination, targetId: string) => void;
}

export function SharePostSheet({
  visible,
  post,
  onClose,
  conversations,
  groups,
  challenges,
  loading,
  sharing,
  onShare,
}: SharePostSheetProps) {
  const [step, setStep] = useState<ShareStep>("menu");

  useEffect(() => {
    if (!visible) setStep("menu");
  }, [visible]);

  function handleClose() {
    if (sharing) return;
    setStep("menu");
    onClose();
  }

  function handleBack() {
    if (sharing) return;
    setStep("menu");
  }

  function renderMenu() {
    return (
      <>
        <Text style={styles.title}>Share post</Text>
        <Pressable style={styles.option} onPress={() => setStep("message")}>
          <Text style={styles.optionText}>Share to Message</Text>
        </Pressable>
        <Pressable style={styles.option} onPress={() => setStep("group")}>
          <Text style={styles.optionText}>Share to Group</Text>
        </Pressable>
        <Pressable style={styles.option} onPress={() => setStep("challenge")}>
          <Text style={styles.optionText}>Share to Challenge</Text>
        </Pressable>
        <Pressable style={[styles.option, styles.cancelOption]} onPress={handleClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </>
    );
  }

  function renderPicker(
    title: string,
    emptyMessage: string,
    items: { id: string; label: string; subtitle?: string; avatarUrl?: string | null; avatarName?: string }[],
    destination: ShareDestination
  ) {
    return (
      <>
        <View style={styles.pickerHeader}>
          <Pressable onPress={handleBack} hitSlop={8} disabled={sharing}>
            <Text style={styles.back}>← Back</Text>
          </Pressable>
          <Text style={styles.pickerTitle}>{title}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={styles.loader} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>}
            renderItem={({ item }) => (
              <Pressable
                style={styles.row}
                disabled={sharing}
                onPress={() => onShare(destination, item.id)}
              >
                <Avatar uri={item.avatarUrl} name={item.avatarName ?? item.label} size={44} />
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {item.subtitle ? (
                    <Text style={styles.rowSubtitle} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            )}
          />
        )}

        {sharing ? (
          <View style={styles.sharingOverlay}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.sharingText}>Sharing…</Text>
          </View>
        ) : null}
      </>
    );
  }

  let content = renderMenu();
  if (step === "message") {
    content = renderPicker(
      "Share to Message",
      "No conversations yet. Message someone from their profile first.",
      conversations.map((c) => ({
        id: c.id,
        label: c.other_participant?.display_name ?? "Chat",
        subtitle: c.last_message?.content,
        avatarUrl: c.other_participant?.avatar_url,
        avatarName: c.other_participant?.display_name,
      })),
      "message"
    );
  } else if (step === "group") {
    content = renderPicker(
      "Share to Group",
      "Join a group to share posts there.",
      groups.map((g) => ({
        id: g.id,
        label: g.name,
        subtitle: g.description ?? undefined,
      })),
      "group"
    );
  } else if (step === "challenge") {
    content = renderPicker(
      "Share to Challenge",
      "Join an active challenge to share posts there.",
      challenges.map((c) => ({
        id: c.id,
        label: c.title,
        subtitle: c.description ?? undefined,
      })),
      "challenge"
    );
  }

  if (Platform.OS === "web" && !visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {post ? (
            <Text style={styles.previewHint} numberOfLines={2}>
              Sharing {post.author?.display_name ? `${post.author.display_name}'s post` : "this post"}
            </Text>
          ) : null}
          {content}
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
  previewHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  title: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  back: { ...typography.bodySmall, color: colors.accent, fontWeight: "600" },
  pickerTitle: { ...typography.body, fontWeight: "600", color: colors.text, flex: 1 },
  option: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "center",
  },
  optionText: { ...typography.body, fontWeight: "600", color: colors.text },
  cancelOption: { backgroundColor: colors.surfaceElevated },
  cancelText: { ...typography.body, fontWeight: "600", color: colors.textSecondary },
  list: { maxHeight: 320 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { ...typography.body, fontWeight: "600", color: colors.text },
  rowSubtitle: { ...typography.caption, color: colors.textMuted },
  empty: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: "center",
    padding: spacing.xl,
  },
  loader: { padding: spacing.xl },
  sharingOverlay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  sharingText: { ...typography.bodySmall, color: colors.textSecondary },
});
