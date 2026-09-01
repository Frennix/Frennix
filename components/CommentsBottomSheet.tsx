import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { assertCommentsModalGeometry } from "@/lib/comments-keyboard-diagnostics";
import { setCommentsOverlayOpen } from "@/lib/comments-overlay-state";
import {
  computeClosedCommentsSheetHeight,
  useCommentsModalViewportGeometry,
} from "@/lib/comments-modal-viewport";
import { requestSafariVisualViewportRemeasure, subscribeSafariVisualViewport } from "@/lib/safari-visual-viewport";
import { lockWebModalScroll, restoreWebDocumentScrollLock, unlockWebModalScroll } from "@/lib/web-modal-scroll-lock";
import { OVERLAY_Z_INDEX } from "@/lib/overlay-z-index";
import { colors, radius, spacing, touchTarget, typography } from "@frennix/ui";

const COMMENTS_SHEET_Z_INDEX = OVERLAY_Z_INDEX.commentsSheet;

type CommentsBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  composer: ReactNode;
  backdropAccessibilityLabel?: string;
};

type PinnedBodyScroll = {
  scrollY: number;
  position: string;
  top: string;
  width: string;
  left: string;
  right: string;
};

let pinnedBodyScroll: PinnedBodyScroll | null = null;

/** Pin document scroll while comments are open — prevents Safari focus scroll from displacing the portal. */
function pinWebBodyScrollForComments(): void {
  if (typeof window === "undefined" || typeof document === "undefined" || pinnedBodyScroll) return;
  const scrollY = window.scrollY;
  pinnedBodyScroll = {
    scrollY,
    position: document.body.style.position,
    top: document.body.style.top,
    width: document.body.style.width,
    left: document.body.style.left,
    right: document.body.style.right,
  };
  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
}

function unpinWebBodyScrollForComments(): void {
  if (typeof window === "undefined" || typeof document === "undefined" || !pinnedBodyScroll) return;
  const { scrollY, position, top, width, left, right } = pinnedBodyScroll;
  document.body.style.position = position;
  document.body.style.top = top;
  document.body.style.width = width;
  document.body.style.left = left;
  document.body.style.right = right;
  window.scrollTo(0, scrollY);
  pinnedBodyScroll = null;
}

function CommentsListRegion({
  children,
}: {
  children: ReactNode;
}) {
  if (Platform.OS === "web") {
    return (
      <View style={styles.listScroll}>
        <View style={styles.listContent}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.listScroll}
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      {children}
    </ScrollView>
  );
}

function WebCommentsModalSurface({
  visible,
  onClose,
  title,
  children,
  composer,
  backdropAccessibilityLabel,
}: CommentsBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const dismissingRef = useRef(false);
  const openedAtRef = useRef(0);
  const baselineVisualHeightRef = useRef(0);
  const geometry = useCommentsModalViewportGeometry(visible);

  useEffect(() => {
    if (!visible) {
      baselineVisualHeightRef.current = 0;
      return;
    }
    baselineVisualHeightRef.current = geometry.viewportHeight;
  }, [geometry.viewportHeight, visible]);

  useEffect(() => {
    if (!visible || typeof document === "undefined") return;

    pinWebBodyScrollForComments();

    const preventFocusScroll = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.closest('[data-frennix-comment-composer="true"]')) return;
      if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA" && !target.isContentEditable) return;
      window.scrollTo(0, pinnedBodyScroll?.scrollY ?? 0);
    };

    const onViewportScroll = () => {
      window.scrollTo(0, pinnedBodyScroll?.scrollY ?? 0);
      requestAnimationFrame(() => assertCommentsModalGeometry("visualViewport-scroll"));
    };

    document.addEventListener("focusin", preventFocusScroll, true);
    window.visualViewport?.addEventListener("scroll", onViewportScroll);
    return () => {
      document.removeEventListener("focusin", preventFocusScroll, true);
      window.visualViewport?.removeEventListener("scroll", onViewportScroll);
      unpinWebBodyScrollForComments();
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    openedAtRef.current = Date.now();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    setCommentsOverlayOpen(true);
    lockWebModalScroll();
    return () => {
      setCommentsOverlayOpen(false);
      unlockWebModalScroll();
      restoreWebDocumentScrollLock();
      requestSafariVisualViewportRemeasure();
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const runAssertion = () => assertCommentsModalGeometry("viewport-update");
    runAssertion();
    return subscribeSafariVisualViewport(runAssertion);
  }, [visible]);

  const handleDismiss = useCallback(() => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    onClose();
    dismissingRef.current = false;
  }, [onClose]);

  const handleBackdropPress = useCallback(() => {
    if (Date.now() - openedAtRef.current < BOTTOM_SHEET_MIN_BACKDROP_DISMISS_MS) return;
    handleDismiss();
  }, [handleDismiss]);

  if (!visible) return null;

  const baseline =
    baselineVisualHeightRef.current || geometry.viewportHeight || (typeof window !== "undefined" ? window.innerHeight : 640);
  const closedSheetHeight = computeClosedCommentsSheetHeight(baseline);
  const keyboardOpen = geometry.keyboardOpen;
  const composerBottomPadding = keyboardOpen
    ? 0
    : Math.max(insets.bottom, spacing.sm);

  const overlayStyle: ViewStyle = {
    position: "fixed",
    top: geometry.viewportTop,
    left: 0,
    right: 0,
    width: "100%",
    height: geometry.viewportHeight,
    zIndex: COMMENTS_SHEET_Z_INDEX,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    touchAction: "none",
  };

  const sheetStyle: ViewStyle = {
    ...(keyboardOpen
      ? { flex: 1, minHeight: 0 }
      : { marginTop: "auto", height: closedSheetHeight, flexShrink: 0 }),
    width: "100%",
    flexDirection: "column",
    backgroundColor: colors.surface,
    borderTopLeftRadius: SHEET_TOP_RADIUS,
    borderTopRightRadius: SHEET_TOP_RADIUS,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08",
    borderBottomWidth: 0,
    overflow: "hidden",
    boxShadow: "0 -12px 40px rgba(0, 0, 0, 0.5)",
    touchAction: "none",
  };

  return createPortal(
    <View
      style={overlayStyle}
      {...({ "data-frennix-comments-sheet": "true" } as object)}
    >
      <Pressable
        style={styles.backdropPressable}
        onPress={handleBackdropPress}
        accessibilityRole="button"
        accessibilityLabel={backdropAccessibilityLabel}
      >
        <View style={styles.backdrop} />
      </Pressable>

      <View style={sheetStyle} {...({ "data-frennix-comments-sheet-panel": "true" } as object)}>
        <View style={styles.headerRow} {...({ "data-frennix-comments-header": "true" } as object)}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
          <View style={styles.headerTitleRow}>
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
        </View>

        <CommentsListRegion>{children}</CommentsListRegion>

        <View
          style={[styles.composerHost, { paddingBottom: composerBottomPadding }]}
          {...({ "data-frennix-comment-composer": "true" } as object)}
        >
          {composer}
        </View>
      </View>
    </View>,
    document.body
  );
}

