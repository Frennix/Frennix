import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Post, Profile } from "@frennix/types";
import { Avatar } from "./Avatar";
import { CachedImage } from "./CachedImage";
import { ReactionBar } from "./ReactionBar";
import { ReactionPicker } from "./ReactionPicker";
import { SharedPostPreview } from "./SharedPostPreview";
import { colors, radius, spacing, typography } from "./theme";

interface MessageBubbleProps {
  content: string;
  isOwn: boolean;
  timestamp?: string;
  mediaUrl?: string | null;
  sharedPost?: (Post & { author?: Profile }) | null;
  reactions?: Post["reactions"];
  onMediaPress?: () => void;
  onSharedPostPress?: () => void;
  onReaction?: (emoji: string) => void;
  senderAvatarUrl?: string | null;
  senderName?: string;
  showAvatar?: boolean;
}

export function MessageBubble({
  content,
  isOwn,
  timestamp,
  mediaUrl,
  sharedPost,
  reactions,
  onMediaPress,
  onSharedPostPress,
  onReaction,
  senderAvatarUrl,
  senderName,
  showAvatar = true,
}: MessageBubbleProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const showText =
    content && content !== "📷 Photo" && content !== "Shared a post" && !sharedPost;

  return (
    <View style={[styles.wrapper, isOwn && styles.wrapperOwn]}>
      {showAvatar ? (
        <Avatar uri={senderAvatarUrl} name={senderName} size={32} />
      ) : null}
      <View style={styles.messageColumn}>
        <Pressable
          onLongPress={onReaction ? () => setPickerOpen(true) : undefined}
          delayLongPress={350}
        >
          <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
            {sharedPost ? (
              <SharedPostPreview post={sharedPost} onPress={onSharedPostPress} compact />
            ) : null}
            {mediaUrl ? (
              <Pressable
                onPress={onMediaPress}
                disabled={!onMediaPress}
                accessibilityRole="button"
                accessibilityLabel="View image full screen"
                style={({ pressed }) => [pressed && onMediaPress ? styles.mediaPressed : null]}
              >
                <CachedImage uri={mediaUrl} style={styles.media} contentFit="cover" recyclingKey={`msg-${mediaUrl}`} />
              </Pressable>
            ) : null}
            {showText ? (
              <Text
                style={[
                  styles.text,
                  isOwn && styles.textOwn,
                  (mediaUrl || sharedPost) && styles.textWithMedia,
                ]}
              >
                {content}
              </Text>
            ) : null}
          </View>
        </Pressable>

        <ReactionBar
          reactions={reactions}
          onReactionPress={onReaction}
          onAddReaction={onReaction ? () => setPickerOpen(true) : undefined}
          compact
        />

        {timestamp ? <Text style={styles.time}>{timestamp}</Text> : null}
      </View>

      {onReaction ? (
        <ReactionPicker
          visible={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={(emoji) => {
            setPickerOpen(false);
            onReaction(emoji);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginVertical: spacing.xs,
    maxWidth: "85%",
    gap: spacing.sm,
  },
  wrapperOwn: { alignSelf: "flex-end", flexDirection: "row-reverse" },
  messageColumn: { flexShrink: 1, maxWidth: "100%" },
  bubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  bubbleOwn: { backgroundColor: colors.accent },
  bubbleOther: { backgroundColor: colors.surfaceElevated },
  text: { ...typography.body, color: colors.text },
  textOwn: { color: colors.black },
  textWithMedia: { marginTop: spacing.xs },
  media: { width: 200, height: 200, borderRadius: radius.md },
  mediaPressed: { opacity: 0.85 },
  time: { ...typography.caption, marginTop: 2 },
});
