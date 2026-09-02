import { useCallback, useRef, useState, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Heart,
  MessageCircle,
  MoreVertical,
  Share2,
  Volume2,
  VolumeX,
} from "lucide-react-native";
import type { PostMediaItem } from "@frennix/types";
import {
  Avatar,
  FullscreenVideoSlide,
  type FullscreenVideoSlideHandle,
  colors,
  spacing,
  touchTarget,
  typography,
} from "@frennix/ui";
import type { ImmersiveVideoGalleryContext } from "@/lib/immersive-video-gallery";
import type { FeedVideoFullscreenHandoff } from "@frennix/ui";

const STRONG_WORK_EMOJI = "💪";
const CAPTION_COLLAPSE_LINES = 2;

function formatActionCount(value?: number | null): string {
  const count = value ?? 0;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (count >= 10_000) return `${Math.round(count / 1000)}K`;
  if (count >= 1_000) return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(count);
}

type ImmersiveVideoViewerProps = {
  item: PostMediaItem;
  mediaIndex: number;
  stageWidth: number;
  stageHeight: number;
  isActive: boolean;
  playbackHandoff?: FeedVideoFullscreenHandoff;
  /** Dedicated /video route — decouple from feed autoplay coordinator. */
  routePlayback?: boolean;
  postActions: ImmersiveVideoGalleryContext["postActions"];
  onClose: () => void;
};

