import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, overlays, spacing, typography } from "@frennix/ui";

interface StoryReplyBarProps {
  disabled?: boolean;
  onSend: (text: string) => void | Promise<void>;
}

export function StoryReplyBar({ disabled, onSend }: StoryReplyBarProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSend(trimmed);
      setText("");
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Reply privately…"
        placeholderTextColor={overlays.whiteDim}
        style={styles.input}
        editable={!disabled && !sending}
        returnKeyType="send"
        onSubmitEditing={() => void handleSend()}
        accessibilityLabel="Story reply"
      />
      <Pressable
        style={[styles.sendButton, (!text.trim() || disabled || sending) && styles.sendDisabled]}
        disabled={!text.trim() || disabled || sending}
        onPress={() => void handleSend()}
        accessibilityRole="button"
        accessibilityLabel="Send story reply"
      >
        {sending ? (
          <ActivityIndicator color={colors.black} size="small" />
        ) : (
          <Text style={styles.sendText}>Send</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: overlays.glass,
    borderWidth: 1,
    borderColor: overlays.glassBorderStrong,
    ...typography.bodySmall,
    color: colors.text,
  },
  sendButton: {
    minWidth: 64,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
  },
  sendDisabled: {
    opacity: 0.45,
  },
  sendText: {
    ...typography.bodySmall,
    color: colors.black,
    fontWeight: "800",
  },
});
