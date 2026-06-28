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
import type { FeedStory } from "@frennix/types";
import type { StoryChallengeKey, StoryQuickReactionEmoji } from "@frennix/types";
import type { StoryInsights } from "@frennix/types";
import {
  Avatar,
  FeedVideoPlayer,
  ProgressiveImage,
  colors,
  formatRelativeTime,
  formatStreakBadgeLabel,
  spacing,
  typography,
} from "@frennix/ui";
import { primaryStoryMilestone } from "@frennix/api";
import { StoryActionDock } from "./story/StoryActionDock";
import { StoryDailyMotivation } from "./story/StoryDailyMotivation";
import { StoryAchievementMoment } from "./story/StoryAchievementMoment";
import { StoryInsightsStrip } from "./story/StoryInsightsStrip";
import { WorkoutCompletionCard } from "./story/WorkoutCompletionCard";
import {
  buildStorySlides,
  prefetchStorySlide,
  type WorkoutStorySlide,
} from "../lib/story-utils";

const STORY_SLIDE_DURATION_MS = 5500;
const TOP_INSET = Platform.OS === "web" ? spacing.lg : spacing.xxl;
const HOLD_THRESHOLD_MS = 220;

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
  slide: WorkoutStorySlide;
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

const STORY_ROOT_STYLE = Platform.select({
  web: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    zIndex: 9999,
  },
  default: {},
});

export interface WorkoutStoryViewerProps {
  stories: FeedStory[];
  visible: boolean;
  initialStoryIndex?: number;
  onClose: () => void;
  onShareWorkout?: () => void;
  onViewProfile?: (username: string) => void;
  onMarkViewed?: (storyUserId: string, postId: string | null) => void;
  onReact?: (storyUserId: string, postId: string, emoji: StoryQuickReactionEmoji) => void | Promise<void>;
  onChallenge?: (storyUserId: string, key: StoryChallengeKey) => void | Promise<void>;
  onReply?: (storyUserId: string, text: string) => void | Promise<void>;
  onFollow?: (storyUserId: string, isFollowing: boolean) => void | Promise<void>;
  onInviteToTrain?: (storyUserId: string, postId: string | null) => void | Promise<void>;
  onViewProfileFromStory?: (storyUserId: string, username: string) => void;
  storyInsights?: StoryInsights | null;
  followLoading?: boolean;
  inviteLoading?: boolean;
}

