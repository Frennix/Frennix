import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { FeedStory } from "@frennix/types";
import type { StoryChallengeKey, StoryQuickReactionEmoji } from "@frennix/types";
import type { StoryInsights } from "@frennix/types";
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
  touchTarget,
  typography,
} from "@frennix/ui";
import { FrennixBrandMark } from "./FrennixLogo";
import { StoryWorkoutSlideCard } from "./story/StoryWorkoutSlideCard";
import { StoryQuickActionsBar } from "./story/StoryQuickActionsBar";
import { StoryReplyBar } from "./story/StoryReplyBar";
import { StoryReactionRow } from "./story/StoryReactionRow";
import { StoryPollVoteCard } from "./story/StoryPollVoteCard";
import { StoryCountdownCard } from "./story/StoryCountdownCard";
import { StoryQuestionCard } from "./story/StoryQuestionCard";
import { StoryChallengeAccepts } from "./story/StoryChallengeAccepts";
import { StoryCompletionBadge } from "./story/StoryCompletionBadge";
import { StoryFooterGradient } from "./story/StoryFooterGradient";
import { StoryQuestionAnswersModal } from "./story/StoryQuestionAnswersModal";
import {
  voteStoryPoll,
  getStoryInteractiveBundle,
  getStoryViewerCount,
  subscribeStoryCountdown,
  answerStoryQuestion,
  getStoryQuestionAnswersForOwner,
  shareStoryQuestionAnswer,
} from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { StoryInsightsStrip } from "./story/StoryInsightsStrip";
import { StoryViewerEyeButton } from "./story/StoryViewerEyeButton";
import { StoryControlsButton } from "./story/StoryControlsButton";
import { StoryControlsSheet } from "./story/StoryControlsSheet";
import { useStoryViewersRealtime } from "@/lib/useStoryViewersRealtime";
import type { FrennixStory } from "@frennix/types";
import {
  STORY_MEDIA_LOAD_TIMEOUT_MS,
  storySlideNeedsMedia,
} from "@/lib/story-media-ready";
import {
  buildDedicatedStorySlides,
  prefetchAuthorizedViewerMedia,
  resolveSlideContext,
  type WorkoutStorySlide,
} from "../lib/story-utils";

