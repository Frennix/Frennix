import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useIsFocused } from "@react-navigation/native";
import { Stack, useLocalSearchParams } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  getConversationProfiles,
  getMessages,
  getTrainerVerificationForUser,
  markMessagesAsRead,
  sendMessage,
  subscribeToMessages,
  subscribeToMessageReactions,
  subscribeToTyping,
  teardownTypingChannel,
} from "@frennix/api";
import type { Conversation, Message, Profile, TrainerVerificationLevel } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { useMessageReaction } from "@/lib/useMessageReaction";
import { useProfilesPresence } from "@/lib/useProfilesPresence";
import { ChatComposer, type ChatComposerHandle, type ChatSendPayload } from "@/components/ChatComposer";
import { ChatMessageRow } from "@/components/ChatMessageRow";
import { ImageLightbox } from "@/components/ImageLightbox";
import { TrainerBadge } from "@/components/TrainerBadge";
import { trackMessagingLoad } from "@/lib/product-analytics";
import { formatPresenceStatus, isProfileOnline, colors, spacing, typography } from "@frennix/ui";

const TYPING_HIDE_MS = 3000;

type ChatMessageListProps = {
  messages: Message[];
  userId: string;
  participantProfiles: Record<string, Pick<Profile, "avatar_url" | "display_name" | "is_online" | "last_seen_at">>;
  otherTyping: boolean;
  onMediaPress: (uri: string) => void;
  onReaction: (messageId: string, emoji: string, currentEmoji?: string | null) => void;
};

