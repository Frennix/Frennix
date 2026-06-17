import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  broadcastTyping,
  getConversationProfiles,
  getMessages,
  markMessagesAsRead,
  sendMessage,
  subscribeToMessages,
  subscribeToMessageReactions,
  subscribeToTyping,
  uploadMessageMedia,
} from "@frennix/api";
import type { Message } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { useMessageReaction } from "@/lib/useMessageReaction";
import { ImageLightbox } from "@/components/ImageLightbox";
import { Button, Input, MessageBubble, colors, spacing, typography } from "@frennix/ui";

const TYPING_DEBOUNCE_MS = 1500;
const TYPING_HIDE_MS = 3000;

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? "";
  const chatReady = !loading && !!conversationId && !!userId;
  const [text, setText] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTypingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingBroadcastRef = useRef(0);

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => getMessages(conversationId!, userId),
    enabled: chatReady,
  });

  const messageReaction = useMessageReaction(userId);

  const { data: participantProfiles = {} } = useQuery({
    queryKey: ["conversation-profiles", conversationId],
    queryFn: () => getConversationProfiles(conversationId!),
    enabled: chatReady,
  });

  const myProfile = participantProfiles[userId];

  const markRead = useCallback(() => {
    if (!conversationId || !userId) return;
    markMessagesAsRead(conversationId, userId).then(() => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["unread-messages"] });
    });
  }, [conversationId, userId, queryClient]);

  useEffect(() => {
    if (!chatReady) return;

    markRead();

    const channel = subscribeToMessages(conversationId, () => {
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      markRead();
    });

    const typingChannel = subscribeToTyping(conversationId, userId, () => {
      setOtherTyping(true);
      if (hideTypingRef.current) clearTimeout(hideTypingRef.current);
      hideTypingRef.current = setTimeout(() => setOtherTyping(false), TYPING_HIDE_MS);
    });

    const reactionsChannel = subscribeToMessageReactions(() => {
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    });

    return () => {
      channel.unsubscribe();
      typingChannel.unsubscribe();
      reactionsChannel.unsubscribe();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (hideTypingRef.current) clearTimeout(hideTypingRef.current);
    };
  }, [chatReady, conversationId, userId, queryClient, markRead]);

  const sendMutation = useMutation({
    mutationFn: (payload: { content: string; mediaUrl?: string | null }) =>
      sendMessage(conversationId!, userId, payload.content, payload.mediaUrl),
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  function handleTextChange(value: string) {
    setText(value);

    if (!conversationId || !userId || !value.trim()) return;

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

  async function pickAndSendMedia() {
    if (!session?.user.id || !conversationId) return;

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
      const mediaUrl = await uploadMessageMedia(session.user.id, asset.uri, mimeType);
      await sendMutation.mutateAsync({ content: text.trim(), mediaUrl });
      setText("");
    } finally {
      setSendingMedia(false);
    }
  }

  function renderItem({ item }: { item: Message }) {
    const isOwn = item.sender_id === userId;
    const sender = participantProfiles[item.sender_id];
    const time = new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const sharedPostId = item.shared_post?.id ?? item.post_id;
    return (
      <MessageBubble
        content={item.content}
        isOwn={isOwn}
        timestamp={time}
        mediaUrl={item.media_url}
        sharedPost={item.shared_post}
        onSharedPostPress={
          sharedPostId ? () => router.push(`/post/${sharedPostId}`) : undefined
        }
        onMediaPress={item.media_url ? () => setPreviewUri(item.media_url) : undefined}
        reactions={item.reactions}
        onReaction={(emoji) =>
          messageReaction.mutate({
            conversationId: conversationId!,
            messageId: item.id,
            emoji,
            currentEmoji: item.my_reaction,
          })
        }
        senderAvatarUrl={isOwn ? myProfile?.avatar_url : sender?.avatar_url}
        senderName={isOwn ? myProfile?.display_name : sender?.display_name}
      />
    );
  }

  if (loading || (chatReady && messagesLoading && messages.length === 0)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <ImageLightbox uri={previewUri} onClose={() => setPreviewUri(null)} />
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={
          otherTyping ? (
            <Text style={styles.typing}>Typing...</Text>
          ) : null
        }
      />
      <View style={styles.inputRow}>
        <Pressable onPress={pickAndSendMedia} disabled={sendingMedia} style={styles.attach}>
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
        <Button
          title="Send"
          onPress={() => sendMutation.mutate({ content: text.trim() })}
          loading={sendMutation.isPending}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, flexGrow: 1 },
  typing: { ...typography.caption, color: colors.textMuted, fontStyle: "italic", paddingVertical: spacing.xs },
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
