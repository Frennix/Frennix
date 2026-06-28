import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { FeedStory, FeedStoryLastWorkout } from "@frennix/types";
import { normalizePostMediaItems } from "@frennix/types";
import {
  Avatar,
  Button,
  FeedVideoPlayer,
  ProgressiveImage,
  WorkoutTypeChips,
  colors,
  formatRelativeTime,
  formatStreakBadgeLabel,
  spacing,
  typography,
} from "@frennix/ui";

const STORY_SLIDE_DURATION_MS = 5500;
const TOP_INSET = Platform.OS === "web" ? spacing.lg : spacing.xxl;

type StorySlide =
  | {
      kind: "media";
      url: string;
      mediaKind: "image" | "video";
      thumbnailUrl?: string | null;
    }
  | { kind: "text"; content: string }
  | { kind: "empty" };

function buildStorySlides(lastWorkout: FeedStoryLastWorkout | null): StorySlide[] {
  if (!lastWorkout) return [{ kind: "empty" }];

  if (lastWorkout.media_urls?.length) {
    return normalizePostMediaItems(lastWorkout.media_urls, {
      postType: lastWorkout.post_type,
      thumbnailUrl: lastWorkout.thumbnail_url,
    }).map((item) => ({
      kind: "media" as const,
      url: item.url,
      mediaKind: item.kind,
      thumbnailUrl: item.thumbnailUrl,
    }));
  }

  if (lastWorkout.content?.trim()) {
    return [{ kind: "text", content: lastWorkout.content.trim() }];
  }

  return [{ kind: "empty" }];
}

