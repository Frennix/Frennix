import * as ImagePicker from "expo-image-picker";
import { forwardRef, memo, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInput as TextInputType,
} from "react-native";
import { broadcastTyping, uploadMessageMedia } from "@frennix/api";
import { colors, radius, spacing, typography } from "@frennix/ui";

const TYPING_DEBOUNCE_MS = 1500;

export type ChatReplyTarget = {
  id: string;
  content: string;
  senderName?: string;
};

export type ChatSendPayload = {
  content: string;
  mediaUrl?: string | null;
  replyToMessageId?: string | null;
};

type ChatComposerProps = {
  conversationId: string;
  userId: string;
  replyTo?: ChatReplyTarget | null;
  onClearReply?: () => void;
  onSend: (payload: ChatSendPayload) => void;
  sending: boolean;
};

export type ChatComposerHandle = {
  clear: () => void;
  focus: () => void;
};

type ChatSendButtonProps = {
  canSend: boolean;
  sending: boolean;
  onPress: () => void;
};

const ChatSendButton = memo(function ChatSendButton({ canSend, sending, onPress }: ChatSendButtonProps) {
  const disabled = !canSend || sending;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.sendButton,
        disabled && styles.sendButtonDisabled,
        pressed && !disabled && styles.sendButtonPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Send message"
    >
      {sending ? (
        <ActivityIndicator color={colors.black} size="small" />
      ) : (
        <Text style={styles.sendLabel}>Send</Text>
      )}
    </Pressable>
  );
});

export const ChatComposer = memo(
  forwardRef<ChatComposerHandle, ChatComposerProps>(function ChatComposer(
    { conversationId, userId, replyTo, onClearReply, onSend, sending },
    ref
  ) {
    const inputRef = useRef<TextInputType>(null);
    const textRef = useRef("");
    const canSendRef = useRef(false);
    const [canSend, setCanSend] = useState(false);
    const [sendingMedia, setSendingMedia] = useState(false);
    const onSendRef = useRef(onSend);
    const sendingRef = useRef(sending);
    const replyToRef = useRef(replyTo);

    onSendRef.current = onSend;
    sendingRef.current = sending;
    replyToRef.current = replyTo;

    const scheduleTypingRef = useRef<() => void>(() => undefined);

    useEffect(() => {
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      let lastBroadcast = 0;

      scheduleTypingRef.current = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          if (!textRef.current.trim()) return;

          const now = Date.now();
          if (now - lastBroadcast < TYPING_DEBOUNCE_MS) return;
          lastBroadcast = now;
          void broadcastTyping(conversationId, userId).catch(() => undefined);
        }, 300);
      };

      return () => {
        if (debounceTimer) clearTimeout(debounceTimer);
      };
    }, [conversationId, userId]);

    useEffect(() => {
      if (replyTo) {
        inputRef.current?.focus();
      }
    }, [replyTo?.id]);

    function syncCanSend(value: string) {
      const next = value.trim().length > 0;
      if (next === canSendRef.current) return;
      canSendRef.current = next;
      setCanSend(next);
    }

    function handleTextChange(value: string) {
      textRef.current = value;
      syncCanSend(value);
      scheduleTypingRef.current();
    }

    function handleSend() {
      const content = textRef.current.trim();
      if (!content || sendingRef.current) return;
      onSendRef.current({
        content,
        replyToMessageId: replyToRef.current?.id ?? null,
      });
    }

    useImperativeHandle(ref, () => ({
      clear: () => {
        textRef.current = "";
        inputRef.current?.clear();
        syncCanSend("");
      },
      focus: () => {
        inputRef.current?.focus();
      },
    }));

    async function pickAndSendMedia() {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled) return;

      setSendingMedia(true);
      try {
        const asset = result.assets[0];
        const mimeType = asset.mimeType ?? "image/jpeg";
        const mediaUrl = await uploadMessageMedia(userId, asset.uri, mimeType);
        onSendRef.current({
          content: textRef.current.trim(),
          mediaUrl,
          replyToMessageId: replyToRef.current?.id ?? null,
        });
      } finally {
        setSendingMedia(false);
      }
    }

    return (
      <View style={styles.wrapper}>
        {replyTo ? (
          <View style={styles.replyBanner}>
            <View style={styles.replyTextWrap}>
              <Text style={styles.replyLabel}>
                Replying to {replyTo.senderName ?? "message"}
              </Text>
              <Text style={styles.replyPreview} numberOfLines={1}>
                {replyTo.content}
              </Text>
            </View>
            <Pressable onPress={onClearReply} hitSlop={8} accessibilityLabel="Cancel reply">
              <Text style={styles.replyCancel}>✕</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.inputRow}>
          <Pressable
            onPress={pickAndSendMedia}
            disabled={sendingMedia || sending}
            style={styles.attach}
          >
            {sendingMedia ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <Text style={styles.attachIcon}>📷</Text>
            )}
          </Pressable>
          <TextInput
            ref={inputRef}
            defaultValue=""
            onChangeText={handleTextChange}
            placeholder={replyTo ? "Write a reply..." : "Message..."}
            placeholderTextColor={colors.textMuted}
            style={styles.textInput}
            autoCorrect
            autoCapitalize="sentences"
          />
          <ChatSendButton canSend={canSend} sending={sending} onPress={handleSend} />
        </View>
      </View>
    );
  })
);

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  replyTextWrap: { flex: 1, minWidth: 0 },
  replyLabel: { ...typography.caption, color: colors.accent, fontWeight: "700" },
  replyPreview: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  replyCancel: { ...typography.body, color: colors.textMuted, paddingHorizontal: spacing.xs },
  inputRow: {
    flexDirection: "row",
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: "flex-end",
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 16,
    minHeight: 48,
    maxHeight: 120,
  },
  attach: { paddingBottom: 10, paddingHorizontal: 4 },
  attachIcon: { fontSize: 22 },
  sendButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    minHeight: 48,
    minWidth: 64,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonPressed: { opacity: 0.85 },
  sendButtonDisabled: { opacity: 0.45 },
  sendLabel: { fontSize: 16, fontWeight: "600", color: colors.black },
});