const STORY_SLIDE_DURATION_MS = 5500;
const HOLD_THRESHOLD_MS = 220;
const NAV_DEBOUNCE_MS = 280;
/** Transparent side tap targets (~35–40% each); center is hold-only. */
const TAP_ZONE_SIDE_RATIO = 0.375;

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
  playbackEpoch,
  width,
  height,
  onMediaReady,
  onMediaError,
}: {
  slide: WorkoutStorySlide;
  shouldPlayVideo: boolean;
  playbackEpoch: number;
  width: number;
  height: number;
  onMediaReady: () => void;
  onMediaError: () => void;
}) {
  if (slide.kind === "empty") {
    return (
      <View style={[styles.emptySlide, { width, height }]}>
        <Text style={styles.emptyEmoji}>🏋️</Text>
        <Text style={styles.emptyTitle}>No workout shared yet</Text>
      </View>
    );
  }

  if (slide.kind === "workout") {
    return (
      <StoryWorkoutSlideCard
        title={slide.title}
        activity={slide.activity}
        distance={slide.metrics.distance}
        duration={slide.metrics.duration}
        calories={slide.metrics.calories}
        gym={slide.metrics.gym}
        location={slide.metrics.location}
        caption={slide.caption}
      />
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
        key={`story-video-${playbackEpoch}`}
        uri={slide.url}
        thumbnailUrl={slide.thumbnailUrl}
        shouldPlay={shouldPlayVideo}
        fillParent
        onRenderedFrame={onMediaReady}
        onPlaybackError={onMediaError}
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
      showPlaceholder={false}
      accessibilityLabel="Workout story photo"
      onLoad={onMediaReady}
      onError={onMediaError}
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
  onMarkViewed?: (storyUserId: string, storyId: string | null, slideId: string | null) => void;
  onReact?: (
    storyUserId: string,
    storyId: string,
    emoji: StoryQuickReactionEmoji,
    slideId?: string | null
  ) => void | Promise<void>;
  onChallenge?: (storyUserId: string, key: StoryChallengeKey) => void | Promise<void>;
  onReply?: (storyUserId: string, text: string, storyId?: string | null) => void | Promise<void>;
  onJoinChallenge?: (
    storyUserId: string,
    storyId: string,
    options: { challengeId?: string | null; trainingChallengeId?: string | null }
  ) => void | Promise<void>;
  onOpenViewers?: (slideId: string | null) => void;
  onOpenAnalytics?: (slideId: string | null) => void;
  onOpenReactions?: () => void;
  onActiveSlideChange?: (storyId: string | null, slideId: string | null) => void;
  onFollow?: (storyUserId: string, isFollowing: boolean) => void | Promise<void>;
  onInviteToTrain?: (storyUserId: string, postId: string | null) => void | Promise<void>;
  onInviteToEvent?: (storyUserId: string, storyId: string) => void | Promise<void>;
  onDiscoverTag?: (tag: string) => void;
  onDiscoverLocation?: (location: string) => void;
  onViewProfileFromStory?: (storyUserId: string, username: string) => void;
  onMarkCommitmentComplete?: () => void | Promise<void>;
  onStoryUpdated?: (story: FrennixStory) => void;
  onStoryDeleted?: (storyId: string, ownerId: string) => void;
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
  onJoinChallenge,
  onOpenViewers,
  onOpenAnalytics,
  onOpenReactions,
  onActiveSlideChange,
  onFollow,
  onInviteToTrain,
  onInviteToEvent,
  onDiscoverTag,
  onDiscoverLocation,
  onViewProfileFromStory,
  onMarkCommitmentComplete,
  onStoryUpdated,
  onStoryDeleted,
  storyInsights,
  followLoading,
  inviteLoading,
}: WorkoutStoryViewerProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [storyIndex, setStoryIndex] = useState(initialStoryIndex);
  const [slideIndex, setSlideIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [interactionLocked, setInteractionLocked] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [questionAnswersVisible, setQuestionAnswersVisible] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const progress = useRef(new Animated.Value(0)).current;
  const dismissY = useRef(new Animated.Value(0)).current;
  const slideOpacity = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<Animated.CompositeAnimation | null>(null);
  const elapsedMsRef = useRef(0);
  const holdStartedAtRef = useRef<number | null>(null);
  const didHoldRef = useRef(false);
  const lastNavAtRef = useRef(0);
  const [playbackEpoch, setPlaybackEpoch] = useState(0);
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);

  const story = stories[storyIndex] ?? null;
  const activeStories = story?.active_stories ?? [];
  const slides = useMemo(
    () => buildDedicatedStorySlides(activeStories),
    [activeStories]
  );
  const activeSlide = slides[slideIndex] ?? slides[0];
  const slideContext = useMemo(
    () => resolveSlideContext(activeStories, slideIndex),
    [activeStories, slideIndex]
  );
  const currentDedicatedStory = useMemo(() => {
    if (!slideContext) return activeStories[0] ?? null;
    return activeStories.find((item) => item.id === slideContext.storyId) ?? null;
  }, [activeStories, slideContext]);
  const isVideoSlide = activeSlide?.kind === "media" && activeSlide.mediaKind === "video";
  const timerKey = `${storyIndex}-${slideIndex}-${visible}`;
  const needsMedia = storySlideNeedsMedia(activeSlide);
  const mediaIdentity =
    activeSlide?.kind === "media" ? `${activeSlide.mediaKind}:${activeSlide.url}` : activeSlide?.kind ?? "none";
  const autoAdvancePaused = paused || interactionLocked || showReply || controlsOpen;

  useEffect(() => {
    if (!visible) return;
    setStoryIndex(initialStoryIndex);
    setSlideIndex(0);
    setPaused(false);
    setInteractionLocked(false);
    setCaptionExpanded(false);
    setShowReply(false);
    setControlsOpen(false);
    setStatusMessage("");
    dismissY.setValue(0);
    elapsedMsRef.current = 0;
  }, [visible, initialStoryIndex, dismissY]);

  useEffect(() => {
    if (!visible) return;
    onActiveSlideChange?.(
      slideContext?.storyId ?? currentDedicatedStory?.id ?? null,
      slideContext?.slideId ?? null
    );
  }, [
    visible,
    slideContext?.storyId,
    slideContext?.slideId,
    currentDedicatedStory?.id,
    onActiveSlideChange,
  ]);

  useEffect(() => {
    if (!visible || !story) return;
    onMarkViewed?.(
      story.user_id,
      slideContext?.storyId ?? currentDedicatedStory?.id ?? null,
      slideContext?.slideId ?? null
    );
  }, [
    visible,
    story?.user_id,
    slideContext?.storyId,
    slideContext?.slideId,
    currentDedicatedStory?.id,
    onMarkViewed,
    story,
  ]);

  useEffect(() => {
    if (!visible) return;
    if (!story || activeStories.length === 0) {
      onClose();
    }
  }, [activeStories.length, onClose, story, visible]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    if (!visible) {
      document.body.style.removeProperty("overflow");
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      if (previousOverflow) {
        document.body.style.overflow = previousOverflow;
      } else {
        document.body.style.removeProperty("overflow");
      }
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

  const showStatus = useCallback((message: string) => {
    setStatusMessage(message);
    setTimeout(() => setStatusMessage(""), 2200);
  }, []);

  const handleControlsUpdated = useCallback(
    (updated: FrennixStory) => {
      onStoryUpdated?.(updated);
    },
    [onStoryUpdated]
  );

  const handleControlsDeleted = useCallback(
    (deletedStoryId: string) => {
      const ownerId = story?.user_id ?? "";
      const remainingStories = activeStories.filter((item) => item.id !== deletedStoryId);
      onStoryDeleted?.(deletedStoryId, ownerId);
      setControlsOpen(false);
      showStatus("Story deleted.");

      if (remainingStories.length > 0) {
        const deletedAt = activeStories.findIndex((item) => item.id === deletedStoryId);
        const nextStory = remainingStories[deletedAt] ?? remainingStories[Math.max(0, deletedAt - 1)];
        const nextSlides = buildDedicatedStorySlides(remainingStories);
        const nextIndex = nextSlides.findIndex((slide) => slide.storyId === nextStory.id);
        setSlideIndex(Math.max(0, nextIndex));
        return;
      }

      if (storyIndex < stories.length - 1) {
        setStoryIndex((current) => current + 1);
        setSlideIndex(0);
        return;
      }
      if (storyIndex > 0) {
        setStoryIndex((current) => current - 1);
        setSlideIndex(0);
        return;
      }
      setTimeout(() => onClose(), 700);
    },
    [activeStories, onClose, onStoryDeleted, showStatus, story?.user_id, storyIndex, stories.length]
  );

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
    setPlaybackEpoch(0);
  }, [timerKey, progress]);

  const markMediaReady = useCallback(() => {
    setMediaFailed(false);
    setMediaReady(true);
  }, []);

  const markMediaFailed = useCallback(() => {
    setMediaReady(false);
    setMediaFailed(true);
  }, []);

  const retryCurrentMedia = useCallback(() => {
    stopTimer();
    elapsedMsRef.current = 0;
    progress.setValue(0);
    setMediaFailed(false);
    setMediaReady(!needsMedia);
    setPlaybackEpoch((epoch) => epoch + 1);
  }, [needsMedia, progress, stopTimer]);

  const restartCurrentSlide = useCallback(() => {
    retryCurrentMedia();
  }, [retryCurrentMedia]);

  const handleLeftTap = useCallback(() => {
    if (slideIndex > 0) {
      setSlideIndex((current) => current - 1);
      return;
    }
    restartCurrentSlide();
  }, [restartCurrentSlide, slideIndex]);

  const tryNavigate = useCallback(
    (action: () => void) => {
      if (didHoldRef.current || interactionLocked || controlsOpen) return;
      const now = Date.now();
      if (now - lastNavAtRef.current < NAV_DEBOUNCE_MS) return;
      lastNavAtRef.current = now;
      action();
    },
    [controlsOpen, interactionLocked]
  );

  useEffect(() => {
    setInteractionLocked(false);
    setCaptionExpanded(false);
    setShowReply(false);
    slideOpacity.setValue(0);
    Animated.timing(slideOpacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [timerKey, slideOpacity]);

  useEffect(() => {
    setMediaFailed(false);
    setMediaReady(!needsMedia);
  }, [timerKey, mediaIdentity, needsMedia]);

  useEffect(() => {
    if (!visible || mediaReady || mediaFailed || !needsMedia) return;
    const timeout = setTimeout(() => {
      setMediaFailed(true);
      setMediaReady(false);
    }, STORY_MEDIA_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [timerKey, playbackEpoch, visible, mediaReady, mediaFailed, needsMedia]);

  useEffect(() => {
    if (!visible || !story) {
      stopTimer();
      progress.setValue(0);
      elapsedMsRef.current = 0;
      return;
    }

    if (mediaFailed || !mediaReady) {
      stopTimer();
      progress.setValue(0);
      elapsedMsRef.current = 0;
      return;
    }

    if (autoAdvancePaused) {
      stopTimer();
      progress.stopAnimation((value) => {
        elapsedMsRef.current = value * STORY_SLIDE_DURATION_MS;
      });
      return;
    }

    startTimer(elapsedMsRef.current);
    return stopTimer;
  }, [
    timerKey,
    visible,
    story,
    autoAdvancePaused,
    mediaReady,
    mediaFailed,
    startTimer,
    stopTimer,
    progress,
  ]);

  useEffect(() => {
    if (!visible) return;
    const nextStory = stories[storyIndex + 1];
    prefetchAuthorizedViewerMedia({
      currentSlides: slides,
      currentIndex: slideIndex,
      nextStoryFirstSlide: nextStory
        ? buildDedicatedStorySlides(nextStory.active_stories ?? [])[0]
        : undefined,
    });
  }, [visible, slideIndex, slides, storyIndex, stories]);

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

  const pollStoryId = slideContext?.storyId ?? activeStories.at(-1)?.id ?? null;
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const hasChallengeHint = Boolean(
    currentDedicatedStory?.challenge_id || currentDedicatedStory?.challenge_prompt
  );

  const { data: storyInteractive } = useQuery({
    queryKey: ["story-interactive", pollStoryId, session?.user.id, hasChallengeHint],
    queryFn: () =>
      getStoryInteractiveBundle(pollStoryId!, session?.user.id, {
        includeChallengeJoins: hasChallengeHint,
      }),
    enabled: Boolean(visible && pollStoryId),
    staleTime: 60_000,
  });

  const storyPoll = storyInteractive?.poll ?? null;
  const trainingChallenge = storyInteractive?.trainingChallenge ?? null;
  const challengeJoins = storyInteractive?.challengeJoins ?? [];
  const storyCountdown = storyInteractive?.countdown ?? null;
  const storyQuestion = storyInteractive?.question ?? null;
  const workoutCommitment = storyInteractive?.commitment ?? null;

  const { data: questionAnswers = [], isLoading: questionAnswersLoading } = useQuery({
    queryKey: ["story-question-answers", storyQuestion?.id],
    queryFn: () => getStoryQuestionAnswersForOwner(storyQuestion!.id),
    enabled: Boolean(visible && story?.is_self && storyQuestion?.id && questionAnswersVisible),
  });

  const handleShareQuestionAnswer = useCallback(
    async (answerId: string) => {
      if (!session?.user.id) return;
      await shareStoryQuestionAnswer(answerId, session.user.id);
      await queryClient.invalidateQueries({ queryKey: ["story-question-answers", storyQuestion?.id] });
    },
    [queryClient, session?.user.id, storyQuestion?.id]
  );

  const handlePollVote = useCallback(
    async (optionId: string) => {
      if (!storyPoll || !session?.user.id) return;
      await voteStoryPoll(storyPoll.id, optionId, session.user.id);
      await queryClient.invalidateQueries({ queryKey: ["story-interactive", pollStoryId] });
    },
    [pollStoryId, queryClient, session?.user.id, storyPoll]
  );

  const handleCountdownSubscribe = useCallback(async () => {
    if (!storyCountdown || !session?.user.id) return;
    await subscribeStoryCountdown(storyCountdown.id, session.user.id);
    await queryClient.invalidateQueries({ queryKey: ["story-interactive", pollStoryId] });
  }, [pollStoryId, queryClient, session?.user.id, storyCountdown]);

  const handleQuestionAnswer = useCallback(
    async (answer: string) => {
      if (!storyQuestion || !session?.user.id) return;
      await answerStoryQuestion(storyQuestion.id, session.user.id, answer);
      await queryClient.invalidateQueries({ queryKey: ["story-interactive", pollStoryId] });
    },
    [pollStoryId, queryClient, session?.user.id, storyQuestion]
  );

  const hasTrainingChallenge = Boolean(
    trainingChallenge || currentDedicatedStory?.challenge_id || currentDedicatedStory?.challenge_prompt
  );
  const challengePrompt =
    trainingChallenge?.prompt ?? currentDedicatedStory?.challenge_prompt ?? null;

  const activeStoryIdForQuery = slideContext?.storyId ?? currentDedicatedStory?.id ?? null;
  const activeSlideIdForQuery = slideContext?.slideId ?? null;

  const { data: viewerCount = 0 } = useQuery({
    queryKey: ["story-viewer-count", session?.user.id, activeStoryIdForQuery, activeSlideIdForQuery],
    queryFn: () =>
      getStoryViewerCount(session!.user.id, activeStoryIdForQuery!, activeSlideIdForQuery),
    enabled: Boolean(visible && story?.is_self && session?.user.id && activeStoryIdForQuery),
    staleTime: 10_000,
  });

  useStoryViewersRealtime(
    session?.user.id,
    activeStoryIdForQuery,
    Boolean(visible && story?.is_self && activeStoryIdForQuery)
  );

  if (!visible || !story || !activeStories.length) return null;

  const caption =
    activeSlide?.kind === "media"
      ? activeSlide.caption?.trim() ?? ""
      : activeSlide?.kind === "text"
        ? activeSlide.content.trim()
        : "";
  const showCaption = Boolean(caption) && activeSlide?.kind !== "workout";
  const captionNeedsMore = caption.length > 96 || caption.includes("\n");
  const activeStoryId = slideContext?.storyId ?? currentDedicatedStory?.id ?? null;
  const commentingEnabled = currentDedicatedStory?.commenting_enabled !== false;
  const canEngage = Boolean(activeStoryId) && !story.is_self;

  const timePosted = currentDedicatedStory
    ? formatRelativeTime(currentDedicatedStory.created_at)
    : "";

  const workoutSlide = activeSlide?.kind === "workout" ? activeSlide : null;

  const headerTopPad = Math.max(insets.top, Platform.OS === "web" ? spacing.md : spacing.lg);
  const footerBottomPad = Math.max(insets.bottom, spacing.md, Platform.OS === "web" ? 12 : 0);

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
          <Animated.View
            style={[styles.mediaStage, { opacity: slideOpacity }]}
            pointerEvents={mediaFailed ? "auto" : "none"}
          >
            <StorySlideContent
              key={`${timerKey}-${playbackEpoch}`}
              slide={activeSlide}
              shouldPlayVideo={visible && isVideoSlide && !autoAdvancePaused && !mediaFailed}
              playbackEpoch={playbackEpoch}
              width={width}
              height={height}
              onMediaReady={markMediaReady}
              onMediaError={markMediaFailed}
            />
            {needsMedia && !mediaReady && !mediaFailed ? (
              <View style={styles.mediaStatus} pointerEvents="none" accessibilityLabel="Loading story">
                <Animated.View style={{ opacity: slideOpacity }}>
                  <FrennixBrandMark style={styles.loaderMark} accessibilityLabel="Frennix" />
                </Animated.View>
                <Text style={styles.loaderLabel}>Loading</Text>
              </View>
            ) : null}
            {mediaFailed ? (
              <View style={styles.mediaStatus} pointerEvents="auto">
                <Text style={styles.failTitle}>Couldn't load this story</Text>
                <Text style={styles.failBody}>Check your connection and try again.</Text>
                <View style={styles.failActions}>
                  <Button title="Retry" onPress={retryCurrentMedia} />
                  <Button title="Close" variant="secondary" onPress={onClose} />
                </View>
              </View>
            ) : null}
          </Animated.View>

          <View style={styles.scrimTop} pointerEvents="none" />
          <StoryFooterGradient />

          <View style={[styles.header, { paddingTop: headerTopPad }]}>
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

              {story.is_self && onOpenViewers ? (
                <StoryViewerEyeButton
                  count={viewerCount}
                  onPress={() => onOpenViewers(activeSlideIdForQuery)}
                />
              ) : null}

              {story.is_self && currentDedicatedStory ? (
                <StoryControlsButton
                  onPress={() => {
                    setControlsOpen(true);
                    setPaused(true);
                  }}
                />
              ) : null}

              <Pressable
                style={styles.closeButton}
                onPress={onClose}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close story"
                accessibilityHint="Dismisses the story viewer. You can also swipe down."
              >
                <Text style={styles.closeIcon}>✕</Text>
              </Pressable>
            </View>

            {story.is_self && storyInsights ? (
              <StoryInsightsStrip
                insights={storyInsights}
                viewCount={viewerCount}
                onViewsPress={() => onOpenViewers?.(activeSlideIdForQuery)}
                onReactionsPress={onOpenReactions}
                onPress={() => onOpenAnalytics?.(activeSlideIdForQuery)}
              />
            ) : null}
          </View>

          <View style={[styles.footer, { paddingBottom: footerBottomPad }]} pointerEvents="box-none">
            {workoutSlide?.kind === "workout" ? (
              <View style={styles.compactWorkoutMeta} pointerEvents="none">
                <WorkoutTypeChips
                  types={{ workout_types: workoutSlide.activity ? [workoutSlide.activity] : [] }}
                  maxVisible={2}
                  size="compact"
                  overlay
                />
                <Text style={styles.compactWorkoutText} numberOfLines={1}>
                  {[
                    workoutSlide.metrics.duration,
                    workoutSlide.metrics.calories,
                    story.workout_streak > 0 ? formatStreakBadgeLabel(story.workout_streak) : null,
                    timePosted,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
            ) : null}

            {showCaption ? (
              <View style={styles.captionBlock}>
                <Text
                  style={styles.captionText}
                  numberOfLines={captionExpanded ? undefined : 2}
                >
                  {caption}
                </Text>
                {captionNeedsMore && !captionExpanded ? (
                  <Pressable
                    onPress={() => {
                      setCaptionExpanded(true);
                      setPaused(true);
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Show full caption"
                  >
                    <Text style={styles.captionMore}>More</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {currentDedicatedStory?.workout_tag ? (
              <Pressable onPress={() => onDiscoverTag?.(currentDedicatedStory.workout_tag!)}>
                <Text style={styles.workoutTag}>#{currentDedicatedStory.workout_tag}</Text>
              </Pressable>
            ) : null}

            {currentDedicatedStory?.location_name ? (
              <Pressable onPress={() => onDiscoverLocation?.(currentDedicatedStory.location_name!)}>
                <Text style={styles.locationTag}>📍 {currentDedicatedStory.location_name}</Text>
              </Pressable>
            ) : null}

            {workoutCommitment?.completed_at ? <StoryCompletionBadge /> : null}

            {storyCountdown ? (
              <StoryCountdownCard
                countdown={storyCountdown}
                disabled={paused}
                onSubscribe={story.is_self ? undefined : handleCountdownSubscribe}
              />
            ) : null}

            {storyPoll ? (
              <StoryPollVoteCard poll={storyPoll} disabled={paused} onVote={handlePollVote} />
            ) : null}

            {storyQuestion ? (
              <Pressable
                disabled={!story.is_self}
                onPress={() => story.is_self && setQuestionAnswersVisible(true)}
              >
                <StoryQuestionCard
                  question={storyQuestion}
                  isOwner={story.is_self}
                  disabled={paused}
                  onSubmitAnswer={story.is_self ? undefined : handleQuestionAnswer}
                />
              </Pressable>
            ) : null}

            {story.is_self && (challengeJoins.length > 0 || challengePrompt) ? (
              <StoryChallengeAccepts prompt={challengePrompt} joins={challengeJoins} />
            ) : null}

            {hasTrainingChallenge && !story.is_self ? (
              <Pressable
                style={styles.challengeCta}
                onPress={() =>
                  onJoinChallenge?.(story.user_id, activeStoryId!, {
                    challengeId: currentDedicatedStory?.challenge_id ?? null,
                    trainingChallengeId: trainingChallenge?.id ?? null,
                  })
                }
              >
                <Text style={styles.challengeCtaText}>I'm In</Text>
              </Pressable>
            ) : null}

            {story.is_self && workoutCommitment && !workoutCommitment.completed_at && onMarkCommitmentComplete ? (
              <Pressable style={styles.viewersCta} onPress={() => onMarkCommitmentComplete()}>
                <Text style={styles.viewersCtaText}>Mark commitment complete</Text>
              </Pressable>
            ) : null}

            {canEngage ? (
              <View style={styles.engageStack}>
                {showReply && commentingEnabled ? (
                  <StoryReplyBar
                    disabled={paused}
                    compact
                    onCancel={() => setShowReply(false)}
                    onFocusChange={setInteractionLocked}
                    onSend={async (text) => {
                      await onReply?.(story.user_id, text, activeStoryId);
                      setShowReply(false);
                    }}
                  />
                ) : null}
                <StoryReactionRow
                  disabled={paused}
                  onReact={(emoji) =>
                    onReact?.(story.user_id, activeStoryId!, emoji, slideContext?.slideId ?? null)
                  }
                />
                <StoryQuickActionsBar
                  disabled={paused || showReply}
                  hasChallenge={hasTrainingChallenge}
                  inviteLoading={inviteLoading}
                  showMessage={commentingEnabled}
                  onMessage={() => setShowReply(true)}
                  onInviteWorkout={() =>
                    onInviteToTrain?.(story.user_id, currentDedicatedStory?.post_id ?? null)
                  }
                  onInviteEvent={() =>
                    activeStoryId && onInviteToEvent?.(story.user_id, activeStoryId)
                  }
                  onJoinChallenge={() =>
                    activeStoryId &&
                    onJoinChallenge?.(story.user_id, activeStoryId, {
                      challengeId: currentDedicatedStory?.challenge_id ?? null,
                      trainingChallengeId: trainingChallenge?.id ?? null,
                    })
                  }
                  onViewProfile={() =>
                    onViewProfileFromStory?.(story.user_id, story.profile.username) ??
                    onViewProfile?.(story.profile.username)
                  }
                />
              </View>
            ) : null}
          </View>

          <View style={styles.tapZones} pointerEvents={controlsOpen ? "none" : "box-none"}>
            <Pressable
              style={styles.tapZoneLeft}
              onPress={() => tryNavigate(handleLeftTap)}
              onPressIn={beginHold}
              onPressOut={endHold}
              accessibilityRole="button"
              accessibilityLabel="Previous story slide or restart"
              accessibilityHint="On the first slide, restarts the story from the beginning."
            />
            <Pressable
              style={styles.tapZoneCenter}
              onPressIn={beginHold}
              onPressOut={endHold}
              accessibilityRole="button"
              accessibilityLabel="Pause story"
              accessibilityHint="Press and hold to pause playback."
            />
            <Pressable
              style={styles.tapZoneRight}
              onPress={() => tryNavigate(goNext)}
              onPressIn={beginHold}
              onPressOut={endHold}
              accessibilityRole="button"
              accessibilityLabel="Next story slide"
            />
          </View>
        </Animated.View>
        {statusMessage ? (
          <View style={styles.statusToast} pointerEvents="none">
            <Text style={styles.statusToastText}>{statusMessage}</Text>
          </View>
        ) : null}
      </View>
      <StoryControlsSheet
        visible={controlsOpen && story.is_self}
        story={currentDedicatedStory}
        mediaType={
          activeSlide?.kind === "media"
            ? activeSlide.mediaKind === "video"
              ? "video"
              : "photo"
            : null
        }
        mediaUrl={activeSlide?.kind === "media" ? activeSlide.url : null}
        userId={session?.user.id ?? ""}
        onClose={() => {
          setControlsOpen(false);
          setPaused(false);
        }}
        onUpdated={handleControlsUpdated}
        onDeleted={handleControlsDeleted}
        onSaveResult={(result, kind) => {
          if (result === "shared") {
            showStatus(
              kind === "video"
                ? "Use Save Video in the share sheet."
                : "Use Save Image in the share sheet."
            );
            return;
          }
          showStatus(kind === "video" ? "Video saved." : "Photo saved.");
        }}
      />
      <StoryQuestionAnswersModal
        visible={questionAnswersVisible}
        answers={questionAnswers}
        loading={questionAnswersLoading}
        onClose={() => setQuestionAnswersVisible(false)}
        onShareAnswer={handleShareQuestionAnswer}
      />
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
  engageStack: {
    gap: spacing.sm,
  },
  mediaStage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
  mediaStatus: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    backgroundColor: "rgba(0, 0, 0, 0.28)",
  },
  loaderMark: {
    opacity: 0.72,
  },
  loaderLabel: {
    ...typography.caption,
    color: "rgba(255,255,255,0.62)",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  failTitle: {
    ...typography.title,
    color: colors.text,
    textAlign: "center",
  },
  failBody: {
    ...typography.body,
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
  },
  failActions: {
    marginTop: spacing.sm,
    width: "100%",
    maxWidth: 280,
    gap: spacing.sm,
  },
  scrimTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: "rgba(10, 10, 11, 0.55)",
    zIndex: 1,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    zIndex: 5,
  },
  footer: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: 0,
    zIndex: 4,
    gap: spacing.xs,
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
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10, 10, 11, 0.82)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.88)",
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0 2px 12px rgba(0,0,0,0.45)" } as object)
      : null),
  },
  closeIcon: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 22,
    fontWeight: "800",
  },
  statusToast: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: 120,
    alignItems: "center",
  },
  statusToastText: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "700",
    backgroundColor: "rgba(10, 10, 11, 0.92)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    overflow: "hidden",
  },
  compactWorkoutMeta: {
    gap: 4,
  },
  compactWorkoutText: {
    ...typography.caption,
    color: "rgba(255,255,255,0.82)",
    fontWeight: "600",
  },
  captionText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  captionBlock: {
    gap: 2,
    marginBottom: spacing.xs,
  },
  captionMore: {
    ...typography.caption,
    color: "rgba(255,255,255,0.72)",
    fontWeight: "700",
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
    bottom: 180,
    flexDirection: "row",
    zIndex: 3,
  },
  tapZoneLeft: {
    width: `${TAP_ZONE_SIDE_RATIO * 100}%`,
    height: "100%",
    ...(Platform.OS === "web"
      ? ({
          cursor: "default",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
        } as object)
      : null),
  },
  tapZoneCenter: {
    flex: 1,
    height: "100%",
    ...(Platform.OS === "web"
      ? ({
          cursor: "default",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
        } as object)
      : null),
  },
  tapZoneRight: {
    width: `${TAP_ZONE_SIDE_RATIO * 100}%`,
    height: "100%",
    ...(Platform.OS === "web"
      ? ({
          cursor: "default",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
        } as object)
      : null),
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
  workoutTitle: {
    ...typography.heading,
    color: colors.text,
    fontWeight: "800",
    marginBottom: spacing.md,
    textAlign: "center",
  },
  workoutMetric: {
    ...typography.body,
    color: colors.text,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  workoutLocation: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  workoutTag: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: "700",
  },
  locationTag: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "600",
  },
  challengeCta: {
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  challengeCtaText: {
    ...typography.bodySmall,
    color: colors.white,
    fontWeight: "800",
  },
  viewersCta: {
    alignSelf: "flex-start",
    paddingVertical: spacing.xs,
  },
  viewersCtaText: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: "700",
  },
});
