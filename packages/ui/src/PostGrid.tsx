import { Dimensions, StyleSheet, Text, View } from "react-native";
import type { Post } from "@frennix/types";
import { normalizeWorkoutTypes } from "@frennix/types";
import { ProgressiveImage } from "./ProgressiveImage";
import { ScalePressable } from "./ScalePressable";
import { isVideoMedia } from "./PostMedia";
import { VideoPreview } from "./VideoPreview";
import { WorkoutTypeChips } from "./WorkoutTypeChips";
import { colors, radius, spacing, typography } from "./theme";

interface PostGridProps {
  posts: Post[];
  onPressPost: (postId: string) => void;
  currentUserId?: string;
  onOwnerActionsPress?: (post: Post) => void;
  fullWidth?: boolean;
  emptyLabel?: string;
}

const GAP = 2;
const COLS = 3;

export function PostGrid({
  posts,
  onPressPost,
  currentUserId,
  onOwnerActionsPress,
  fullWidth,
  emptyLabel = "No posts yet",
}: PostGridProps) {
  const width = fullWidth ? Dimensions.get("window").width : Dimensions.get("window").width - spacing.md * 2;
  const cellSize = (width - GAP * (COLS - 1)) / COLS;

  if (!posts.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {posts.map((post) => {
        const isOwn = Boolean(currentUserId && post.author_id === currentUserId);
        const hasMedia = Boolean(post.media_urls?.[0]);
        const workoutTypes = normalizeWorkoutTypes(post);

        return (
        <ScalePressable
          key={post.id}
          containerStyle={[styles.cell, { width: cellSize, height: cellSize }]}
          onPress={() => onPressPost(post.id)}
          onLongPress={
            isOwn && onOwnerActionsPress ? () => onOwnerActionsPress(post) : undefined
          }
          delayLongPress={400}
        >
          {post.media_urls?.[0] ? (
            <View style={styles.mediaCell}>
              {isVideoMedia(post.post_type, post.media_urls[0]) ? (
                <VideoPreview
                  videoUri={post.media_urls[0]}
                  thumbnailUrl={post.thumbnail_url}
                  compact
                />
              ) : (
                <ProgressiveImage
                  uri={post.media_urls[0]}
                  placeholderUri={post.thumbnail_url}
                  style={styles.image}
                  contentFit="cover"
                  recyclingKey={`grid-${post.id}`}
                />
              )}
              {workoutTypes.length ? (
                <View style={styles.mediaChipOverlay} pointerEvents="none">
                  <WorkoutTypeChips types={workoutTypes} maxVisible={2} size="compact" overlay />
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.placeholder}>
              {post.content ? (
                <Text style={styles.placeholderText} numberOfLines={3}>
                  {post.content}
                </Text>
              ) : null}
              {workoutTypes.length ? (
                <WorkoutTypeChips types={workoutTypes} maxVisible={3} size="compact" />
              ) : (
                !post.content ? <Text style={styles.placeholderText}>Post</Text> : null
              )}
            </View>
          )}
        </ScalePressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
  },
  cell: {
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: colors.surfaceElevated,
  },
  mediaCell: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  mediaChipOverlay: {
    position: "absolute",
    left: spacing.xs,
    right: spacing.xs,
    bottom: spacing.xs,
  },
  image: { width: "100%", height: "100%" },
  placeholder: {
    flex: 1,
    padding: spacing.xs,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  placeholderText: { ...typography.caption, textAlign: "center", fontSize: 11 },
  empty: { padding: spacing.xl, alignItems: "center" },
  emptyText: { ...typography.bodySmall, color: colors.textMuted },
});
