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
  requestSafariVisualViewportRemeasure,
  subscribeSafariVisualViewport,
  type SafariVisualViewportSnapshot,
} from "@/lib/safari-visual-viewport";
import { lockWebModalScroll, restoreWebDocumentScrollLock, unlockWebModalScroll } from "@/lib/web-modal-scroll-lock";
import { useCommentComposerHostBottomInset, useCommentsOverlayBottomReserve } from "@/lib/use-comment-composer-host-inset";
import { useVideoOverlayPortaledComposerReserve } from "@/lib/use-video-overlay-portaled-composer-reserve";
import {
  measureVideoOverlayViewportFrame,
  resolveVideoOverlayVisibleGeometry,
  type VideoOverlayViewportFrame,
} from "@/lib/video-overlay-visual-viewport-layout";
import {
  computeBaselineVideoPeekHeight,
  COMMENTS_VIDEO_PEEK_FRACTION,
  COMMENTS_VIDEO_PEEK_TARGET_MIN_PX,
  COMMENTS_VIDEO_PEEK_TARGET_MAX_PX,
} from "@/lib/video-overlay-peek-geometry";
import {
  captureImmersiveSessionLayoutHeight,
  getImmersiveSessionLayoutHeight,
  getImmersiveSessionPeekHeight,
} from "@/lib/immersive-session-layout";
import { logCommentsSheetRuntimeDiagnostics } from "@/lib/comments-sheet-runtime-diagnostics";
import { OVERLAY_Z_INDEX } from "@/lib/overlay-z-index";
import { colors, radius, spacing, touchTarget, typography } from "@frennix/ui";

const COMMENTS_SHEET_Z_INDEX = OVERLAY_Z_INDEX.commentsSheet;
const COMMENTS_VIDEO_OVERLAY_Z_INDEX = OVERLAY_Z_INDEX.commentsVideoOverlay;
const SHEET_OPEN_RATIO = 0.7;
const SHEET_MAX_RATIO = 0.75;

export {
  computeBaselineVideoPeekHeight,
  COMMENTS_VIDEO_PEEK_FRACTION,
  COMMENTS_VIDEO_PEEK_TARGET_MIN_PX,
  COMMENTS_VIDEO_PEEK_TARGET_MAX_PX,
};

export type CommentsSheetPresentation = "fullscreen" | "videoOverlay";

type VideoOverlaySheetLayout = {
  /** Always 0 — overlay is a full visual-viewport layer. */
  offsetTop: number;
  visualHeight: number;
  peekHeight: number;
  /** Sheet top inside the overlay. Equal to peekHeight. */
  top: number;
  /** visualHeight - peekHeight. Never the full visual height. */
  height: number;
};

function computeVideoOverlaySheetLayout(
  overlayViewport: VideoOverlayViewportFrame | null,
  composerBottomReserve = 0
): VideoOverlaySheetLayout {
  const frame = overlayViewport ?? measureVideoOverlayViewportFrame();
  const sessionLayoutHeight = getImmersiveSessionLayoutHeight();
  const layoutHeight = sessionLayoutHeight ?? frame.layoutHeight;
  const baselinePeek =
    getImmersiveSessionPeekHeight() ?? computeBaselineVideoPeekHeight(layoutHeight);
  const geometry = resolveVideoOverlayVisibleGeometry({
    layoutHeight,
    usableHeight: frame.visualHeight,
    baselinePeekHeight: baselinePeek,
    composerBottomReserve,
    keyboardOpen: frame.keyboardOpen,
  });

  return {
    offsetTop: 0,
    visualHeight: geometry.visibleHeight,
    peekHeight: geometry.peekHeight,
    top: geometry.sheetTop,
    height: geometry.sheetHeight,
  };
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
  /** Web video overlay: hide inline composer while the portaled composer is active. */
  suppressInlineComposer?: boolean;
};

const isMobileWebFullscreenMode = () => Platform.OS === "web" && isMobileWeb();

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
    touchAction: "manipulation",
  },
  default: {
    flex: 1,
    justifyContent: "flex-end",
  },
}) as ViewStyle;

const WEB_MOBILE_FULLSCREEN_ROOT: ViewStyle = Platform.select({
  web: {
    position: "fixed",
    left: 0,
    right: 0,
    width: "100%",
    zIndex: COMMENTS_SHEET_Z_INDEX,
    display: "flex",
    flexDirection: "column",
    backgroundColor: colors.background,
    touchAction: "manipulation",
  },
  default: {},
}) as ViewStyle;