function NativeCommentsModalSurface({
  visible,
  onClose,
  title,
  children,
  composer,
  backdropAccessibilityLabel = "Close comments",
}: CommentsBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const dismissingRef = useRef(false);
  const openedAtRef = useRef(0);

  useEffect(() => {
    if (!visible) {
      slide.setValue(0);
      fade.setValue(0);
      dragY.setValue(0);
      dismissingRef.current = false;
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
    setCommentsOverlayOpen(true);
    return () => setCommentsOverlayOpen(false);
  }, [visible]);

  const handleDismiss = useCallback(() => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, ...BOTTOM_SHEET_SPRING_DISMISS }),
      Animated.spring(dragY, { toValue: 0, useNativeDriver: true, ...BOTTOM_SHEET_SPRING_DISMISS }),
    ]).start(({ finished }) => {
      if (finished) onClose();
      dismissingRef.current = false;
    });
  }, [dragY, fade, onClose, slide]);

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
            handleDismiss();
            return;
          }
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true, ...BOTTOM_SHEET_SPRING_REBOUND }).start();
        },
      }),
    [dragY, handleDismiss]
  );

  const openOffset = 420;
  const translateY = Animated.add(
    slide.interpolate({ inputRange: [0, 1], outputRange: [openOffset, 0] }),
    dragY
  );
  const composerBottomPadding = Math.max(insets.bottom, spacing.sm);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleDismiss} statusBarTranslucent presentationStyle="overFullScreen">
      <View style={styles.nativeOverlayRoot}>
        <Pressable style={styles.backdropPressable} onPress={handleDismiss} accessibilityRole="button" accessibilityLabel={backdropAccessibilityLabel}>
          <Animated.View style={[styles.backdrop, { opacity: fade }]} />
        </Pressable>
        <Animated.View style={[styles.sheet, { height: "70%", paddingBottom: composerBottomPadding, transform: [{ translateY }] }]}>
          <View style={styles.handleWrap} {...headerPanResponder.panHandlers}>
            <View style={styles.handle} />
          </View>
          <View style={styles.headerTitleRow} {...headerPanResponder.panHandlers}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <Pressable onPress={handleDismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close comments" style={styles.closeButton}>
              <Text style={styles.closeIcon}>✕</Text>
            </Pressable>
          </View>
          <CommentsListRegion>{children}</CommentsListRegion>
          <View style={styles.composerHost}>{composer}</View>
        </Animated.View>
      </View>
    </Modal>
  );
}

export function CommentsBottomSheet(props: CommentsBottomSheetProps) {
  if (Platform.OS === "web" && typeof document !== "undefined") {
    return <WebCommentsModalSurface {...props} />;
  }
  return <NativeCommentsModalSurface {...props} />;
}

const SHEET_TOP_RADIUS = radius.lg + 8;

const styles = StyleSheet.create({
  nativeOverlayRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdropPressable: {
    ...StyleSheet.absoluteFillObject,
    ...(Platform.OS === "web"
      ? ({
          touchAction: "none",
        } as object)
      : null),
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 10, 11, 0.88)",
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
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxs,
    minHeight: touchTarget / 2,
    justifyContent: "center",
    flexShrink: 0,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: "rgba(255, 255, 255, 0.32)",
  },
  headerRow: {
    flexShrink: 0,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    flexShrink: 0,
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
    ...(Platform.OS === "web"
      ? ({
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-y",
          overscrollBehavior: "contain",
        } as object)
      : null),
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    flexGrow: 1,
  },
  composerHost: {
    flexShrink: 0,
    position: "relative",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    ...(Platform.OS === "web"
      ? ({
          touchAction: "none",
        } as object)
      : null),
  },
});
