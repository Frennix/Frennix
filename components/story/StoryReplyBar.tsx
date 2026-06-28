import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, overlays, radius, spacing, touchTarget, typography } from "@frennix/ui";

interface StoryReplyBarProps {
  disabled?: boolean;
  compact?: boolean;
  onSend: (text: string) => void | Promise<void>;
  onFocusChange?: (focused: boolean) => void;
  onCancel?: () => void;
}

export function StoryReplyBar({
  disabled,
  compact,
  onSend,
  onFocusChange,
  onCancel,
}: StoryReplyBarProps) {
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
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {onCancel ? (
        <Pressable
          style={styles.cancelButton}
          onPress={onCancel}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close reply"
        >
          <Text style={styles.cancelText}>✕</Text>
        </Pressable>
      ) : null}
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Reply privately…"
        placeholderTextColor={overlays.whiteDim}
        style={[styles.input, compact && styles.inputCompact]}
        editable={!disabled && !sending}
        returnKeyType="send"
        onSubmitEditing={() => void handleSend()}
        onFocus={() => onFocusChange?.(true)}
        onBlur={() => onFocusChange?.(false)}
        accessibilityLabel="Story reply"
      />
      <Pressable
        style={[
          styles.sendButton,
          compact && styles.sendButtonCompact,
          (!text.trim() || disabled || sending) && styles.sendDisabled,
        ]}
        disabled={!text.trim() || disabled || sending}
        onPress={() => void handleSend()}
        accessibilityRole="button"
        accessibilityLabel="Send story reply"
      >
        {sending ? (
          <ActivityIndicator color={colors.black} size="small" />
        ) : (
          <Text style={styles.sendText}>{compact ? "↑" : "Send"}</Text>
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
  wrapCompact: {
    gap: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: "rgba(10, 10, 11, 0.88)",
    borderWidth: 1,
    borderColor: overlays.glassBorder,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  cancelButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
    backgroundColor: overlays.glass,
  },
  cancelText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 18,
    fontWeight: "700",
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
  inputCompact: {
    minHeight: 40,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
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
  sendButtonCompact: {
    minWidth: touchTarget,
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.full,
    paddingHorizontal: 0,
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
