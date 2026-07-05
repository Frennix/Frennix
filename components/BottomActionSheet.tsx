import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import {
  Animated,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import {
  useBottomActionSheetLayout,
  type BottomActionSheetLayoutOptions,
} from "@/lib/use-bottom-action-sheet-layout";
import { restoreWebDocumentScrollLock } from "@/lib/web-document-scroll-lock";
import { colors, radius, spacing, touchTarget } from "@frennix/ui";

export const BOTTOM_SHEET_DISMISS_DRAG_THRESHOLD = 120;
export const BOTTOM_SHEET_MIN_BACKDROP_DISMISS_MS = 520;
export const BOTTOM_SHEET_CONTENT_ANIM_FALLBACK_PX = 340;

export const BOTTOM_SHEET_SPRING_OPEN = {
  damping: 24,
  stiffness: 310,
  mass: 0.92,
} as const;

export const BOTTOM_SHEET_SPRING_DISMISS = {
  damping: 28,
  stiffness: 340,
  mass: 0.9,
} as const;

export const BOTTOM_SHEET_SPRING_REBOUND = {
  damping: 22,
  stiffness: 280,
  mass: 0.85,
} as const;

export type BottomActionSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  expanded?: boolean;
  /** Size sheet to content height instead of a fixed viewport snap. Default: true. */
  fitToContent?: boolean;
  /** When false, content is static and the whole sheet responds to swipe-down dismiss. */
  scrollEnabled?: boolean;
  /** Only shown when scrollEnabled is true. Defaults to false. */
  showScrollIndicator?: boolean;
  layoutOptions?: BottomActionSheetLayoutOptions;
  backdropAccessibilityLabel?: string;
  scrollContentContainerStyle?: ViewStyle;
  bodyStyle?: ViewStyle;
  /** Optional ref populated with the animated dismiss handler (for action callbacks). */
  dismissRef?: MutableRefObject<() => void>;
};

/**
 * Native iOS-style bottom action sheet shell — spring animation, centered drag handle,
 * swipe-to-dismiss, and iPhone Safari safe-area lift (BUG-002). Use for all Frennix action sheets.
 */
