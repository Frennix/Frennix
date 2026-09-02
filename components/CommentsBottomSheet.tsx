import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { createPortal } from "react-dom";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BOTTOM_SHEET_DISMISS_DRAG_THRESHOLD,
  BOTTOM_SHEET_MIN_BACKDROP_DISMISS_MS,
  BOTTOM_SHEET_SPRING_DISMISS,
  BOTTOM_SHEET_SPRING_OPEN,
  BOTTOM_SHEET_SPRING_REBOUND,
} from "@/components/BottomActionSheet";
import { setCommentsOverlayOpen, setCommentsVideoPeekLayout } from "@/lib/comments-overlay-state";
import {
  logCommentsCloseRequest,
  logCommentsPortalInteraction,
  type CommentsCloseReason,
} from "@/lib/comments-close-diagnostics";
import {
  isMobileWeb,
  measureSafariVisualViewport,
  readVisualViewportHeight,
  requestSafariVisualViewportRemeasure,
  subscribeSafariVisualViewport,
} from "@/lib/safari-visual-viewport";
import { lockWebModalScroll, restoreWebDocumentScrollLock, unlockWebModalScroll } from "@/lib/web-modal-scroll-lock";
import { OVERLAY_Z_INDEX } from "@/lib/overlay-z-index";
import { colors, radius, spacing, touchTarget, typography } from "@frennix/ui";

const COMMENTS_SHEET_Z_INDEX = OVERLAY_Z_INDEX.commentsSheet;
const SHEET_OPEN_RATIO = 0.7;
const SHEET_MAX_RATIO = 0.75;
/** Fraction of layout viewport used to seed the baseline preview before keyboard focus. */
export const COMMENTS_VIDEO_PEEK_FRACTION = 0.31;
const VIDEO_PEEK_FRACTION = COMMENTS_VIDEO_PEEK_FRACTION;
/** Target preview band on large phones — preserved while typing when space allows. */
export const COMMENTS_VIDEO_PEEK_TARGET_MIN_PX = 330;
export const COMMENTS_VIDEO_PEEK_TARGET_MAX_PX = 400;
/** Never let keyboard/sheet layout shrink the preview below ~25% of layout height. */
const VIDEO_PEEK_MIN_LAYOUT_FRACTION = 0.25;
const VIDEO_PEEK_ABSOLUTE_MIN_PX = 112;
/** Minimum sheet chrome (handle, header, composer) above the keyboard. */
const VIDEO_SHEET_MIN_CHROME_PX = 88;

export type CommentsSheetPresentation = "fullscreen" | "videoOverlay";

type VideoOverlaySheetLayout = {
  /** Layout viewport Y where the visible region starts (Safari keyboard scroll). */
  offsetTop: number;
  /** Height of the visible region above the keyboard. */
  visualHeight: number;
  /** Fixed reserved height for the full video preview. */
  peekHeight: number;
  /** Sheet top within the visual viewport overlay root. */
  top: number;
  /** Remaining height for comments list + composer above the keyboard. */
  height: number;
};

/** Baseline preview height from the full layout viewport — not keyboard-reduced visual height. */
export function computeBaselineVideoPeekHeight(layoutHeight: number): number {
  const fromFraction = Math.round(layoutHeight * VIDEO_PEEK_FRACTION);
  const layoutTargetMin = Math.round(layoutHeight * 0.38);
  const targetMin = Math.min(
    COMMENTS_VIDEO_PEEK_TARGET_MAX_PX,
    Math.max(COMMENTS_VIDEO_PEEK_TARGET_MIN_PX, layoutTargetMin)
  );
  const targetMax = Math.min(
    COMMENTS_VIDEO_PEEK_TARGET_MAX_PX,
    Math.round(layoutHeight * 0.46)
  );
  return Math.min(targetMax, Math.max(fromFraction, targetMin));
}

function resolveVideoPeekHeight(
  layoutHeight: number,
  visualHeight: number,
  baselinePeekHeight: number
): number {
  const layoutFloor = Math.round(layoutHeight * VIDEO_PEEK_MIN_LAYOUT_FRACTION);
  const absoluteMin = Math.min(VIDEO_PEEK_ABSOLUTE_MIN_PX, layoutFloor);
  const maxPeekForVisible = Math.max(absoluteMin, visualHeight - VIDEO_SHEET_MIN_CHROME_PX);
  return Math.min(baselinePeekHeight, maxPeekForVisible);
}