const ChatMessageList = memo(function ChatMessageList({
  messages,
  userId,
  participantProfiles,
  otherTyping,
  onMediaPress,
  onReaction,
}: ChatMessageListProps) {
  const listRef = useRef<FlatList>(null);
  const myProfile = participantProfiles[userId];

  const renderItem = useCallback(
    ({ item }: { item: Message }) => (
      <ChatMessageRow
        message={item}
        userId={userId}
        myProfile={myProfile}
        sender={participantProfiles[item.sender_id]}
        onMediaPress={onMediaPress}
        onReaction={onReaction}
      />
    ),
    [userId, myProfile, participantProfiles, onMediaPress, onReaction]
  );

  return (
    <FlatList
      ref={listRef}
      data={messages}
      keyExtractor={(m) => m.id}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      initialNumToRender={16}
      maxToRenderPerBatch={12}
      windowSize={9}
      removeClippedSubviews={Platform.OS !== "web"}
      onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      ListFooterComponent={
        otherTyping ? <Text style={styles.typing}>Typing...</Text> : null
      }
    />
  );
});

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? "";
  const chatReady = !loading && !!conversationId && !!userId;
  const [otherTyping, setOtherTyping] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [realtimeDegraded, setRealtimeDegraded] = useState(false);
  const queryClient = useQueryClient();
  const hideTypingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composerRef = useRef<ChatComposerHandle>(null);
  const messageReaction = useMessageReaction(userId);
  const messageReactionRef = useRef(messageReaction);
  messageReactionRef.current = messageReaction;
  const isFocused = useIsFocused();
  const messagingPerfTrackedRef = useRef(false);
  const messagingLoadStartedRef = useRef<number | null>(null);

  useEffect(() => {
    if (chatReady && conversationId) {
      messagingLoadStartedRef.current = performance.now();
      messagingPerfTrackedRef.current = false;
    }
  }, [chatReady, conversationId]);

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => getMessages(conversationId!, userId),
    enabled: chatReady && isFocused,
  });

  const { data: participantProfiles = {} } = useQuery({
    queryKey: ["conversation-profiles", conversationId],
    queryFn: () => getConversationProfiles(conversationId!),
    enabled: chatReady && isFocused,
  });

  const otherProfile = useMemo(() => {
    const otherId = Object.keys(participantProfiles).find((id) => id !== userId);
    return otherId ? participantProfiles[otherId] : undefined;
  }, [participantProfiles, userId]);

  const otherUserId = useMemo(() => {
    return Object.keys(participantProfiles).find((id) => id !== userId);
  }, [participantProfiles, userId]);

  const { data: otherTrainerLevel } = useQuery({
    queryKey: ["trainer-verification", otherUserId],
    queryFn: () => getTrainerVerificationForUser(otherUserId!),
    enabled: !!otherUserId,
  });

  const { realtimeUnavailable: presenceUnavailable } = useProfilesPresence(
    userId,
    otherProfile?.id ? [otherProfile.id] : []
  );

  useEffect(() => {
    if (
      !messagesLoading &&
      conversationId &&
      !messagingPerfTrackedRef.current &&
      messagingLoadStartedRef.current != null
    ) {
      trackMessagingLoad(
        performance.now() - messagingLoadStartedRef.current,
        conversationId,
        messages.length
      );
      messagingPerfTrackedRef.current = true;
    }
  }, [messagesLoading, conversationId, messages.length]);

  const headerPresence = otherProfile ? formatPresenceStatus(otherProfile) : null;
  const headerOnline = otherProfile ? isProfileOnline(otherProfile) : false;

  const markRead = useCallback(() => {
    if (!conversationId || !userId) return;
    void markMessagesAsRead(conversationId, userId).then(() => {
      const convUnread =
        queryClient
          .getQueryData<Conversation[]>(["conversations", userId])
          ?.find((c) => c.id === conversationId)?.unread_count ?? 0;

      queryClient.setQueryData<Conversation[]>(["conversations", userId], (old) => {
        if (!old) return old;
        return old.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c));
      });

      if (convUnread > 0) {
        queryClient.setQueryData<number>(["unread-messages", userId], (old = 0) =>
          Math.max(0, old - convUnread)
        );
      }
    });
  }, [conversationId, userId, queryClient]);

  useEffect(() => {
    if (!chatReady || !isFocused) return;

    markRead();

    let messagesSub: ReturnType<typeof subscribeToMessages> | null = null;
    let typingChannel: ReturnType<typeof subscribeToTyping> | null = null;
    let reactionsSub: ReturnType<typeof subscribeToMessageReactions> | null = null;
    let degraded = false;

    try {
      messagesSub = subscribeToMessages(conversationId!, (message) => {
        queryClient.setQueryData<Message[]>(["messages", conversationId], (old = []) => {
          if (old.some((m) => m.id === message.id)) return old;
          return [...old, message];
        });
        markRead();
      });

      typingChannel = subscribeToTyping(conversationId!, userId, () => {
        setOtherTyping(true);
        if (hideTypingRef.current) clearTimeout(hideTypingRef.current);
        hideTypingRef.current = setTimeout(() => setOtherTyping(false), TYPING_HIDE_MS);
      });

      reactionsSub = subscribeToMessageReactions(conversationId!, () => {
        void queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      });

      degraded = !messagesSub.ok || !typingChannel || !reactionsSub.ok;
    } catch (error) {
      console.warn("[chat] realtime subscription failed", error);
      degraded = true;
    }

    setRealtimeDegraded(degraded);

    return () => {
      messagesSub?.unsubscribe();
      teardownTypingChannel(conversationId!, typingChannel);
      reactionsSub?.unsubscribe();
      if (hideTypingRef.current) clearTimeout(hideTypingRef.current);
    };
  }, [chatReady, isFocused, conversationId, userId, queryClient, markRead]);

  const sendMutation = useMutation({
    mutationFn: (payload: ChatSendPayload) =>
      sendMessage(conversationId!, userId, payload.content, payload.mediaUrl),
    onSuccess: () => {
      composerRef.current?.clear();
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const sendMutationRef = useRef(sendMutation);
  sendMutationRef.current = sendMutation;

  const handleSend = useCallback((payload: ChatSendPayload) => {
    sendMutationRef.current.mutate(payload);
  }, []);

  const handleMediaPress = useCallback((uri: string) => {
    setPreviewUri(uri);
  }, []);

  const handleReaction = useCallback(
    (messageId: string, emoji: string, currentEmoji?: string | null) => {
      messageReactionRef.current.mutate({
        conversationId: conversationId!,
        messageId,
        emoji,
        currentEmoji,
      });
    },
    [conversationId]
  );

  if (loading || (chatReady && messagesLoading && messages.length === 0)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View style={styles.headerTitle}>
              <Text style={styles.headerName} numberOfLines={1}>
                {otherProfile?.display_name ?? "Chat"}
              </Text>
              {otherTrainerLevel && otherTrainerLevel !== "trainer" ? (
                <TrainerBadge level={otherTrainerLevel as TrainerVerificationLevel} compact />
              ) : null}
              {headerPresence ? (
                <Text
                  style={[styles.headerPresence, headerOnline && styles.headerPresenceOnline]}
                  numberOfLines={1}
                >
                  {headerPresence}
                </Text>
              ) : null}
            </View>
          ),
        }}
      />
      <ImageLightbox uri={previewUri} onClose={() => setPreviewUri(null)} />
      {realtimeDegraded || presenceUnavailable ? (
        <View style={styles.realtimeBanner}>
          <Text style={styles.realtimeBannerText}>
            Live updates are temporarily unavailable. You can still read and send messages.
          </Text>
        </View>
      ) : null}
      <View style={styles.listWrap}>
        <ChatMessageList
          messages={messages}
          userId={userId}
          participantProfiles={participantProfiles}
          otherTyping={otherTyping}
          onMediaPress={handleMediaPress}
          onReaction={handleReaction}
        />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <ChatComposer
          ref={composerRef}
          conversationId={conversationId!}
          userId={userId}
          onSend={handleSend}
          sending={sendMutation.isPending}
        />
      </KeyboardAvoidingView>
    </View>
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
  headerTitle: { alignItems: "center", maxWidth: 220 },
  headerName: { ...typography.body, fontWeight: "700", color: colors.text },
  headerPresence: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  headerPresenceOnline: { color: colors.accent, fontWeight: "600" },
  listWrap: { flex: 1 },
  list: { padding: spacing.md, flexGrow: 1 },
  typing: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: "italic",
    paddingVertical: spacing.xs,
  },
  realtimeBanner: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  realtimeBannerText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