export function BottomActionSheet({
  visible,
  onClose,
  children,
  expanded = false,
  fitToContent = true,
  scrollEnabled = false,
  showScrollIndicator = false,
  layoutOptions,
  backdropAccessibilityLabel = "Dismiss",
  scrollContentContainerStyle,
  bodyStyle,
  dismissRef: externalDismissRef,
}: BottomActionSheetProps) {
  const contentSized = fitToContent && !scrollEnabled;
  const {
    sheetMarginBottom,
    contentBottomPadding,
    sheetSnapHeight,
    sheetMaxHeight,
    snapRatio,
    webOverlayStyle,
    webSheetAnchorStyle,
  } = useBottomActionSheetLayout(visible, {
    expanded,
    contentSized,
    ...layoutOptions,
  });

  const { height: windowHeight } = useWindowDimensions();
  const slide = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const dismissingRef = useRef(false);
  const openedAtRef = useRef(0);
  const [measuredHeight, setMeasuredHeight] = useState(BOTTOM_SHEET_CONTENT_ANIM_FALLBACK_PX);

  useEffect(() => {
    if (!visible) {
      slide.setValue(0);
      fade.setValue(0);
      dragY.setValue(0);
      dismissingRef.current = false;
      setMeasuredHeight(BOTTOM_SHEET_CONTENT_ANIM_FALLBACK_PX);
      return;
    }

    slide.setValue(0);
    fade.setValue(0);
    dragY.setValue(0);
    openedAtRef.current = Date.now();
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.spring(slide, {
        toValue: 1,
        useNativeDriver: true,
        ...BOTTOM_SHEET_SPRING_OPEN,
      }),
    ]).start();
  }, [dragY, fade, slide, visible]);

  useEffect(() => {
    return () => {
      if (Platform.OS === "web") restoreWebDocumentScrollLock();
    };
  }, []);

  const handleDismiss = useCallback(() => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(slide, {
        toValue: 0,
        useNativeDriver: true,
        ...BOTTOM_SHEET_SPRING_DISMISS,
      }),
      Animated.spring(dragY, {
        toValue: 0,
        useNativeDriver: true,
        ...BOTTOM_SHEET_SPRING_DISMISS,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        if (Platform.OS === "web") restoreWebDocumentScrollLock();
        onClose();
      }
      dismissingRef.current = false;
    });
  }, [dragY, fade, onClose, slide]);

  const handleBackdropPress = useCallback(() => {
    if (Date.now() - openedAtRef.current < BOTTOM_SHEET_MIN_BACKDROP_DISMISS_MS) return;
    handleDismiss();
  }, [handleDismiss]);

  const dismissHandlerRef = useRef(handleDismiss);
  dismissHandlerRef.current = handleDismiss;
  if (externalDismissRef) externalDismissRef.current = handleDismiss;

  const createPanResponder = useCallback(
    (allowWholeSheet: boolean) =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.2,
        onMoveShouldSetPanResponderCapture: allowWholeSheet
          ? (_, gesture) =>
              gesture.dy > 10 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.5
          : undefined,
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy > 0) dragY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_, gesture) => {
          if (
            gesture.dy > BOTTOM_SHEET_DISMISS_DRAG_THRESHOLD ||
            gesture.vy > 0.75
          ) {
            dismissHandlerRef.current();
            return;
          }
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            ...BOTTOM_SHEET_SPRING_REBOUND,
          }).start();
        },
      }),
    [dragY]
  );

  const sheetPanResponder = useMemo(
    () => createPanResponder(!scrollEnabled),
    [createPanResponder, scrollEnabled]
  );
  const handlePanResponder = useMemo(
    () => createPanResponder(true),
    [createPanResponder]
  );

  const handleSheetLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    if (nextHeight > 0) setMeasuredHeight(nextHeight);
  }, []);

  if (Platform.OS === "web" && !visible) return null;

  const webSheetSnapHeight = Platform.OS === "web" ? (sheetSnapHeight as string | undefined) : undefined;
  const nativeSheetSnapHeight = Platform.OS === "web" ? undefined : (sheetSnapHeight as number | undefined);
  const webSheetMaxHeight = Platform.OS === "web" ? (sheetMaxHeight as string) : undefined;
  const nativeSheetMaxHeight = Platform.OS === "web" ? undefined : (sheetMaxHeight as number);

  const openOffset = contentSized
    ? measuredHeight + spacing.md
    : Math.min(windowHeight * snapRatio, expanded ? 520 : 560);

  const translateY = Animated.add(
    slide.interpolate({
      inputRange: [0, 1],
      outputRange: [openOffset, 0],
    }),
    dragY
  );

  const sheetAnimatedStyle = useMemo(
    () => [
      styles.sheet,
      {
        paddingBottom: contentBottomPadding,
        ...(contentSized
          ? { flexShrink: 0 }
          : {
              minHeight: webSheetSnapHeight ?? nativeSheetSnapHeight,
            }),
        ...(scrollEnabled || expanded
          ? { maxHeight: webSheetMaxHeight ?? nativeSheetMaxHeight }
          : contentSized
            ? null
            : { maxHeight: webSheetMaxHeight ?? nativeSheetMaxHeight }),
        marginBottom: webSheetAnchorStyle ? 0 : sheetMarginBottom,
        transform: [{ translateY }],
      },
    ],
    [
      contentBottomPadding,
      contentSized,
      expanded,
      nativeSheetMaxHeight,
      nativeSheetSnapHeight,
      scrollEnabled,
      sheetMarginBottom,
      translateY,
      webSheetAnchorStyle,
      webSheetMaxHeight,
      webSheetSnapHeight,
    ]
  );

  const sheetInterior = (
    <>
      <View
        style={styles.handleWrap}
        accessibilityRole="button"
        accessibilityLabel="Drag to dismiss"
        accessibilityHint="Swipe down on the sheet to close"
        {...(scrollEnabled ? handlePanResponder.panHandlers : {})}
      >
        <View style={styles.handle} />
      </View>

      {scrollEnabled ? (
        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={[styles.sheetScrollContent, scrollContentContainerStyle]}
          scrollEnabled
          showsVerticalScrollIndicator={showScrollIndicator}
          bounces
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.sheetBodyStatic, bodyStyle]}>{children}</View>
      )}
    </>
  );

  const animatedSheet = (
    <Animated.View
      style={sheetAnimatedStyle as unknown as ViewStyle}
      onLayout={handleSheetLayout}
      {...(scrollEnabled ? {} : sheetPanResponder.panHandlers)}
    >
      {sheetInterior}
    </Animated.View>
  );

  const anchorMaxHeight =
    scrollEnabled || expanded ? (webSheetMaxHeight ?? nativeSheetMaxHeight) : undefined;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
      accessibilityViewIsModal
    >
      <View style={[styles.root, webOverlayStyle]} pointerEvents="box-none">
        {webSheetAnchorStyle ? (
          <Pressable
            style={styles.safariBackdropTap}
            onPress={handleBackdropPress}
            accessibilityRole="button"
            accessibilityLabel={backdropAccessibilityLabel}
          >
            <Animated.View
              style={[
                styles.backdrop,
                styles.backdropBlur,
                StyleSheet.absoluteFillObject,
                { opacity: fade },
              ]}
              pointerEvents="none"
            />
          </Pressable>
        ) : (
          <Animated.View
            style={[styles.backdrop, styles.backdropBlur, styles.backdropFill, { opacity: fade }]}
            pointerEvents="box-none"
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={handleBackdropPress}
              accessibilityRole="button"
              accessibilityLabel={backdropAccessibilityLabel}
            />
          </Animated.View>
        )}

        {webSheetAnchorStyle ? (
          <View
            style={
              anchorMaxHeight != null
                ? ([webSheetAnchorStyle, { maxHeight: anchorMaxHeight }] as ViewStyle[])
                : webSheetAnchorStyle
            }
            pointerEvents="auto"
          >
            {animatedSheet}
          </View>
        ) : (
          animatedSheet
        )}
      </View>
    </Modal>
  );
}

