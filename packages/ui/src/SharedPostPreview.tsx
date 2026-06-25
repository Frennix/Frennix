import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Post, Profile } from "@frennix/types";
import { Avatar } from "./Avatar";
import { PostMedia } from "./PostMedia";
import { colors, radius, spacing, typography } from "./theme";

interface SharedPostPreviewProps {
  post: Post & { author?: Profile };
  onPress?: () => void;
  compact?: boolean;
  onMediaPress?: (uri: string) => void;
}

export function SharedPostPreview({
  post,
  onPress,
  compact,
  onMediaPress,
}: SharedPostPreviewProps) {
  const author = post.author;
  const hasMedia = Boolean(post.media_urls?.[0]);

  return (
    <Pressable
      style={[styles.card, compact && styles.cardCompact]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.header}>
        <Avatar uri={author?.avatar_url} name={author?.display_name} size={compact ? 28 : 32} />
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {author?.display_name ?? "Unknown"}
          </Text>
          <Text style={styles.label}>Original post</Text>
        </View>
      </View>

      {post.content ? (
        <Text style={styles.content} numberOfLines={compact ? 2 : 4}>
          {post.content}
        </Text>
      ) : null}

      {hasMedia ? (
        <View style={styles.mediaWrap}>
          <PostMedia
            uri={post.media_urls![0]}
            postType={post.post_type}
            thumbnailUrl={post.thumbnail_url}
            maxHeight={compact ? 220 : undefined}
            onImagePress={
              onMediaPress ? () => onMediaPress(post.media_urls![0]) : undefined
            }
          />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  cardCompact: {
    padding: spacing.xs,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerText: { flex: 1, gap: 1 },
  name: { ...typography.bodySmall, fontWeight: "600", color: colors.text },
  label: { ...typography.caption, color: colors.textMuted },
  content: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },
  mediaWrap: {
    borderRadius: radius.sm,
    overflow: "hidden",
  },
});

export function getSharedPostTargetId(post: Post): string {
  return post.shared_post?.id ?? post.shared_post_id ?? post.id;
}
