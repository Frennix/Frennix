import { router } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet } from "react-native";
import { getVisibleStory, isPrivateStoryMediaUrl, resolveStoryMediaUrl } from "@frennix/api";
import {
  formatStoryReactionDisplay,
  parseStoryReactionMessage,
  type Message,
  type Profile,
} from "@frennix/types";
import { AnimatedDismissRow } from "@/components/AnimatedDismissRow";
import { MessageActionsMenu } from "@/components/MessageActionsMenu";
import { SwipeToDeleteRow } from "@/components/SwipeToDeleteRow";
import { MessageBubble } from "@frennix/ui";

type ChatMessageRowProps = {
  message: Message;
  userId: string;
  myProfile?: Profile;
  sender?: Profile;
  participantProfiles?: Record<string, Pick<Profile, "display_name">>;
  dismissing?: boolean;
  onMediaPress: (uri: string) => void;
  onReaction: (messageId: string, emoji: string, currentEmoji?: string | null) => void;
  onLongPressMenu: (message: Message) => void;
  onDelete: (message: Message) => void;
};

function reactionsEqual(a: Message["reactions"], b: Message["reactions"]) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function rowPropsEqual(prev: ChatMessageRowProps, next: ChatMessageRowProps) {
  const a = prev.message;
  const b = next.message;

  return (
    prev.userId === next.userId &&
    prev.myProfile?.avatar_url === next.myProfile?.avatar_url &&
    prev.myProfile?.display_name === next.myProfile?.display_name &&
    prev.sender?.avatar_url === next.sender?.avatar_url &&
    prev.sender?.display_name === next.sender?.display_name &&
    prev.dismissing === next.dismissing &&
    a.id === b.id &&
    a.content === b.content &&
    a.media_url === b.media_url &&
    a.my_reaction === b.my_reaction &&
    a.created_at === b.created_at &&
    a.deleted_for_everyone_at === b.deleted_for_everyone_at &&
    reactionsEqual(a.reactions, b.reactions) &&
    a.shared_post?.id === b.shared_post?.id &&
    a.reply_to_message_id === b.reply_to_message_id &&
    a.story_reply_id === b.story_reply_id &&
    a.reply_to?.content === b.reply_to?.content
  );
}

export const ChatMessageRow = memo(function ChatMessageRow({
  message,
  userId,
  myProfile,
  sender,
  participantProfiles,
  dismissing = false,
  onMediaPress,
  onReaction,
  onLongPressMenu,
  onDelete,
}: ChatMessageRowProps) {
  const isOwn = message.sender_id === userId;
  const deletedForEveryone = Boolean(message.deleted_for_everyone_at);
  const time = useMemo(
    () => new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    [message.created_at]
  );
  const sharedPostId = message.shared_post?.id ?? message.post_id;

  const storyReaction = useMemo(
    () => (deletedForEveryone ? null : parseStoryReactionMessage(message.content)),
    [deletedForEveryone, message.content]
  );
  const ownerName = useMemo(() => {
    const other = Object.entries(participantProfiles ?? {}).find(([id]) => id !== userId);
    return other?.[1]?.display_name ?? null;
  }, [participantProfiles, userId]);
  const displayContent = storyReaction
    ? formatStoryReactionDisplay({
        emoji: storyReaction.emoji,
        isOwn,
        senderName: sender?.display_name ?? myProfile?.display_name,
        ownerName,
      })
    : message.content;
  const [storyPreviewUrl, setStoryPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!storyReaction || !message.media_url) {
      setStoryPreviewUrl(null);
      return;
    }
    if (!isPrivateStoryMediaUrl(message.media_url)) {
      setStoryPreviewUrl(message.media_url);
      return;
    }
    let cancelled = false;
    void resolveStoryMediaUrl(message.media_url).then((url) => {
      if (!cancelled) setStoryPreviewUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [message.media_url, storyReaction]);

  const handleSharedPostPress = useCallback(() => {
    if (sharedPostId) router.push(`/post/${sharedPostId}`);
  }, [sharedPostId]);

  const handleMediaPress = useCallback(() => {
    if (message.media_url) onMediaPress(message.media_url);
  }, [message.media_url, onMediaPress]);

  const handleStoryPreviewPress = useCallback(async () => {
    const storyId = message.story_reply_id;
    if (storyId) {
      try {
        const story = await getVisibleStory(storyId);
        if (!story || new Date(story.expires_at).getTime() <= Date.now()) {
          Alert.alert("Story expired");
          return;
        }
      } catch {
        Alert.alert("Story expired");
        return;
      }
    } else if (!storyPreviewUrl) {
      Alert.alert("Story expired");
      return;
    }
    if (storyPreviewUrl) onMediaPress(storyPreviewUrl);
  }, [message.story_reply_id, onMediaPress, storyPreviewUrl]);

  const handleReaction = useCallback(
    (emoji: string) => onReaction(message.id, emoji, message.my_reaction),
    [message.id, message.my_reaction, onReaction]
  );

  const handleLongPressMenu = useCallback(
    () => onLongPressMenu(message),
    [message, onLongPressMenu]
  );

  const handleDelete = useCallback(() => onDelete(message), [message, onDelete]);

  const isWeb = Platform.OS === "web";
  const replyToPreview = useMemo(() => {
    if (!message.reply_to) return null;
    const replySenderId = message.reply_to.sender_id;
    const replySenderName =
      replySenderId === userId
        ? myProfile?.display_name ?? "You"
        : participantProfiles?.[replySenderId]?.display_name ?? sender?.display_name ?? "Partner";
    return {
      content: message.reply_to.content,
      senderName: replySenderName,
    };
  }, [
    message.reply_to,
    myProfile?.display_name,
    participantProfiles,
    sender?.display_name,
    userId,
  ]);

  const rowContent = (
    <Pressable
      style={[styles.row, isOwn && styles.rowOwn]}
      {...(isWeb
        ? ({
            onContextMenu: (event: { preventDefault?: () => void }) => {
              event.preventDefault?.();
              handleLongPressMenu();
            },
          } as object)
        : null)}
    >
      {isOwn || isWeb ? <MessageActionsMenu onPress={handleLongPressMenu} /> : null}
      <MessageBubble
        content={displayContent}
        isOwn={isOwn}
        timestamp={time}
        mediaUrl={storyReaction ? storyPreviewUrl : message.media_url}
        sharedPost={message.shared_post}
        storyReply={!storyReaction && Boolean(message.story_reply_id)}
        storyReaction={Boolean(storyReaction)}
        replyTo={replyToPreview}
        deletedForEveryone={deletedForEveryone}
        onSharedPostPress={sharedPostId ? handleSharedPostPress : undefined}
        onMediaPress={
          storyReaction
            ? handleStoryPreviewPress
            : message.media_url
              ? handleMediaPress
              : undefined
        }
        reactions={message.reactions}
        onReaction={handleReaction}
        onLongPressMenu={handleLongPressMenu}
        senderAvatarUrl={isOwn ? myProfile?.avatar_url : sender?.avatar_url}
        senderName={isOwn ? myProfile?.display_name : sender?.display_name}
      />
    </Pressable>
  );

  return (
    <AnimatedDismissRow dismissing={dismissing}>
      <SwipeToDeleteRow
        enabled={!deletedForEveryone}
        onDelete={handleDelete}
        actionLabel="Delete"
      >
        {rowContent}
      </SwipeToDeleteRow>
    </AnimatedDismissRow>
  );
}, rowPropsEqual);

const styles = StyleSheet.create({
  row: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
  },
  rowOwn: {
    justifyContent: "flex-end",
  },
});