function StoryProgressBars({
  total,
  activeIndex,
  progress,
}: {
  total: number;
  activeIndex: number;
  progress: Animated.Value;
}) {
  if (total <= 0) return null;

  return (
    <View style={styles.progressRow}>
      {Array.from({ length: total }, (_, index) => {
        const isPast = index < activeIndex;
        const isActive = index === activeIndex;

        return (
          <View key={index} style={styles.progressTrack}>
            {isPast ? <View style={styles.progressFillComplete} /> : null}
            {isActive ? (
              <Animated.View
                style={[
                  styles.progressFillActive,
                  {
                    width: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                  },
                ]}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function StorySlideContent({
  slide,
  shouldPlayVideo,
  width,
  height,
}: {
  slide: StorySlide;
  shouldPlayVideo: boolean;
  width: number;
  height: number;
}) {
  if (slide.kind === "empty") {
    return (
      <View style={[styles.emptySlide, { width, height }]}>
        <Text style={styles.emptyEmoji}>🏋️</Text>
        <Text style={styles.emptyTitle}>No workout shared yet</Text>
      </View>
    );
  }

  if (slide.kind === "text") {
    return (
      <View style={[styles.textSlide, { width, height }]}>
        <Text style={styles.textSlideBody}>{slide.content}</Text>
      </View>
    );
  }

  if (slide.mediaKind === "video") {
    return (
      <FeedVideoPlayer
        uri={slide.url}
        thumbnailUrl={slide.thumbnailUrl}
        shouldPlay={shouldPlayVideo}
        style={{ width, height }}
      />
    );
  }

  return (
    <ProgressiveImage
      uri={slide.url}
      placeholderUri={slide.thumbnailUrl}
      style={{ width, height }}
      contentFit="contain"
      accessibilityLabel="Workout story photo"
    />
  );
}

export interface WorkoutStoryViewerProps {
  stories: FeedStory[];
  visible: boolean;
  initialStoryIndex?: number;
  onClose: () => void;
  onShareWorkout?: () => void;
  onViewProfile?: (username: string) => void;
}

/** Full-screen Instagram-style workout story viewer — not a post detail screen. */
export function WorkoutStoryViewer({
  stories,
  visible,
  initialStoryIndex = 0,
  onClose,
  onShareWorkout,
  onViewProfile,
}: WorkoutStoryViewerProps) {
  const { width, height } = useWindowDimensions();
  const [storyIndex, setStoryIndex] = useState(initialStoryIndex);
  const [slideIndex, setSlideIndex] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const dismissY = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<Animated.CompositeAnimation | null>(null);

  const story = stories[storyIndex] ?? null;
  const lastWorkout = story?.last_workout ?? null;
  const slides = useMemo(() => buildStorySlides(lastWorkout), [lastWorkout]);
  const activeSlide = slides[slideIndex] ?? slides[0];
  const isVideoSlide = activeSlide?.kind === "media" && activeSlide.mediaKind === "video";

  useEffect(() => {
    if (!visible) return;
    setStoryIndex(initialStoryIndex);
    setSlideIndex(0);
    dismissY.setValue(0);
  }, [visible, initialStoryIndex, dismissY]);

  const goNext = useCallback(() => {
    if (slideIndex < slides.length - 1) {
      setSlideIndex((current) => current + 1);
      return;
    }
    if (storyIndex < stories.length - 1) {
      setStoryIndex((current) => current + 1);
      setSlideIndex(0);
      return;
    }
    onClose();
  }, [onClose, slideIndex, slides.length, stories.length, storyIndex]);

  const goPrev = useCallback(() => {
    if (slideIndex > 0) {
      setSlideIndex((current) => current - 1);
      return;
    }
    if (storyIndex > 0) {
      const prevSlides = buildStorySlides(stories[storyIndex - 1]?.last_workout ?? null);
      setStoryIndex((current) => current - 1);
      setSlideIndex(Math.max(prevSlides.length - 1, 0));
    }
  }, [slideIndex, storyIndex, stories]);

  useEffect(() => {
    if (!visible || !story || isVideoSlide) {
      timerRef.current?.stop();
      progress.setValue(0);
      return;
    }

    progress.setValue(0);
    timerRef.current?.stop();
    timerRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_SLIDE_DURATION_MS,
      useNativeDriver: false,
    });
    timerRef.current.start(({ finished }) => {
      if (finished) goNext();
    });

    return () => timerRef.current?.stop();
  }, [visible, story, slideIndex, storyIndex, isVideoSlide, progress, goNext]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy > 0) dismissY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 120 || gesture.vy > 1.2) {
            onClose();
            return;
          }
          Animated.spring(dismissY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        },
      }),
    [dismissY, onClose]
  );

  if (!visible || !story) return null;

  const streakLabel = formatStreakBadgeLabel(story.workout_streak);
  const timeLabel = lastWorkout ? formatRelativeTime(lastWorkout.created_at) : null;
  const caption = lastWorkout?.content?.trim() ?? "";
  const showCaption = Boolean(caption) && activeSlide?.kind !== "text";
  const showEmptySelfCta = story.is_self && !lastWorkout;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View
        style={[
          styles.backdrop,
          {
            transform: [{ translateY: dismissY }],
            opacity: dismissY.interpolate({
              inputRange: [0, 240],
              outputRange: [1, 0.55],
              extrapolate: "clamp",
            }),
          },
        ]}
        {...panResponder.panHandlers}
      >
        <StorySlideContent
          slide={activeSlide}
          shouldPlayVideo={visible && isVideoSlide}
          width={width}
          height={height}
        />

        <View style={styles.gradientTop} pointerEvents="none" />
        <View style={styles.gradientBottom} pointerEvents="none" />

        <View style={[styles.overlay, { paddingTop: TOP_INSET }]}>
          <StoryProgressBars total={slides.length} activeIndex={slideIndex} progress={progress} />

          <View style={styles.headerRow}>
            <Pressable
              style={styles.profileTap}
              onPress={() => onViewProfile?.(story.profile.username)}
              accessibilityRole="button"
              accessibilityLabel={`View ${story.profile.display_name}'s profile`}
            >
              <Avatar uri={story.profile.avatar_url} name={story.profile.display_name} size={36} />
              <View style={styles.headerText}>
                <Text style={styles.headerUsername} numberOfLines={1}>
                  {story.is_self ? "Your story" : story.profile.display_name}
                </Text>
                <Text style={styles.headerMeta} numberOfLines={1}>
                  {streakLabel}
                  {timeLabel ? ` · ${timeLabel}` : ""}
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close story"
            >
              <Text style={styles.closeIcon}>✕</Text>
            </Pressable>
          </View>

          {lastWorkout ? (
            <WorkoutTypeChips
              types={lastWorkout}
              maxVisible={3}
              size="compact"
              overlay
              style={styles.workoutChips}
            />
          ) : null}
        </View>

        {showCaption ? (
          <View style={styles.captionOverlay} pointerEvents="none">
            <Text style={styles.captionText}>{caption}</Text>
          </View>
        ) : null}

        {showEmptySelfCta ? (
          <View style={styles.emptyCtaOverlay}>
            <Text style={styles.emptyCtaTitle}>Share your latest workout</Text>
            <Text style={styles.emptyCtaBody}>
              Post a photo, video, or progress update to show up in stories.
            </Text>
            <Button title="Share workout" onPress={onShareWorkout} />
          </View>
        ) : null}

        <View style={styles.tapZones} pointerEvents="box-none">
          <Pressable
            style={styles.tapZoneLeft}
            onPress={goPrev}
            accessibilityRole="button"
            accessibilityLabel="Previous story slide"
          />
          <Pressable
            style={styles.tapZoneRight}
            onPress={goNext}
            accessibilityRole="button"
            accessibilityLabel="Next story slide"
          />
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.black,
  },
  progressRow: {
    flexDirection: "row",
    gap: 4,
    marginBottom: spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.28)",
    overflow: "hidden",
  },
  progressFillComplete: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.text,
  },
  progressFillActive: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.text,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    zIndex: 3,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  profileTap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minWidth: 0,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  headerUsername: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "700",
  },
  headerMeta: {
    ...typography.caption,
    color: "rgba(255,255,255,0.82)",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10, 10, 11, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  closeIcon: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 20,
    fontWeight: "700",
  },
  workoutChips: {
    marginTop: spacing.sm,
  },
  gradientTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 160,
    backgroundColor: "rgba(10, 10, 11, 0.45)",
    zIndex: 1,
  },
  gradientBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: "rgba(10, 10, 11, 0.55)",
    zIndex: 1,
  },
  captionOverlay: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.xl,
    zIndex: 3,
  },
  captionText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  emptyCtaOverlay: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xxl,
    zIndex: 4,
    gap: spacing.sm,
    alignItems: "center",
  },
  emptyCtaTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyCtaBody: {
    ...typography.bodySmall,
    color: "rgba(255,255,255,0.82)",
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  tapZones: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    zIndex: 2,
  },
  tapZoneLeft: {
    flex: 1,
  },
  tapZoneRight: {
    flex: 1,
  },
  emptySlide: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.black,
    gap: spacing.sm,
  },
  emptyEmoji: {
    fontSize: 56,
    lineHeight: 60,
  },
  emptyTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: "700",
  },
  textSlide: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.black,
    paddingHorizontal: spacing.xl,
  },
  textSlideBody: {
    ...typography.body,
    color: colors.text,
    lineHeight: 24,
    textAlign: "center",
  },
});
