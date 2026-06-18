import * as ImagePicker from "expo-image-picker";
import { forwardRef, memo, useImperativeHandle, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { broadcastTyping, sendMessage, uploadMessageMedia } from "@frennix/api";
import { Button, Input, colors, spacing } from "@frennix/ui";

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

export const ChatComposer = memo(
  forwardRef<ChatComposerHandle, ChatComposerProps>(function ChatComposer(
    { conversationId, userId, onSend, sending },
    ref
  ) {
  const [text, setText] = useState("");
  const [sendingMedia, setSendingMedia] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingBroadcastRef = useRef(0);

  useImperativeHandle(ref, () => ({
    clear: () => setText(""),
  }));

  function handleTextChange(value: string) {
    setText(value);

    if (!value.trim()) return;

    const now = Date.now();
    if (now - lastTypingBroadcastRef.current > TYPING_DEBOUNCE_MS) {
      lastTypingBroadcastRef.current = now;
      broadcastTyping(conversationId, userId).catch(() => undefined);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      lastTypingBroadcastRef.current = 0;
    }, TYPING_DEBOUNCE_MS);
  }

  function handleSend() {
    const content = text.trim();
    if (!content || sending) return;
    onSend({ content });
  }

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
      onSend({ content: text.trim(), mediaUrl });
    } finally {
      setSendingMedia(false);
    }
  }

  return (
    <View style={styles.inputRow}>
      <Pressable onPress={pickAndSendMedia} disabled={sendingMedia || sending} style={styles.attach}>
        {sendingMedia ? (
          <ActivityIndicator color={colors.accent} size="small" />
        ) : (
          <Text style={styles.attachIcon}>📷</Text>
        )}
      </Pressable>
      <Input
        value={text}
        onChangeText={handleTextChange}
        placeholder="Message..."
        style={styles.input}
      />
      <Button title="Send" onPress={handleSend} loading={sending} disabled={!text.trim()} />
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
  },
  input: { flex: 1 },
  attach: { paddingBottom: 10, paddingHorizontal: 4 },
  attachIcon: { fontSize: 22 },
});
