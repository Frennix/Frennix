import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Input, colors, radius, spacing, typography } from "@frennix/ui";

interface CommentEditSheetProps {
  visible: boolean;
  initialContent: string;
  loading?: boolean;
  onClose: () => void;
  onSave: (content: string) => void;
}

export function CommentEditSheet({
  visible,
  initialContent,
  loading = false,
  onClose,
  onSave,
}: CommentEditSheetProps) {
  const [content, setContent] = useState(initialContent);

  useEffect(() => {
    if (visible) setContent(initialContent);
  }, [visible, initialContent]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Edit comment</Text>
          <Input
            value={content}
            onChangeText={setContent}
            multiline
            placeholder="Write a comment…"
            editable={!loading}
          />
          <View style={styles.actions}>
            <Button title="Cancel" variant="secondary" onPress={onClose} disabled={loading} />
            <Button
              title="Save"
              onPress={() => onSave(content)}
              loading={loading}
              disabled={!content.trim() || loading}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 10, 11, 0.72)",
    justifyContent: "center",
    padding: spacing.md,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  title: { ...typography.body, fontWeight: "700", color: colors.text, textAlign: "center" },
  actions: { flexDirection: "row", gap: spacing.sm },
});