export function ImmersiveVideoViewer({
  item,
  mediaIndex,
  stageWidth,
  stageHeight,
  isActive,
  playbackHandoff,
  routePlayback = false,
  postActions,
  onClose,
}: ImmersiveVideoViewerProps) {
  const insets = useSafeAreaInsets();
  const videoRef = useRef<FullscreenVideoSlideHandle>(null);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [muted, setMuted] = useState(playbackHandoff?.muted ?? false);

  const post = postActions.post;
  const displayPost = post.shared_post ?? post;
  const author = post.author;
  const caption = (post.content ?? displayPost.content ?? "").trim();
  const liked = Boolean(post.liked_by_me);
  const respectActive = post.my_reaction === STRONG_WORK_EMOJI;

  const topInset = Math.max(insets.top, spacing.sm);
  const bottomInset = Math.max(insets.bottom, spacing.sm);

  const openComments = useCallback(
    (draft?: string) => {
      const snapshot = videoRef.current?.getPlaybackSnapshot();
      postActions.onComment(
        {
          mediaIndex,
          currentTime: snapshot?.currentTime ?? 0,
          muted: snapshot?.muted ?? muted,
          wasPlaying: snapshot?.wasPlaying ?? false,
          playbackId: playbackHandoff?.playbackId,
        },
        draft
      );
    },
    [mediaIndex, muted, playbackHandoff?.playbackId, postActions]
  );

  const toggleMute = useCallback(() => {
    videoRef.current?.toggleMute();
    setMuted(videoRef.current?.isMuted() ?? !muted);
  }, [muted]);

  const captionNeedsExpand = caption.length > 96;

  return (
    <View
      style={styles.root}
      {...(Platform.OS === "web"
        ? ({ nativeID: "frennix-immersive-video-viewer", "data-frennix-immersive-video-viewer": "true" } as object)
        : null)}
    >
      <FullscreenVideoSlide
        ref={videoRef}
        uri={item.url}
        thumbnailUrl={item.thumbnailUrl}
        stageWidth={stageWidth}
        stageHeight={stageHeight}
        isActive={isActive}
        playbackHandoff={playbackHandoff}
        immersiveMode
        routePlayback={routePlayback}
      />

      <View style={[styles.topBar, { paddingTop: topInset }]} pointerEvents="box-none">
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close video"
          style={styles.iconButton}
        >
          <Text style={styles.closeIcon}>✕</Text>
        </Pressable>

        <Pressable
          onPress={toggleMute}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={muted ? "Unmute video" : "Mute video"}
          style={styles.iconButton}
        >
          {muted ? (
            <VolumeX color="#FFFFFF" size={18} strokeWidth={2} />
          ) : (
            <Volume2 color="#FFFFFF" size={18} strokeWidth={2} />
          )}
        </Pressable>
      </View>

      <View
        style={[styles.actionRail, { bottom: bottomInset + 120 }]}
        pointerEvents="box-none"
        {...(Platform.OS === "web"
          ? ({ "data-frennix-immersive-rail": "true" } as object)
          : null)}
      >
        <RailAction
          label={liked ? "Unlike" : "Like"}
          onPress={postActions.onLike}
          active={liked}
        >
          <Heart
            color={liked ? colors.accent : "#FFFFFF"}
            size={26}
            strokeWidth={2}
            fill={liked ? colors.accent : "transparent"}
          />
          <Text style={styles.railCount}>{formatActionCount(post.like_count)}</Text>
        </RailAction>

        <RailAction
          label={respectActive ? "Remove Respect" : "Respect"}
          onPress={postActions.onRespect}
          active={respectActive}
        >
          <Text style={[styles.respectEmoji, respectActive && styles.railActive]}>
            {STRONG_WORK_EMOJI}
          </Text>
          <Text style={styles.railCount}>
            {formatActionCount(
              post.reactions?.find((r) => r.emoji === STRONG_WORK_EMOJI)?.count
            )}
          </Text>
        </RailAction>

        <RailAction label="Comment" onPress={() => openComments()}>
          <MessageCircle color="#FFFFFF" size={26} strokeWidth={2} />
          <Text style={styles.railCount}>{formatActionCount(post.comment_count)}</Text>
        </RailAction>

        <RailAction label="Share" onPress={postActions.onShare}>
          <Share2 color="#FFFFFF" size={24} strokeWidth={2} />
        </RailAction>

        <RailAction label="Post options" onPress={postActions.onMore}>
          <MoreVertical color="#FFFFFF" size={24} strokeWidth={2} />
        </RailAction>
      </View>

      <View style={[styles.bottomMeta, { paddingBottom: bottomInset + 58 }]} pointerEvents="box-none">
        <Pressable
          style={styles.authorRow}
          onPress={postActions.onAuthorPress}
          accessibilityRole="button"
          accessibilityLabel="View author profile"
        >
          <Avatar uri={author?.avatar_url} name={author?.display_name} size={36} />
          <View style={styles.authorTextCol}>
            <Text style={styles.authorName} numberOfLines={1}>
              {author?.display_name ?? "Unknown"}
            </Text>
            {author?.username ? (
              <Text style={styles.authorUsername} numberOfLines={1}>
                @{author.username}
              </Text>
            ) : null}
          </View>
          {postActions.showFollow && postActions.onFollow ? (
            <Pressable
              onPress={(event) => {
                event.stopPropagation?.();
                postActions.onFollow?.();
              }}
              style={styles.followButton}
              accessibilityRole="button"
              accessibilityLabel="Follow"
            >
              <Text style={styles.followLabel}>Follow</Text>
            </Pressable>
          ) : null}
        </Pressable>

        {caption ? (
          <View style={styles.captionBlock}>
            <Text
              style={styles.captionText}
              numberOfLines={captionExpanded ? undefined : CAPTION_COLLAPSE_LINES}
            >
              {caption}
            </Text>
            {captionNeedsExpand && !captionExpanded ? (
              <Pressable
                onPress={() => setCaptionExpanded(true)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Show more caption"
              >
                <Text style={styles.moreLabel}>more</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={[styles.commentComposerHost, { paddingBottom: bottomInset + spacing.sm }]}>
        <Pressable
          style={styles.commentComposerTrigger}
          onPress={() => openComments()}
          accessibilityRole="button"
          accessibilityLabel="Add a comment"
        >
          <Text style={styles.commentComposerPlaceholder}>Add a comment…</Text>
        </Pressable>
      </View>
    </View>
  );
}

function RailAction({
  label,
  onPress,
  active = false,
  children,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.railButton}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.black,
    overflow: "hidden",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
  },
  iconButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  closeIcon: {
    color: "#FFFFFF",
    fontSize: 17,
    lineHeight: 20,
    fontWeight: "600",
  },
  actionRail: {
    position: "absolute",
    right: spacing.sm,
    zIndex: 100,
    alignItems: "center",
    gap: spacing.md,
    ...(Platform.OS === "web"
      ? ({
          pointerEvents: "box-none",
        } as const)
      : null),
  },
  railButton: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: touchTarget,
    gap: 4,
    ...(Platform.OS === "web"
      ? ({
          pointerEvents: "auto",
          cursor: "pointer",
          zIndex: 101,
        } as const)
      : null),
  },
  railCount: {
    ...typography.caption,
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
    textShadowColor: "rgba(0,0,0,0.65)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  respectEmoji: {
    fontSize: 26,
    lineHeight: 30,
  },
  railActive: {
    transform: [{ scale: 1.08 }],
  },
  bottomMeta: {
    position: "absolute",
    left: 0,
    right: 72,
    bottom: 0,
    zIndex: 35,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  authorTextCol: {
    flex: 1,
    minWidth: 0,
  },
  authorName: {
    ...typography.bodySmall,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  authorUsername: {
    ...typography.caption,
    color: "rgba(255,255,255,0.82)",
  },
  followButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  followLabel: {
    ...typography.caption,
    color: colors.background,
    fontWeight: "800",
  },
  captionBlock: {
    gap: 2,
  },
  captionText: {
    ...typography.bodySmall,
    color: "#FFFFFF",
    lineHeight: 20,
  },
  moreLabel: {
    ...typography.caption,
    color: "rgba(255,255,255,0.75)",
    fontWeight: "700",
  },
  commentComposerHost: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 45,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  commentComposerTrigger: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(20, 20, 22, 0.88)",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  commentComposerPlaceholder: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontSize: Platform.OS === "web" ? 16 : 15,
    lineHeight: Platform.OS === "web" ? 22 : 20,
  },
});
