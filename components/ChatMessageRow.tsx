import { router } from "expo-router";
import { memo, useCallback, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet } from "react-native";
import type { Message, Profile } from "@frennix/types";
import { AnimatedDismissRow } from "@/components/AnimatedDismissRow";
import { MessageActionsMenu } from "@/components/MessageActionsMenu";
import { SwipeToDeleteRow } from "@/components/SwipeToDeleteRow";
import { usePrefersCoarsePointer } from "@/lib/usePrefersCoarsePointer";
import { MessageBubble } from "@frennix/ui";

type ChatMessageRowProps = {
  message: Message;
  userId: string;
  myProfile?: Profile;
  sender?: Profile;
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
    reactionsEqual(a.reactions, b.reactions) &&
    a.shared_post?.id === b.shared_post?.id
  );
}

export const ChatMessageRow = memo(function ChatMessageRow({
  message,
  userId,
  myProfile,
  sender,
  dismissing = false,
  onMediaPress,
  onReaction,
  onLongPressMenu,
  onDelete,
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

  const handleLongPressMenu = useCallback(
    () => onLongPressMenu(message),
    [message, onLongPressMenu]
  );

  const handleDelete = useCallback(() => onDelete(message), [message, onDelete]);

  const [hovered, setHovered] = useState(false);
  const [tapped, setTapped] = useState(false);
  const prefersCoarsePointer = usePrefersCoarsePointer();
  const isWeb = Platform.OS === "web";

  const showActionsMenu =
    isOwn &&
    (isWeb
      ? prefersCoarsePointer || hovered || tapped
      : true);

  const handleOwnMessagePress = useCallback(() => {
    if (!isOwn || !isWeb || prefersCoarsePointer) return;
    setTapped((value) => !value);
  }, [isOwn, isWeb, prefersCoarsePointer]);

  const handleOpenMenu = useCallback(() => {
    setTapped(false);
    handleLongPressMenu();
  }, [handleLongPressMenu]);

  const rowContent = (
    <Pressable
      style={[styles.row, isOwn && styles.rowOwn]}
      onPress={handleOwnMessagePress}
      onHoverIn={isWeb && isOwn ? () => setHovered(true) : undefined}
      onHoverOut={isWeb && isOwn ? () => setHovered(false) : undefined}
      {...(isWeb && isOwn
        ? ({
            onContextMenu: (event: { preventDefault?: () => void }) => {
              event.preventDefault?.();
              handleOpenMenu();
            },
          } as object)
        : null)}
    >
      {isOwn ? <MessageActionsMenu visible={showActionsMenu} onPress={handleOpenMenu} /> : null}
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
        onLongPressMenu={handleLongPressMenu}
        senderAvatarUrl={isOwn ? myProfile?.avatar_url : sender?.avatar_url}
        senderName={isOwn ? myProfile?.display_name : sender?.display_name}
      />
    </Pressable>
  );

  return (
    <AnimatedDismissRow dismissing={dismissing}>
      <SwipeToDeleteRow enabled={isOwn} onDelete={handleDelete}>
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