function computeVideoOverlaySheetLayout(baselinePeekHeight: number | null): VideoOverlaySheetLayout {
  const layoutHeight = typeof window !== "undefined" ? window.innerHeight : 640;
  const { offsetTop, visualHeight } = measureSafariVisualViewport();
  const baselinePeek =
    baselinePeekHeight ?? computeBaselineVideoPeekHeight(layoutHeight);
  const peekHeight = resolveVideoPeekHeight(layoutHeight, visualHeight, baselinePeek);
  const top = peekHeight;
  const height = Math.max(0, visualHeight - peekHeight);
  return { offsetTop, visualHeight, peekHeight, top, height };
}

type CommentsBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** When set, blocks inline feed composers for this post while open. */
  postId?: string | null;
  /** Scrollable comments list — only this region scrolls. */
  children: ReactNode;
  /** Fixed composer row rendered above the safe-area inset. */
  composer: ReactNode;
  backdropAccessibilityLabel?: string;
  /** Mobile web fullscreen vs video-route overlay that preserves a video peek region. */
  presentation?: CommentsSheetPresentation;
};

const useMobileWebFullscreen = Platform.OS === "web" && isMobileWeb();

function blurActiveWebInput(): void {
  if (typeof document === "undefined") return;
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
}

const WEB_DESKTOP_OVERLAY_ROOT: ViewStyle = Platform.select({
  web: {
    position: "fixed",
    left: 0,
    right: 0,
    top: 0,
    width: "100%",
    height: "100%",
    zIndex: COMMENTS_SHEET_Z_INDEX,
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    overflow: "hidden",
    touchAction: "none",
  },
  default: {
    flex: 1,
    justifyContent: "flex-end",
  },
}) as ViewStyle;

const WEB_MOBILE_FULLSCREEN_ROOT: ViewStyle = Platform.select({
  web: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    width: "100%",
    zIndex: COMMENTS_SHEET_Z_INDEX,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    backgroundColor: colors.background,
    touchAction: "none",
  },
  default: {},
}) as ViewStyle;

const WEB_MOBILE_VIDEO_OVERLAY_ROOT: ViewStyle = Platform.select({
  web: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    zIndex: COMMENTS_SHEET_Z_INDEX,
    pointerEvents: "box-none",
    touchAction: "none",
  },
  default: {},
}) as ViewStyle;

function stopPointerEventPropagation(event: Event): void {
  event.stopPropagation();
}

function stopReactPropagation(event: { stopPropagation?: () => void }): void {
  event.stopPropagation?.();
}