const WEB_MOBILE_VIDEO_OVERLAY_ROOT: ViewStyle = Platform.select({
  web: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: "auto",
    width: "100%",
    zIndex: COMMENTS_VIDEO_OVERLAY_Z_INDEX,
    display: "flex",
    flexDirection: "column",
    pointerEvents: "auto",
    touchAction: "manipulation",
    backgroundColor: "transparent",
    overflow: "visible",
  },
  default: {},
}) as ViewStyle;

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
  suppressInlineComposer = false,
}: CommentsBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const dismissingRef = useRef(false);
  const openedAtRef = useRef(0);
  const useVideoOverlay = presentation === "videoOverlay";
  const suppressWebVideoInlineComposer = suppressInlineComposer;
  const portaledComposerReserve = useVideoOverlayPortaledComposerReserve(
    visible && Platform.OS === "web" && suppressWebVideoInlineComposer
  );
  const [mobileViewport, setMobileViewport] = useState<SafariVisualViewportSnapshot | null>(() =>
    Platform.OS === "web" ? measureSafariVisualViewport() : null
  );
  const [overlayViewport, setOverlayViewport] = useState<VideoOverlayViewportFrame | null>(null);
  const videoOverlayLayout = useMemo(
    () =>
      computeVideoOverlaySheetLayout(
        overlayViewport,
        suppressWebVideoInlineComposer ? portaledComposerReserve : 0
      ),
    [
      overlayViewport,
      overlayViewport?.keyboardOpen,
      overlayViewport?.usableHeight,
      portaledComposerReserve,
      suppressWebVideoInlineComposer,
    ]
  );

  useEffect(() => {
    if (!visible || Platform.OS !== "web" || !isMobileWebFullscreenMode() || typeof window === "undefined") {
      return;
    }

    const syncHeight = () => {
      setMobileViewport(measureSafariVisualViewport());
    };
    syncHeight();
    return subscribeSafariVisualViewport(syncHeight);
  }, [useVideoOverlay, visible]);

  useLayoutEffect(() => {
    if (!visible || !useVideoOverlay || Platform.OS !== "web") {
      return;
    }
    const sampleOverlayViewport = () => {
      const frame = measureVideoOverlayViewportFrame();
      captureImmersiveSessionLayoutHeight(frame.layoutHeight, frame.keyboardOpen);
      setOverlayViewport(frame);
    };
    sampleOverlayViewport();
    return subscribeSafariVisualViewport(sampleOverlayViewport);
  }, [useVideoOverlay, visible]);

  useLayoutEffect(() => {
    if (!visible || Platform.OS !== "web" || !useVideoOverlay) return;
    const timers = [0, 80, 320].map((delay) =>
      window.setTimeout(() => {
        if (typeof __DEV__ !== "undefined" && !__DEV__) return;
        logCommentsSheetRuntimeDiagnostics("video-overlay-layout", {
          peekHeight: videoOverlayLayout.peekHeight,
          sheetHeight: videoOverlayLayout.height,
          sessionLayoutHeight: getImmersiveSessionLayoutHeight(),
          overlayHeight: overlayViewport?.visualHeight,
          sheetTop: videoOverlayLayout.top,
          sheetHeight: videoOverlayLayout.height,
          peekPlusSheet: videoOverlayLayout.peekHeight + videoOverlayLayout.height,
          keyboardOpen: overlayViewport?.keyboardOpen ?? false,
        });
      }, delay)
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [
    overlayViewport?.keyboardOpen,
    useVideoOverlay,
    videoOverlayLayout.height,
    videoOverlayLayout.peekHeight,
    visible,
  ]);

  useLayoutEffect(() => {
    if (!visible || !useVideoOverlay) {
      setCommentsVideoPeekLayout(null);
      return;
    }
    setCommentsVideoPeekLayout({
      height: videoOverlayLayout.peekHeight,
      offsetTop: 0,
    });
  }, [
    useVideoOverlay,
    videoOverlayLayout.offsetTop,
    videoOverlayLayout.peekHeight,
    visible,
  ]);

  useEffect(() => {
    if (!visible || isMobileWebFullscreenMode()) {
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
    if (isMobileWebFullscreenMode()) {
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
    if (Platform.OS !== "web" || isMobileWebFullscreenMode()) return undefined;
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

  const closedComposerBottomInset = Math.max(insets.bottom, spacing.sm);
  const overlayBottomReserve = useCommentsOverlayBottomReserve(
    visible && Platform.OS === "web" && isMobileWebFullscreenMode()
  );
  const composerHostBottomInset = useCommentComposerHostBottomInset(
    closedComposerBottomInset,
    visible && Platform.OS === "web" && !isMobileWebFullscreenMode() && !useVideoOverlay
  );
  const headerTopInset = Math.max(insets.top, spacing.sm);
  const mobileOverlayTop = mobileViewport?.offsetTop ?? 0;
  const mobileVisualHeight = mobileViewport?.visualHeight ?? 640;
  const mobileOverlayHeight = Math.max(180, mobileVisualHeight - overlayBottomReserve);
  const videoOverlayRootHeight =
    overlayViewport?.visualHeight ?? videoOverlayLayout.visualHeight;
  const videoOverlayComposerInset = overlayViewport?.keyboardOpen
    ? spacing.sm
    : Math.max(insets.bottom, spacing.sm);

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
        isMobileWebFullscreenMode() && styles.mobileWebHeader,
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
      style={[
        styles.listScroll,
        useVideoOverlay
          ? ({
              flex: 1,
              minHeight: 0,
              flexGrow: 1,
              flexShrink: 1,
              backgroundColor: colors.surface,
            } as ViewStyle)
          : null,
      ]}
      contentContainerStyle={[
        styles.listContent,
        useVideoOverlay ? styles.listContentVideoOverlay : null,
      ]}
      keyboardShouldPersistTaps="always"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      {...sheetSurfaceProps}
      {...(Platform.OS === "web"
        ? ({ "data-frennix-comments-list": "true" } as object)
        : null)}
    >
      {children}
    </ScrollView>
  );

  const composerRegion = suppressWebVideoInlineComposer ? null : (
    <View
      style={[
        styles.composerHost,
        useVideoOverlay ? styles.composerHostVideoOverlay : null,
      ]}
      {...sheetSurfaceProps}
      {...(Platform.OS === "web"
        ? ({ "data-frennix-comment-composer-host": "true" } as object)
        : null)}
    >
      {composer}
    </View>
  );

  const mobileWebSurface = (
    <View
      style={[
        WEB_MOBILE_FULLSCREEN_ROOT,
        {
          top: mobileOverlayTop,
          height: mobileOverlayHeight,
          maxHeight: mobileOverlayHeight,
          paddingTop: headerTopInset,
        },
      ]}
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
          top: 0,
          bottom: "auto",
          height: videoOverlayRootHeight,
          maxHeight: videoOverlayRootHeight,
          ["--frennix-visible-height" as string]: `${videoOverlayRootHeight}px`,
        } as ViewStyle,
      ]}
      {...(Platform.OS === "web"
        ? ({
            "data-frennix-comments-sheet": "true",
            "data-frennix-comments-video-overlay": "true",
          } as object)
        : null)}
    >
      <Pressable
        style={[
          styles.videoPeekDismiss,
          {
            height: videoOverlayLayout.peekHeight,
            flexGrow: 0,
            flexShrink: 0,
          },
        ]}
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
        style={[
          styles.sheet,
          styles.videoOverlaySheetColumn,
          {
            flexGrow: 1,
            flexShrink: 1,
            minHeight: 0,
            height: videoOverlayLayout.height,
            maxHeight: videoOverlayLayout.height,
          },
        ]}
        {...sheetSurfaceProps}
        {...(Platform.OS === "web"
          ? ({ "data-frennix-comments-sheet-surface": "true" } as object)
          : null)}
      >
        <View
          style={[styles.handleWrap, styles.handleWrapVideoOverlay]}
          {...headerPanResponder.panHandlers}
          {...(Platform.OS === "web"
            ? ({ "data-frennix-comments-sheet-header": "true" } as object)
            : null)}
        >
          <View style={styles.handle} />
        </View>
        <View {...headerPanResponder.panHandlers}>{headerRow}</View>
        {Platform.OS === "web" ? (
          <div
            data-frennix-comments-sheet-body="true"
            data-frennix-comments-list="true"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              backgroundColor: colors.surface,
              position: "relative",
              zIndex: 1,
              pointerEvents: "auto",
            }}
          >
            {children}
          </div>
        ) : (
          listRegion
        )}
        <View
          style={[
            styles.composerHost,
            styles.composerHostVideoOverlay,
            {
              flexShrink: 0,
              flexGrow: 0,
              overflow: "visible",
              paddingBottom: videoOverlayComposerInset,
            },
          ]}
          {...sheetSurfaceProps}
          {...(Platform.OS === "web"
            ? ({ "data-frennix-comment-composer-host": "true" } as object)
            : null)}
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
            paddingBottom: composerHostBottomInset,
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
            paddingBottom: composerHostBottomInset,
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

  const surface =
    Platform.OS === "web" && useVideoOverlay
      ? mobileVideoOverlaySurface
      : isMobileWebFullscreenMode()
        ? mobileWebSurface
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
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
      paddingTop: 6,
      width: "100%",
      maxWidth: "100%",
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
  videoOverlaySheetColumn: {
    flex: 1,
    minHeight: 0,
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    pointerEvents: "auto",
    overflow: "hidden",
  },
  videoOverlayHeaderShell: {
    flexShrink: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  videoPeekDismiss: Platform.select({
    web: {
      position: "relative",
      flexGrow: 0,
      flexShrink: 0,
      width: "100%",
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
    flexGrow: 1,
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
        } as const)
      : null),
  },
});