/** Full-screen Instagram-style workout story viewer — not a post detail screen. */
export function WorkoutStoryViewer({
  stories,
  visible,
  initialStoryIndex = 0,
  onClose,
  onShareWorkout,
  onViewProfile,
  onMarkViewed,
  onReact,
  onChallenge,
  onReply,
  onFollow,
  onInviteToTrain,
  onViewProfileFromStory,
  storyInsights,
  followLoading,
  inviteLoading,
}: WorkoutStoryViewerProps) {
  const { width, height } = useWindowDimensions();
  const [storyIndex, setStoryIndex] = useState(initialStoryIndex);
  const [slideIndex, setSlideIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const dismissY = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<Animated.CompositeAnimation | null>(null);
  const elapsedMsRef = useRef(0);
  const holdStartedAtRef = useRef<number | null>(null);
  const didHoldRef = useRef(false);

  const story = stories[storyIndex] ?? null;
  const lastWorkout = story?.last_workout ?? null;
  const slides = useMemo(() => buildStorySlides(lastWorkout), [lastWorkout]);
  const activeSlide = slides[slideIndex] ?? slides[0];
  const isVideoSlide = activeSlide?.kind === "media" && activeSlide.mediaKind === "video";
  const timerKey = `${storyIndex}-${slideIndex}-${visible}`;
  const spotlightMilestone = primaryStoryMilestone(lastWorkout?.milestones ?? []);

  useEffect(() => {
    if (!visible) return;
    setStoryIndex(initialStoryIndex);
    setSlideIndex(0);
    setPaused(false);
    dismissY.setValue(0);
    elapsedMsRef.current = 0;
  }, [visible, initialStoryIndex, dismissY]);

  useEffect(() => {
    if (!visible || !story) return;
    onMarkViewed?.(story.user_id, lastWorkout?.post_id ?? null);
  }, [visible, story?.user_id, lastWorkout?.post_id, onMarkViewed, story]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    if (!visible) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [visible]);

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

  const stopTimer = useCallback(() => {
    timerRef.current?.stop();
  }, []);

  const startTimer = useCallback(
    (fromMs: number) => {
      stopTimer();
      elapsedMsRef.current = fromMs;
      const fraction = Math.min(fromMs / STORY_SLIDE_DURATION_MS, 1);
      progress.setValue(fraction);
      if (fromMs >= STORY_SLIDE_DURATION_MS) {
        goNext();
        return;
      }
      timerRef.current = Animated.timing(progress, {
        toValue: 1,
        duration: STORY_SLIDE_DURATION_MS - fromMs,
        useNativeDriver: false,
      });
      timerRef.current.start(({ finished }) => {
        if (finished) goNext();
      });
    },
    [goNext, progress, stopTimer]
  );

  useEffect(() => {
    elapsedMsRef.current = 0;
    progress.setValue(0);
  }, [timerKey, progress]);

  useEffect(() => {
    if (!visible || !story) {
      stopTimer();
      progress.setValue(0);
      elapsedMsRef.current = 0;
      return;
    }

    if (paused) {
      stopTimer();
      progress.stopAnimation((value) => {
        elapsedMsRef.current = value * STORY_SLIDE_DURATION_MS;
      });
      return;
    }

    startTimer(elapsedMsRef.current);
    return stopTimer;
  }, [timerKey, visible, story, paused, startTimer, stopTimer, progress]);

  useEffect(() => {
    prefetchStorySlide(slides[slideIndex + 1]);
    const nextStory = stories[storyIndex + 1];
    if (slideIndex >= slides.length - 1 && nextStory) {
      prefetchStorySlide(buildStorySlides(nextStory.last_workout)[0]);
    }
  }, [slideIndex, slides, storyIndex, stories]);

  const beginHold = useCallback(() => {
    didHoldRef.current = false;
    holdStartedAtRef.current = Date.now();
    setPaused(true);
    setTimeout(() => {
      if (holdStartedAtRef.current !== null) didHoldRef.current = true;
    }, HOLD_THRESHOLD_MS);
  }, []);

  const endHold = useCallback(() => {
    holdStartedAtRef.current = null;
    setPaused(false);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => beginHold(),
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy > 0) dismissY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_, gesture) => {
          endHold();
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
        onPanResponderTerminate: () => endHold(),
      }),
    [beginHold, dismissY, endHold, onClose]
  );

  if (!visible || !story) return null;

  const caption = lastWorkout?.content?.trim() ?? "";
  const showCaption = Boolean(caption) && activeSlide?.kind !== "text";
  const showEmptySelfCta = story.is_self && !lastWorkout;
  const canEngage = Boolean(lastWorkout?.post_id) && !story.is_self;

  const timePosted = lastWorkout ? formatRelativeTime(lastWorkout.created_at) : "";
  const aiSummary =
    (activeSlide?.meta?.aiSummary as string | undefined) ??
    (lastWorkout?.metrics?.extra?.ai_summary as string | undefined) ??
    null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      presentationStyle="fullScreen"
      hardwareAccelerated
    >
      <View style={[styles.root, STORY_ROOT_STYLE]}>
        <Animated.View
          style={[styles.stage, { transform: [{ translateY: dismissY }] }]}
          {...panResponder.panHandlers}
        >
          <View style={styles.mediaStage} pointerEvents="none">
            <StorySlideContent
              slide={activeSlide}
              shouldPlayVideo={visible && isVideoSlide && !paused}
              width={width}
              height={height}
            />
          </View>

          <View style={styles.scrimTop} pointerEvents="none" />
          <View style={styles.scrimBottom} pointerEvents="none" />

          <View style={[styles.header, { paddingTop: TOP_INSET }]}>
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
                    {story.workout_streak > 0
                      ? `${formatStreakBadgeLabel(story.workout_streak)} · ${timePosted}`
                      : timePosted}
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

            {spotlightMilestone ? (
              <StoryAchievementMoment milestone={spotlightMilestone} resetKey={timerKey} />
            ) : null}

            {story.is_self && storyInsights ? <StoryInsightsStrip insights={storyInsights} /> : null}
          </View>

          <View style={styles.footer} pointerEvents="box-none">
            {lastWorkout ? (
              <WorkoutCompletionCard
                lastWorkout={lastWorkout}
                streak={story.workout_streak}
                achievement={
                  spotlightMilestone
                    ? { emoji: spotlightMilestone.emoji, label: spotlightMilestone.label }
                    : null
                }
                aiSummary={aiSummary}
              />
            ) : null}

            {showCaption ? <Text style={styles.captionText}>{caption}</Text> : null}

            {showEmptySelfCta ? (
              <StoryDailyMotivation onShareWorkout={onShareWorkout} seed={story.user_id} />
            ) : null}

            {canEngage ? (
              <StoryActionDock
                disabled={paused}
                isFollowing={story.viewer_follows}
                followLoading={followLoading}
                inviteLoading={inviteLoading}
                onReact={(emoji) => onReact?.(story.user_id, lastWorkout!.post_id, emoji)}
                onChallenge={(key) => onChallenge?.(story.user_id, key)}
                onReply={(text) => onReply?.(story.user_id, text) ?? Promise.resolve()}
                onFollow={() => onFollow?.(story.user_id, story.viewer_follows)}
                onInviteToTrain={() => onInviteToTrain?.(story.user_id, lastWorkout?.post_id ?? null)}
                onViewProfile={() =>
                  onViewProfileFromStory?.(story.user_id, story.profile.username) ??
                  onViewProfile?.(story.profile.username)
                }
              />
            ) : null}
          </View>

          <View style={styles.tapZones} pointerEvents="box-none">
            <Pressable
              style={styles.tapZoneLeft}
              onPress={() => {
                if (!didHoldRef.current) goPrev();
              }}
              onPressIn={beginHold}
              onPressOut={endHold}
              accessibilityRole="button"
              accessibilityLabel="Previous story slide"
            />
            <Pressable
              style={styles.tapZoneRight}
              onPress={() => {
                if (!didHoldRef.current) goNext();
              }}
              onPressIn={beginHold}
              onPressOut={endHold}
              accessibilityRole="button"
              accessibilityLabel="Next story slide"
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.black,
  },
  stage: {
    flex: 1,
    backgroundColor: colors.black,
    overflow: "hidden",
  },
  mediaStage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
  scrimTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: "rgba(10, 10, 11, 0.72)",
    zIndex: 1,
  },
  scrimBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 320,
    backgroundColor: "rgba(10, 10, 11, 0.78)",
    zIndex: 1,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    zIndex: 4,
  },
  footer: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.lg,
    zIndex: 4,
    gap: spacing.sm,
    maxHeight: "42%",
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
    fontWeight: "600",
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
  captionText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  engagement: {
    gap: spacing.sm,
  },
  emptyCta: {
    gap: spacing.sm,
    alignItems: "center",
    marginBottom: spacing.sm,
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
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 280,
    flexDirection: "row",
    zIndex: 3,
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