export function CommentsBottomSheet({
  visible,
  onClose,
  title,
  postId = null,
  children,
  composer,
  backdropAccessibilityLabel = "Close comments",
  presentation = "fullscreen",
}: CommentsBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const dismissingRef = useRef(false);
  const openedAtRef = useRef(0);
  const useVideoOverlay = presentation === "videoOverlay";
  const videoPeekBaselineRef = useRef<number | null>(null);
  const [viewportHeight, setViewportHeight] = useState(() =>
    Platform.OS === "web" ? readVisualViewportHeight() : 0
  );
  const [videoOverlayLayout, setVideoOverlayLayout] = useState<VideoOverlaySheetLayout>(() =>
    computeVideoOverlaySheetLayout(null)
  );

  useEffect(() => {
    if (!visible || !useVideoOverlay) {
      videoPeekBaselineRef.current = null;
    }
  }, [useVideoOverlay, visible]);

  useEffect(() => {
    if (!visible || Platform.OS !== "web" || !useMobileWebFullscreen || typeof window === "undefined") {
      return;
    }

    const syncHeight = () => {
      if (useVideoOverlay) {
        if (videoPeekBaselineRef.current == null) {
          videoPeekBaselineRef.current = computeBaselineVideoPeekHeight(window.innerHeight);
        }
        setVideoOverlayLayout(
          computeVideoOverlaySheetLayout(videoPeekBaselineRef.current)
        );
        return;
      }
      setViewportHeight(readVisualViewportHeight());
    };
    syncHeight();
    return subscribeSafariVisualViewport(syncHeight);
  }, [useVideoOverlay, visible]);

  useLayoutEffect(() => {
    if (!visible || !useVideoOverlay) {
      setCommentsVideoPeekLayout(null);
      return;
    }
    setCommentsVideoPeekLayout({
      height: videoOverlayLayout.peekHeight,
      offsetTop: videoOverlayLayout.offsetTop,
    });
  }, [
    useVideoOverlay,
    videoOverlayLayout.offsetTop,
    videoOverlayLayout.peekHeight,
    visible,
  ]);

  useEffect(() => {
    if (!visible || useMobileWebFullscreen) {
      if (!visible) {
        slide.setValue(0);
        fade.setValue(0);
        dragY.setValue(0);
        dismissingRef.current = false;
      }
      return;
    }

    slide.setValue(0);
    fade.setValue(0);
    dragY.setValue(0);
    openedAtRef.current = Date.now();
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 1, useNativeDriver: true, ...BOTTOM_SHEET_SPRING_OPEN }),
    ]).start();
  }, [dragY, fade, slide, visible]);

  useEffect(() => {
    if (!visible) return;

    setCommentsOverlayOpen(true, postId);
    if (Platform.OS === "web") lockWebModalScroll();
    logCommentsPortalInteraction("portal-open");

    return () => {
      logCommentsCloseRequest("CommentsBottomSheet.cleanup", "component-cleanup");
      setCommentsOverlayOpen(false);
      if (Platform.OS === "web") {
        unlockWebModalScroll();
        restoreWebDocumentScrollLock();
        requestSafariVisualViewportRemeasure();
      }
      logCommentsPortalInteraction("portal-cleanup");
    };
  }, [postId, visible]);

  useEffect(() => {
    if (!visible || Platform.OS !== "web" || typeof document === "undefined") return;

    let portal: Element | null = null;
    let detach: (() => void) | undefined;

    const attach = () => {
      portal = document.querySelector('[data-frennix-comments-sheet="true"]');
      if (!portal) return;

      const events = ["pointerdown", "pointerup", "click", "touchstart", "touchend"] as const;
      events.forEach((eventName) => {
        portal!.addEventListener(eventName, stopPointerEventPropagation, true);
      });

      const onFocusIn = (event: FocusEvent) => {
        if (!portal!.contains(event.target as Node)) return;
        logCommentsPortalInteraction("composer-focus-in");
      };
      portal.addEventListener("focusin", onFocusIn, true);

      detach = () => {
        events.forEach((eventName) => {
          portal?.removeEventListener(eventName, stopPointerEventPropagation, true);
        });
        portal?.removeEventListener("focusin", onFocusIn, true);
      };
    };

    attach();
    const frame = portal ? undefined : requestAnimationFrame(attach);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      detach?.();
    };
  }, [visible]);

  const requestClose = useCallback(
    (reason: CommentsCloseReason) => {
      logCommentsCloseRequest("CommentsBottomSheet.requestClose", reason);
      if (Platform.OS === "web") blurActiveWebInput();
      onClose();
    },
    [onClose]
  );

  const finishClose = useCallback(
    (reason: CommentsCloseReason) => {
      requestClose(reason);
    },
    [requestClose]
  );

  const handleDismiss = useCallback(() => {
    if (useMobileWebFullscreen) {
      finishClose("close-button");
      return;
    }

    if (dismissingRef.current) return;
    dismissingRef.current = true;
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, ...BOTTOM_SHEET_SPRING_DISMISS }),
      Animated.spring(dragY, { toValue: 0, useNativeDriver: true, ...BOTTOM_SHEET_SPRING_DISMISS }),
    ]).start(({ finished }) => {
      if (finished) finishClose("close-button");
      dismissingRef.current = false;
    });
  }, [dragY, fade, finishClose, slide]);

  const handleBackdropPress = useCallback(() => {
    if (Date.now() - openedAtRef.current < BOTTOM_SHEET_MIN_BACKDROP_DISMISS_MS) return;
    finishClose("backdrop-click");
  }, [finishClose]);

  const handleWebBackdropClick = useCallback(
    (event: { target?: EventTarget | null; currentTarget?: EventTarget | null; stopPropagation?: () => void }) => {
      event.stopPropagation?.();
      if (event.target !== event.currentTarget) return;
      handleBackdropPress();
    },
    [handleBackdropPress]
  );

  const headerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.2,
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy > 0) dragY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > BOTTOM_SHEET_DISMISS_DRAG_THRESHOLD || gesture.vy > 0.75) {
            finishClose("swipe-dismiss");
            return;
          }
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            ...BOTTOM_SHEET_SPRING_REBOUND,
          }).start();
        },
      }),
    [dragY, handleDismiss]
  );

  const desktopSheetHeight = useMemo(() => {
    if (Platform.OS !== "web" || useMobileWebFullscreen) return undefined;
    const layoutHeight = typeof window !== "undefined" ? window.innerHeight : 640;
    const target = Math.round(layoutHeight * SHEET_OPEN_RATIO);
    const max = Math.round(layoutHeight * SHEET_MAX_RATIO);
    return Math.min(Math.max(target, 280), max);
  }, [visible]);

  const openOffset = desktopSheetHeight ?? 420;
  const translateY = Animated.add(
    slide.interpolate({
      inputRange: [0, 1],
      outputRange: [openOffset, 0],
    }),
    dragY
  );

  const composerBottomInset = Math.max(insets.bottom, spacing.sm);
  const headerTopInset = Math.max(insets.top, spacing.sm);

  if (!visible) return null;

  const sheetSurfaceProps =
    Platform.OS === "web"
      ? ({
          onClick: stopReactPropagation,
          onPointerDown: stopReactPropagation,
          onPointerUp: stopReactPropagation,
          onTouchStart: stopReactPropagation,
          onTouchEnd: stopReactPropagation,
        } as object)
      : null;

  const headerRow = (
    <View
      style={[
        styles.headerRow,
        useMobileWebFullscreen && styles.mobileWebHeader,
        useVideoOverlay && styles.headerRowVideoOverlay,
      ]}
      {...sheetSurfaceProps}
    >
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <Pressable
        onPress={handleDismiss}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Close comments"
        style={styles.closeButton}
      >
        <Text style={styles.closeIcon}>✕</Text>
      </Pressable>
    </View>
  );

  const listRegion = (
    <ScrollView
      style={styles.listScroll}
      contentContainerStyle={[
        styles.listContent,
        useVideoOverlay ? styles.listContentVideoOverlay : null,
      ]}
      keyboardShouldPersistTaps="always"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      {...sheetSurfaceProps}
    >
      {children}
    </ScrollView>
  );

  const composerRegion = (
    <View
      style={[styles.composerHost, useVideoOverlay ? styles.composerHostVideoOverlay : null]}
      {...sheetSurfaceProps}
    >
      {composer}
    </View>
  );

  const mobileWebSurface = (
    <View
      style={[WEB_MOBILE_FULLSCREEN_ROOT, { height: viewportHeight, paddingTop: headerTopInset }]}
      {...sheetSurfaceProps}
      {...(Platform.OS === "web"
        ? ({
            "data-frennix-comments-sheet": "true",
            "data-frennix-comments-fullscreen": "true",
          } as object)
        : null)}
    >
      {headerRow}
      {listRegion}
      {composerRegion}
    </View>
  );

  const mobileVideoOverlaySurface = (
    <View
      style={[
        WEB_MOBILE_VIDEO_OVERLAY_ROOT,
        {
          top: videoOverlayLayout.offsetTop,
          height: videoOverlayLayout.visualHeight,
          bottom: undefined,
        },
      ]}
      {...(Platform.OS === "web"
        ? ({
            "data-frennix-comments-sheet": "true",
            "data-frennix-comments-video-overlay": "true",
          } as object)
        : null)}
    >
      <Pressable
        style={[styles.videoPeekDismiss, { height: videoOverlayLayout.peekHeight }]}
        onPress={handleBackdropPress}
        {...(Platform.OS === "web"
          ? ({
              onClick: handleWebBackdropClick,
            } as object)
          : null)}
        accessibilityRole="button"
        accessibilityLabel={backdropAccessibilityLabel}
      />
      <View
        style={[styles.videoOverlayColumn, { top: videoOverlayLayout.peekHeight }]}
      >
        <View
          style={[styles.sheet, styles.videoOverlaySheetBody]}
          {...sheetSurfaceProps}
        >
          <View
            style={[styles.handleWrap, useVideoOverlay ? styles.handleWrapVideoOverlay : null]}
            {...headerPanResponder.panHandlers}
          >
            <View style={styles.handle} />
          </View>
          <View {...headerPanResponder.panHandlers}>{headerRow}</View>
          {listRegion}
        </View>
        <View
          style={[
            styles.composerHost,
            styles.composerHostVideoOverlay,
            { paddingBottom: Math.max(insets.bottom, spacing.xxs) },
          ]}
          {...sheetSurfaceProps}
        >
          {composer}
        </View>
      </View>
    </View>
  );

  const desktopWebSurface = (
    <View
      style={WEB_DESKTOP_OVERLAY_ROOT}
      {...(Platform.OS === "web" ? ({ "data-frennix-comments-sheet": "true" } as object) : null)}
    >
      <Pressable
        style={styles.backdropPressable}
        onPress={handleBackdropPress}
        {...(Platform.OS === "web"
          ? ({
              onClick: handleWebBackdropClick,
            } as object)
          : null)}
        accessibilityRole="button"
        accessibilityLabel={backdropAccessibilityLabel}
      >
        <Animated.View style={[styles.backdrop, { opacity: fade }]} pointerEvents="none" />
      </Pressable>

      <Animated.View
        style={[
          styles.sheet,
          {
            height: desktopSheetHeight ?? ("70%" as const),
            maxHeight: "75%" as const,
            paddingBottom: composerBottomInset,
            transform: [{ translateY }],
          },
        ]}
        {...sheetSurfaceProps}
      >
        <View style={styles.handleWrap} {...headerPanResponder.panHandlers}>
          <View style={styles.handle} />
        </View>

        <View {...headerPanResponder.panHandlers}>{headerRow}</View>
        {listRegion}
        {composerRegion}
      </Animated.View>
    </View>
  );

  const nativeSurface = (
    <View style={styles.nativeRoot}>
      <Pressable
        style={styles.backdropPressable}
        onPress={handleBackdropPress}
        {...(Platform.OS === "web"
          ? ({
              onClick: handleWebBackdropClick,
            } as object)
          : null)}
        accessibilityRole="button"
        accessibilityLabel={backdropAccessibilityLabel}
      >
        <Animated.View style={[styles.backdrop, { opacity: fade }]} pointerEvents="none" />
      </Pressable>

      <Animated.View
        style={[
          styles.sheet,
          {
            height: "70%" as const,
            maxHeight: "75%" as const,
            paddingBottom: composerBottomInset,
            transform: [{ translateY }],
          },
        ]}
        {...sheetSurfaceProps}
      >
        <View style={styles.handleWrap} {...headerPanResponder.panHandlers}>
          <View style={styles.handle} />
        </View>

        <View {...headerPanResponder.panHandlers}>{headerRow}</View>
        {listRegion}
        {composerRegion}
      </Animated.View>
    </View>
  );

  const surface = useMobileWebFullscreen
    ? useVideoOverlay
      ? mobileVideoOverlaySurface
      : mobileWebSurface
    : Platform.OS === "web"
      ? desktopWebSurface
      : nativeSurface;

  if (Platform.OS === "web" && typeof document !== "undefined") {
    return createPortal(surface, document.body);
  }

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      {surface}
    </Modal>
  );
}

