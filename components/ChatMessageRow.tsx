import { router } from "expo-router";
import { memo, useCallback, useMemo } from "react";
import type { Message, Profile } from "@frennix/types";
import { MessageBubble } from "@frennix/ui";

type ChatMessageRowProps = {
  message: Message;
  userId: string;
  myProfile?: Profile;
  sender?: Profile;
  onMediaPress: (uri: string) => void;
  onReaction: (messageId: string, emoji: string, currentEmoji?: string | null) => void;
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
    a.id === b.id &&
    a.content === b.content &&
    a.media_url === b.media_url &&
    a.my_reaction === b.my_reaction &&
    a.created_at === b.created_at &&
    reactionsEqual(a.reactions, b.reactions) &&
    a.shared_post?.id === b.shared_post?.id
  );
}

export const ChatMessageRow = memo(function ChatMessageRow({
  message,
  userId,
  myProfile,
  sender,
  onMediaPress,
  onReaction,
}: ChatMessageRowProps) {
  const isOwn = message.sender_id === userId;
  const time = useMemo(
    () => new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    [message.created_at]
  );
  const sharedPostId = message.shared_post?.id ?? message.post_id;

  const handleSharedPostPress = useCallback(() => {
    if (sharedPostId) router.push(`/post/${sharedPostId}`);
  }, [sharedPostId]);

  const handleMediaPress = useCallback(() => {
    if (message.media_url) onMediaPress(message.media_url);
  }, [message.media_url, onMediaPress]);

  const handleReaction = useCallback(
    (emoji: string) => onReaction(message.id, emoji, message.my_reaction),
    [message.id, message.my_reaction, onReaction]
  );

  return (
    <MessageBubble
      content={message.content}
      isOwn={isOwn}
      timestamp={time}
      mediaUrl={message.media_url}
      sharedPost={message.shared_post}
      onSharedPostPress={sharedPostId ? handleSharedPostPress : undefined}
      onMediaPress={message.media_url ? handleMediaPress : undefined}
      reactions={message.reactions}
      onReaction={handleReaction}
      senderAvatarUrl={isOwn ? myProfile?.avatar_url : sender?.avatar_url}
      senderName={isOwn ? myProfile?.display_name : sender?.display_name}
    />
  );
}, rowPropsEqual);
