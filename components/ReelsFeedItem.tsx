import { Pressable, StyleSheet, Text, View } from "react-native";
import { Play } from "lucide-react-native";
import { getJourneyCategoryLabel, type Post } from "@frennix/types";
import { Avatar, ProgressiveImage, colors, radius, spacing, typography } from "@frennix/ui";

type ReelsFeedItemProps = {
  post: Post;
  onPress: () => void;
};

function resolvePreviewUri(post: Post): string | null {
  const displayPost = post.shared_post ?? post;
  return displayPost.thumbnail_url || null;
}

export function ReelsFeedItem({ post, onPress }: ReelsFeedItemProps) {
  const displayPost = post.shared_post ?? post;
  const author = post.author ?? displayPost.author;
  const previewUri = resolvePreviewUri(post);
  const categoryLabel = getJourneyCategoryLabel(
    displayPost.journey_category ?? post.journey_category
  );
  const authorName = author?.display_name ?? "Frennix member";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open Reel by ${authorName}`}
      style={styles.card}
    >
      <View style={styles.poster}>
        {previewUri ? (
          <ProgressiveImage
            uri={previewUri}
            style={styles.posterImage}
            contentFit="cover"
            accessibilityLabel={`${authorName} Reel preview`}
          />
        ) : (
          <View style={styles.posterFallback} accessibilityLabel={`${authorName} Reel`}>
            <Text style={styles.fallbackLabel}>Reel</Text>
          </View>
        )}
        <View style={styles.playBadge} accessibilityElementsHidden>
          <Play color={colors.white} size={22} strokeWidth={2.2} fill={colors.white} />
        </View>
      </View>
      <View style={styles.meta}>
        <Avatar uri={author?.avatar_url} name={authorName} size={36} />
        <View style={styles.metaText}>
          <Text style={styles.author} numberOfLines={1}>
            {authorName}
          </Text>
          {author?.username ? (
            <Text style={styles.username} numberOfLines={1}>
              @{author.username}
            </Text>
          ) : null}
          {categoryLabel ? (
            <Text
              style={styles.category}
              numberOfLines={1}
              accessibilityLabel={`Journey category ${categoryLabel}`}
            >
              {categoryLabel}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  poster: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  posterImage: {
    width: "100%",
    height: "100%",
  },
  posterFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  fallbackLabel: {
    ...typography.heading,
    color: colors.textMuted,
  },
  playBadge: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 56,
    height: 56,
    marginTop: -28,
    marginLeft: -28,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10, 10, 11, 0.62)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.7)",
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: 2,
  },
  metaText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  author: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "700",
  },
  username: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  category: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "700",
  },
});
