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
import { colors, radius, spacing } from "@frennix/ui";

const TYPING_DEBOUNCE_MS = 1500;

export type ChatSendPayload = {
  content: string;
  mediaUrl?: string | null;
};

type ChatComposerProps = {
  conversationId: string;
  userId: string;
  onSend: (payload: ChatSendPayload) => void;
  sending: boolean;
};

export type ChatComposerHandle = {
  clear: () => void;
};

type ChatSendButtonProps = {
  canSend: boolean;
  sending: boolean;
  onPress: () => void;
};

/** Isolated from the text field — only re-renders when empty↔non-empty or sending changes. */
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
    { conversationId, userId, onSend, sending },
    ref
  ) {
    const inputRef = useRef<TextInputType>(null);
    const textRef = useRef("");
    const canSendRef = useRef(false);
    const [canSend, setCanSend] = useState(false);
    const [sendingMedia, setSendingMedia] = useState(false);
    const onSendRef = useRef(onSend);
    const sendingRef = useRef(sending);

    onSendRef.current = onSend;
    sendingRef.current = sending;

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
      onSendRef.current({ content });
    }

    useImperativeHandle(ref, () => ({
      clear: () => {
        textRef.current = "";
        inputRef.current?.clear();
        syncCanSend("");
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
        onSendRef.current({ content: textRef.current.trim(), mediaUrl });
      } finally {
        setSendingMedia(false);
      }
    }

    return (
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
          placeholder="Message..."
          placeholderTextColor={colors.textMuted}
          style={styles.textInput}
          autoCorrect
          autoCapitalize="sentences"
        />
        <ChatSendButton canSend={canSend} sending={sending} onPress={handleSend} />
      </View>
    );
  })
);

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: "row",
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
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