const WEB_SHEET_SHADOW =
  Platform.OS === "web"
    ? ({
        boxShadow: "0 -12px 40px rgba(0, 0, 0, 0.42), 0 -1px 0 rgba(255,255,255,0.06)",
      } as object)
    : null;

const WEB_BACKDROP_BLUR =
  Platform.OS === "web"
    ? ({
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      } as object)
    : null;

const SHEET_TOP_RADIUS = radius.lg + 8;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(10, 10, 11, 0.01)",
    ...(Platform.OS === "web"
      ? ({
          minHeight: "100dvh",
          height: "100%",
          position: "relative",
        } as object)
      : null),
  },
  backdrop: {
    backgroundColor: "rgba(10, 10, 11, 0.4)",
  },
  backdropFill: {
    ...StyleSheet.absoluteFillObject,
  },
  safariBackdropTap: {
    flex: 1,
    width: "100%",
    minHeight: 0,
  },
  backdropBlur: WEB_BACKDROP_BLUR ?? {},
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: SHEET_TOP_RADIUS,
    borderTopRightRadius: SHEET_TOP_RADIUS,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderBottomWidth: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    width: "100%",
    overflow: "visible",
    flexDirection: "column",
    ...(Platform.OS === "android" ? { elevation: 28 } : null),
    ...WEB_SHEET_SHADOW,
  },
  sheetBodyStatic: {
    flexDirection: "column",
    flexGrow: 0,
    flexShrink: 0,
  },
  sheetScroll: {
    flexGrow: 0,
    flexShrink: 1,
    ...(Platform.OS === "web"
      ? ({
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        } as object)
      : null),
  },
  sheetScrollContent: {
    flexGrow: 0,
    paddingBottom: spacing.md,
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    minHeight: touchTarget / 2,
    justifyContent: "center",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.32)",
  },
});
