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
import { setCommentsOverlayOpen } from "@/lib/comments-overlay-state";
import {
  measureSafariVisualViewport,
  requestSafariVisualViewportRemeasure,
  subscribeSafariVisualViewport,
  type SafariVisualViewportSnapshot,
} from "@/lib/safari-visual-viewport";
import { lockWebModalScroll, restoreWebDocumentScrollLock, unlockWebModalScroll } from "@/lib/web-modal-scroll-lock";
import { OVERLAY_Z_INDEX } from "@/lib/overlay-z-index";
import { colors, radius, spacing, touchTarget, typography } from "@frennix/ui";

const COMMENTS_SHEET_Z_INDEX = OVERLAY_Z_INDEX.commentsSheet;
const SHEET_OPEN_RATIO = 0.7;
const SHEET_MAX_RATIO = 0.75;

type CommentsBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Scrollable comments list — only this region scrolls. */
  children: ReactNode;
  /** Fixed composer row rendered above the safe-area inset. */
  composer: ReactNode;
  backdropAccessibilityLabel?: string;
};

const WEB_OVERLAY_ROOT: ViewStyle = Platform.select({
  web: {
    position: "fixed",
    left: 0,
    right: 0,
    width: "100%",
    zIndex: COMMENTS_SHEET_Z_INDEX,
    overflow: "hidden",
    touchAction: "none",
  },
  default: {
    flex: 1,
    justifyContent: "flex-end",
  },
}) as ViewStyle;

function computeClosedSheetHeight(baselineVisualHeight: number): number {
  const target = Math.round(baselineVisualHeight * SHEET_OPEN_RATIO);
  const max = Math.round(baselineVisualHeight * SHEET_MAX_RATIO);
  return Math.min(Math.max(target, 280), max);
}

function isKeyboardOpen(viewport: SafariVisualViewportSnapshot | null): boolean {
  if (!viewport) return false;
  return viewport.bottomChrome > 0;
}

export function CommentsBottomSheet({
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
  /** Visual viewport height captured when the sheet opens — keeps closed height stable. */
  const baselineVisualHeightRef = useRef(0);
  const [viewport, setViewport] = useState(() =>
    Platform.OS === "web" ? measureSafariVisualViewport() : null
  );

  useEffect(() => {
    if (!visible || Platform.OS !== "web" || typeof window === "undefined") return;

    const update = () => {
      const next = measureSafariVisualViewport();
      setViewport((prev) =>
        prev &&
        prev.offsetTop === next.offsetTop &&
        prev.overlayHeight === next.overlayHeight &&
        prev.bottomChrome === next.bottomChrome &&
        prev.visualHeight === next.visualHeight
          ? prev
          : next
      );
    };

    update();
    return subscribeSafariVisualViewport(update);
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      slide.setValue(0);
      fade.setValue(0);
      dragY.setValue(0);
      dismissingRef.current = false;
      baselineVisualHeightRef.current = 0;
      return;
    }

    if (Platform.OS === "web") {
      baselineVisualHeightRef.current = measureSafariVisualViewport().visualHeight;
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
    if (Platform.OS === "web") lockWebModalScroll();

    return () => {
      setCommentsOverlayOpen(false);
      if (Platform.OS === "web") {
        unlockWebModalScroll();
        restoreWebDocumentScrollLock();
        requestSafariVisualViewportRemeasure();
      }
    };
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

  const handleBackdropPress = useCallback(() => {
    if (Date.now() - openedAtRef.current < BOTTOM_SHEET_MIN_BACKDROP_DISMISS_MS) return;
    handleDismiss();
  }, [handleDismiss]);

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
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            ...BOTTOM_SHEET_SPRING_REBOUND,
          }).start();
        },
      }),
    [dragY, handleDismiss]
  );

  const overlayTop = Platform.OS === "web" ? (viewport?.offsetTop ?? 0) : 0;
  const overlayHeight =
    Platform.OS === "web"
      ? (viewport?.overlayHeight ?? (typeof window !== "undefined" ? window.innerHeight : 640))
      : undefined;

  const keyboardOpen = Platform.OS === "web" && isKeyboardOpen(viewport);
  const baselineVisualHeight =
    baselineVisualHeightRef.current ||
    viewport?.visualHeight ||
    (typeof window !== "undefined" ? window.innerHeight : 640);

  const sheetHeight = useMemo(() => {
    if (Platform.OS !== "web") return undefined;
    if (keyboardOpen && overlayHeight) return overlayHeight;
    return computeClosedSheetHeight(baselineVisualHeight);
  }, [baselineVisualHeight, keyboardOpen, overlayHeight]);

  const openOffset = sheetHeight ?? 420;
  const translateY = Animated.add(
    slide.interpolate({
      inputRange: [0, 1],
      outputRange: [openOffset, 0],
    }),
    dragY
  );

  const composerSafeBottom = Math.max(
    insets.bottom,
    viewport?.envSafeAreaBottom ?? 0,
    spacing.sm
  );

  if (!visible) return null;

  const surface = (
    <View
      style={[
        WEB_OVERLAY_ROOT,
        Platform.OS === "web"
          ? ({
              top: overlayTop,
              height: overlayHeight,
            } as ViewStyle)
          : null,
      ]}
      {...(Platform.OS === "web" ? ({ "data-frennix-comments-sheet": "true" } as object) : null)}
    >
      <Pressable
        style={styles.backdropPressable}
        onPress={handleBackdropPress}
        accessibilityRole="button"
        accessibilityLabel={backdropAccessibilityLabel}
      >
        <Animated.View style={[styles.backdrop, { opacity: fade }]} />
      </Pressable>

      <Animated.View
        style={[
          styles.sheet,
          Platform.OS === "web" ? styles.sheetWeb : null,
          {
            height: sheetHeight ?? ("70%" as const),
            maxHeight:
              Platform.OS === "web" && overlayHeight
                ? overlayHeight
                : ("75%" as const),
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.sheetSolidFill} pointerEvents="none" />

        <View style={styles.handleWrap} {...headerPanResponder.panHandlers}>
          <View style={styles.handle} />
        </View>

        <View style={styles.headerRow} {...headerPanResponder.panHandlers}>
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

        <View style={[styles.composerHost, { paddingBottom: composerSafeBottom }]}>{composer}</View>
      </Animated.View>
    </View>
  );

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
    ...(Platform.OS === "web"
      ? ({
          boxShadow: "0 -12px 40px rgba(0, 0, 0, 0.5)",
        } as object)
      : null),
  },
  sheetWeb: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexShrink: 0,
    touchAction: "none",
  },
  sheetSolidFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface,
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxs,
    minHeight: touchTarget / 2,
    justifyContent: "center",
    flexShrink: 0,
    zIndex: 1,
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    flexShrink: 0,
    zIndex: 1,
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
    zIndex: 1,
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    zIndex: 1,
    ...(Platform.OS === "web"
      ? ({
          touchAction: "none",
        } as object)
      : null),
  },
});