const SHEET_TOP_RADIUS = radius.lg + 8;

const styles = StyleSheet.create({
  nativeRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 10, 11, 0.82)",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: SHEET_TOP_RADIUS,
    borderTopRightRadius: SHEET_TOP_RADIUS,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderBottomWidth: 0,
    width: "100%",
    overflow: "hidden",
    flexDirection: "column",
    ...(Platform.OS === "web"
      ? ({
          boxShadow: "0 -12px 40px rgba(0, 0, 0, 0.5)",
        } as object)
      : null),
  },
  videoOverlaySheet: Platform.select({
    web: {
      position: "absolute",
      left: 0,
      right: 0,
      flexShrink: 0,
      maxHeight: "100%",
    },
    default: {},
  }) as ViewStyle,
  videoOverlayColumn: Platform.select({
    web: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: "column",
      paddingTop: 6,
      width: "100%",
      maxWidth: "100%",
      overflow: "hidden",
      boxSizing: "border-box",
    },
    default: {},
  }) as ViewStyle,
  videoOverlaySheetBody: {
    flex: 1,
    minHeight: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  videoPeekDismiss: Platform.select({
    web: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      pointerEvents: "auto",
      backgroundColor: "transparent",
    },
    default: {},
  }) as ViewStyle,
  mobileWebHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingTop: 0,
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxs,
    minHeight: touchTarget / 2,
    justifyContent: "center",
  },
  handleWrapVideoOverlay: {
    paddingTop: spacing.xs,
    paddingBottom: 2,
    minHeight: 24,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: "rgba(255, 255, 255, 0.32)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    flexShrink: 0,
  },
  headerRowVideoOverlay: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
  },
  title: {
    ...typography.heading,
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
  },
  closeIcon: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 16,
  },
  listScroll: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.background,
    ...(Platform.OS === "web"
      ? ({
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-y",
        } as object)
      : null),
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    flexGrow: 1,
  },
  listContentVideoOverlay: {
    flexGrow: 0,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  composerHost: {
    flexShrink: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  composerHostVideoOverlay: {
    flexShrink: 0,
    width: "100%",
    maxWidth: "100%",
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    ...(Platform.OS === "web"
      ? ({
          boxSizing: "border-box",
          overflow: "hidden",
        } as const)
      : null),
  },
});
