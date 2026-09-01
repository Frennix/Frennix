import { useCallback, useEffect, useMemo, useRef, useState, createElement } from "react";
import {
  Animated,
  FlatList,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from "react-native";
import { createPortal } from "react-dom";
import { prefetchCachedImages, CachedImage } from "../packages/ui/src/CachedImage";
import { FullscreenVideoSlide } from "../packages/ui/src/FullscreenVideoSlide";
import type { FeedVideoFullscreenHandoff } from "../packages/ui/src/feedVideoPlaybackCoordinator";
import { colors, spacing, typography } from "../packages/ui/src/theme";

/** Compact Instagram-style lightbox close control (smaller than global touchTarget). */
const LIGHTBOX_CLOSE_SIZE = 34;
const LIGHTBOX_CLOSE_ICON = 17;
import type { PostMediaItem } from "@frennix/types";
import { galleryNeighborImageUris } from "@frennix/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import AnimatedReanimated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { setLightboxOverlayOpen } from "@/lib/lightbox-overlay-state";
import { restoreWebDocumentScrollLock } from "@/lib/web-document-scroll-lock";

/** @deprecated Use MediaGalleryState with typed items. */
export interface ImageGalleryState {
  images: string[];
  index: number;
  placeholderUris?: Array<string | null>;
}

export interface MediaGalleryState {
  items: PostMediaItem[];
  index: number;
  videoHandoff?: FeedVideoFullscreenHandoff;
}

export type GalleryState = ImageGalleryState | MediaGalleryState;

function isMediaGalleryState(state: GalleryState): state is MediaGalleryState {
  return "items" in state;
}

function resolveGalleryItems(state: GalleryState): PostMediaItem[] {
  if (isMediaGalleryState(state)) return state.items;
  return state.images.map((url, index) => ({
    url,
    kind: "image" as const,
    thumbnailUrl: state.placeholderUris?.[index] ?? null,
  }));
}

interface ImageLightboxProps {
  gallery: GalleryState | null;
  onClose: (index: number) => void;
}

const LIGHTBOX_WEB_ROOT: ViewStyle = Platform.select({
  web: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100vw",
    height: "100dvh",
    flex: 1,
    zIndex: 99999,
    backgroundColor: colors.black,
    overflow: "hidden",
  },
  default: {
    flex: 1,
    backgroundColor: colors.black,
  },
}) as ViewStyle;

const LIGHTBOX_IMAGE_STYLE = [
  StyleSheet.absoluteFillObject,
  { width: "100%", height: "100%", flex: 1 },
] as const;

const WEB_LIGHTBOX_PLAIN_IMG_STYLE = {
  position: "absolute",
  inset: 0,
  width: "100vw",
  height: "100dvh",
  minWidth: "100vw",
  minHeight: "100dvh",
  maxWidth: "none",
  maxHeight: "none",
  objectFit: "contain",
  objectPosition: "center",
  display: "block",
  margin: 0,
  padding: 0,
  borderRadius: 0,
  aspectRatio: "auto",
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
  touchAction: "none",
} as const;

function clampScale(value: number) {
  return Math.min(Math.max(value, 1), 4);
}

function isPointInsideContainedImage(
  img: HTMLImageElement,
  clientX: number,
  clientY: number
): boolean {
  const bounds = img.getBoundingClientRect();
  const { naturalWidth, naturalHeight } = img;
  if (!naturalWidth || !naturalHeight || bounds.width <= 0 || bounds.height <= 0) {
    return true;
  }
  const fitScale = Math.min(bounds.width / naturalWidth, bounds.height / naturalHeight);
  const renderedWidth = naturalWidth * fitScale;
  const renderedHeight = naturalHeight * fitScale;
  const left = bounds.left + (bounds.width - renderedWidth) / 2;
  const top = bounds.top + (bounds.height - renderedHeight) / 2;
  return (
    clientX >= left &&
    clientX <= left + renderedWidth &&
    clientY >= top &&
    clientY <= top + renderedHeight
  );
}

function NativeZoomableImage({
  uri,
  placeholderUri,
  isActive,
  onZoomChange,
}: {
  uri: string;
  placeholderUri?: string | null;
  isActive: boolean;
  onZoomChange: (zoomed: boolean) => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    onZoomChange(false);
  }, [uri, isActive, onZoomChange, scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY]);

  const resetZoom = useCallback(() => {
    scale.value = withTiming(1);
    savedScale.value = 1;
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    onZoomChange(false);
  }, [onZoomChange, scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY]);

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      const next = clampScale(savedScale.value * event.scale);
      scale.value = next;
      onZoomChange(next > 1.01);
    })
    .onEnd(() => {
      if (scale.value <= 1.01) {
        resetZoom();
        return;
      }
      savedScale.value = scale.value;
      onZoomChange(true);
    });

  const pan = Gesture.Pan()
    .manualActivation(true)
    .onTouchesMove((_event, state) => {
      if (scale.value > 1.01) state.activate();
      else state.fail();
    })
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.01) {
        resetZoom();
        return;
      }
      scale.value = withTiming(2);
      savedScale.value = 2;
      onZoomChange(true);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={styles.imageStage}>
      <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
        <AnimatedReanimated.View style={[styles.zoomLayer, animatedStyle]}>
          <CachedImage
            uri={uri}
            placeholderUri={placeholderUri}
            style={LIGHTBOX_IMAGE_STYLE}
            contentFit="contain"
            recyclingKey={`lightbox-${uri}`}
          />
        </AnimatedReanimated.View>
      </GestureDetector>
    </View>
  );
}

function WebZoomableImage({
  uri,
  onZoomChange,
  onLetterboxPress,
}: {
  uri: string;
  placeholderUri?: string | null;
  onZoomChange: (zoomed: boolean) => void;
  onLetterboxPress?: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const lastTap = useRef(0);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const movedDuringTouch = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
    onZoomChange(false);
  }, [uri, onZoomChange]);

  useEffect(() => {
    function onWheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.15 : 0.15;
      setScale((current) => {
        const next = clampScale(current + delta);
        onZoomChange(next > 1.01);
        if (next <= 1) setPan({ x: 0, y: 0 });
        return next;
      });
    }

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [uri, onZoomChange]);

  function distance(touches: TouchList) {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  function handleDoubleTap() {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (scale > 1.01) {
        setScale(1);
        setPan({ x: 0, y: 0 });
        onZoomChange(false);
      } else {
        setScale(2);
        onZoomChange(true);
      }
      lastTap.current = 0;
      return;
    }
    lastTap.current = now;
  }

  function maybeDismissFromLetterbox(clientX: number, clientY: number) {
    if (scale > 1.01 || movedDuringTouch.current || !onLetterboxPress) return;
    const img = imgRef.current;
    if (!img) return;
    if (!isPointInsideContainedImage(img, clientX, clientY)) {
      onLetterboxPress();
    }
  }

  return (
    <View
      style={styles.imageStage}
      collapsable={false}
      onTouchStart={(event) => {
        movedDuringTouch.current = false;
        touchStart.current = null;
        const touches = event.nativeEvent.touches;
        if (touches.length === 1) {
          touchStart.current = { x: touches[0].pageX, y: touches[0].pageY };
        }
        if (touches.length === 2) {
          const dist = distance(touches as unknown as TouchList);
          pinchStart.current = { distance: dist, scale };
          dragStart.current = null;
          return;
        }
        if (touches.length === 1 && scale > 1) {
          dragStart.current = {
            x: touches[0].pageX,
            y: touches[0].pageY,
            panX: pan.x,
            panY: pan.y,
          };
        }
      }}
      onTouchMove={(event) => {
        const touches = event.nativeEvent.touches;
        if (touchStart.current && touches.length === 1) {
          const dx = touches[0].pageX - touchStart.current.x;
          const dy = touches[0].pageY - touchStart.current.y;
          if (Math.hypot(dx, dy) > 8) movedDuringTouch.current = true;
        }
        if (touches.length === 2 && pinchStart.current) {
          const dist = distance(touches as unknown as TouchList);
          if (!pinchStart.current.distance) return;
          const next = clampScale((pinchStart.current.scale * dist) / pinchStart.current.distance);
          setScale(next);
          onZoomChange(next > 1.01);
          if (next <= 1) setPan({ x: 0, y: 0 });
          return;
        }
        if (touches.length === 1 && dragStart.current && scale > 1) {
          setPan({
            x: dragStart.current.panX + (touches[0].pageX - dragStart.current.x),
            y: dragStart.current.panY + (touches[0].pageY - dragStart.current.y),
          });
        }
      }}
      onTouchEnd={(event) => {
        const touch = event.nativeEvent.changedTouches[0];
        if (touch) {
          maybeDismissFromLetterbox(touch.pageX, touch.pageY);
        }
        dragStart.current = null;
        pinchStart.current = null;
        touchStart.current = null;
        setScale((current) => {
          if (current <= 1.01) {
            setPan({ x: 0, y: 0 });
            onZoomChange(false);
            return 1;
          }
          return current;
        });
      }}
      // @ts-expect-error web double-click zoom
      onDoubleClick={handleDoubleTap}
    >
      {createElement("img", {
        ref: imgRef,
        src: uri,
        alt: "",
        draggable: false,
        style: {
          ...WEB_LIGHTBOX_PLAIN_IMG_STYLE,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: "center center",
        },
        onClick: (event: MouseEvent) => {
          maybeDismissFromLetterbox(event.clientX, event.clientY);
        },
        onContextMenu: (event: Event) => {
          event.preventDefault();
        },
      })}
    </View>
  );
}

function LightboxSurface({
  gallery,
  onClose,
  onRegisterDismiss,
}: ImageLightboxProps & { onRegisterDismiss?: (dismiss: () => void) => void }) {
  const insets = useSafeAreaInsets();
  const chromeTop = Math.max(insets.top, Platform.OS === "web" ? 12 : spacing.sm);
  const [index, setIndex] = useState(0);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [zoomed, setZoomed] = useState(false);
  const [pageWidth, setPageWidth] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);
  const listRef = useRef<FlatList<PostMediaItem>>(null);
  const dismissY = useRef(new Animated.Value(0)).current;
  const webSwipeStartY = useRef<number | null>(null);

  const items = gallery ? resolveGalleryItems(gallery) : [];
  const visible = items.length > 0;
  const videoHandoff =
    gallery && isMediaGalleryState(gallery) ? gallery.videoHandoff : undefined;

  const syncViewportSize = useCallback(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const viewport = window.visualViewport;
      setPageWidth(Math.round(viewport?.width ?? window.innerWidth));
      setPageHeight(Math.round(viewport?.height ?? window.innerHeight));
      return;
    }
  }, []);

  const dismiss = useCallback(() => {
    dismissY.setValue(0);
    onClose(index);
  }, [dismissY, index, onClose]);

  useEffect(() => {
    if (!gallery || !pageWidth) return;
    setIndex(gallery.index);
    setScrollEnabled(true);
    setZoomed(false);
    dismissY.setValue(0);
    if (gallery.index > 0) {
      listRef.current?.scrollToOffset({ offset: pageWidth * gallery.index, animated: false });
    }
  }, [gallery, dismissY, pageWidth]);

  useEffect(() => {
    if (!visible || Platform.OS !== "web" || typeof window === "undefined") return;
    syncViewportSize();
    window.addEventListener("resize", syncViewportSize);
    window.visualViewport?.addEventListener("resize", syncViewportSize);
    return () => {
      window.removeEventListener("resize", syncViewportSize);
      window.visualViewport?.removeEventListener("resize", syncViewportSize);
    };
  }, [syncViewportSize, visible]);

  useEffect(() => {
    if (items[index]?.kind === "video") {
      setScrollEnabled(true);
      setZoomed(false);
    }
  }, [index, items]);

  useEffect(() => {
    if (!items.length) return;
    const neighbors = galleryNeighborImageUris(items, index);
    if (neighbors.length) void prefetchCachedImages(neighbors);
  }, [items, index]);

  useEffect(() => {
    setLightboxOverlayOpen(visible);
    if (!visible) return;

    if (Platform.OS === "web" && typeof document !== "undefined") {
      const previousBodyOverflow = document.body.style.overflow;
      const previousHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousBodyOverflow;
        document.documentElement.style.overflow = previousHtmlOverflow;
        restoreWebDocumentScrollLock();
        setLightboxOverlayOpen(false);
      };
    }

    return () => {
      setLightboxOverlayOpen(false);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || Platform.OS !== "web" || typeof window === "undefined") return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dismiss, visible]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!pageWidth) return;
      const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
      const clamped = Math.min(Math.max(nextIndex, 0), items.length - 1);
      setIndex((current) => (current === clamped ? current : clamped));
    },
    [pageWidth, items.length]
  );

  const handleZoomChange = useCallback((zoomed: boolean) => {
    setZoomed(zoomed);
    setScrollEnabled(!zoomed);
  }, []);

  useEffect(() => {
    onRegisterDismiss?.(dismiss);
    return () => onRegisterDismiss?.(() => undefined);
  }, [dismiss, onRegisterDismiss]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          !zoomed && gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy > 0) dismissY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 120 || gesture.vy > 1.2) {
            dismiss();
            return;
          }
          Animated.spring(dismissY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(dismissY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        },
      }),
    [dismiss, dismissY, zoomed]
  );

  const handleWebTouchStart = useCallback(
    (event: { nativeEvent: { touches: Array<{ pageY: number }> } }) => {
      if (zoomed || event.nativeEvent.touches.length !== 1) {
        webSwipeStartY.current = null;
        return;
      }
      webSwipeStartY.current = event.nativeEvent.touches[0].pageY;
    },
    [zoomed]
  );

  const handleWebTouchMove = useCallback(
    (event: {
      nativeEvent: { touches: Array<{ pageY: number; pageX: number }> };
    }) => {
      if (zoomed || webSwipeStartY.current === null || event.nativeEvent.touches.length !== 1) {
        return;
      }
      const touch = event.nativeEvent.touches[0];
      const dy = touch.pageY - webSwipeStartY.current;
      if (dy > 8) dismissY.setValue(dy);
    },
    [dismissY, zoomed]
  );

  const handleWebTouchEnd = useCallback(
    (event: { nativeEvent: { changedTouches: Array<{ pageY: number }> } }) => {
      if (zoomed || webSwipeStartY.current === null) {
        webSwipeStartY.current = null;
        return;
      }
      const endY = event.nativeEvent.changedTouches[0]?.pageY ?? webSwipeStartY.current;
      const dy = endY - webSwipeStartY.current;
      webSwipeStartY.current = null;
      if (dy > 120) {
        dismiss();
        return;
      }
      Animated.spring(dismissY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
    },
    [dismiss, dismissY, zoomed]
  );

  if (!visible) return null;

  return (
    <View
      style={[styles.root, LIGHTBOX_WEB_ROOT]}
      {...(Platform.OS === "web" ? ({ "data-frennix-lightbox": "true" } as object) : null)}
      onLayout={(event) => {
        if (Platform.OS === "web") {
          syncViewportSize();
          return;
        }
        const { width, height } = event.nativeEvent.layout;
        if (width > 0) setPageWidth(Math.round(width));
        if (height > 0) setPageHeight(Math.round(height));
      }}
      {...(Platform.OS !== "web" ? panResponder.panHandlers : {})}
      onTouchStart={Platform.OS === "web" ? handleWebTouchStart : undefined}
      onTouchMove={Platform.OS === "web" ? handleWebTouchMove : undefined}
      onTouchEnd={Platform.OS === "web" ? handleWebTouchEnd : undefined}
    >
      <Animated.View
        style={[styles.stageShell, { transform: [{ translateY: dismissY }] }]}
        pointerEvents="box-none"
      >
        {pageWidth > 0 && pageHeight > 0 ? (
          <FlatList
            ref={listRef}
            data={items}
            horizontal
            pagingEnabled
            nestedScrollEnabled
            scrollEnabled={scrollEnabled}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, itemIndex) => `${item.url}-${itemIndex}`}
            getItemLayout={(_, itemIndex) => ({
              length: pageWidth,
              offset: pageWidth * itemIndex,
              index: itemIndex,
            })}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onMomentumScrollEnd={handleScroll}
            initialNumToRender={Math.min(3, items.length)}
            maxToRenderPerBatch={2}
            windowSize={3}
            style={styles.galleryList}
            contentContainerStyle={styles.galleryListContent}
            renderItem={({ item, index: itemIndex }) => (
              <View
                style={[
                  styles.galleryPage,
                  { width: pageWidth },
                  Platform.OS === "web" ? null : { height: pageHeight },
                ]}
              >
                {item.kind === "video" ? (
                  <View style={styles.imageStage}>
                    <FullscreenVideoSlide
                      uri={item.url}
                      thumbnailUrl={item.thumbnailUrl}
                      stageWidth={pageWidth}
                      stageHeight={pageHeight}
                      isActive={itemIndex === index}
                      playbackHandoff={
                        itemIndex === index &&
                        videoHandoff &&
                        videoHandoff.mediaIndex === itemIndex
                          ? videoHandoff
                          : undefined
                      }
                    />
                  </View>
                ) : Platform.OS === "web" ? (
                  <WebZoomableImage
                    uri={item.url}
                    placeholderUri={item.thumbnailUrl}
                    onZoomChange={handleZoomChange}
                    onLetterboxPress={!zoomed ? dismiss : undefined}
                  />
                ) : (
                  <NativeZoomableImage
                    uri={item.url}
                    placeholderUri={item.thumbnailUrl}
                    isActive={itemIndex === index}
                    onZoomChange={handleZoomChange}
                  />
                )}
              </View>
            )}
          />
        ) : null}
      </Animated.View>

      <View style={styles.chromeLayer} pointerEvents="box-none">
        <Pressable
          style={[styles.closeButton, { top: chromeTop }]}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Close"
          accessibilityHint="Closes the photo viewer"
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>

        {items.length > 1 ? (
          <View style={[styles.galleryCounter, { top: chromeTop }]} pointerEvents="none">
            <Text style={styles.galleryCounterText}>
              {index + 1}/{items.length}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function ImageLightbox({ gallery, onClose }: ImageLightboxProps) {
  const visible = Boolean(gallery && resolveGalleryItems(gallery).length > 0);
  const dismissRef = useRef<() => void>(() => onClose(gallery?.index ?? 0));

  if (!visible) return null;

  const surface = (
    <LightboxSurface
      gallery={gallery}
      onClose={onClose}
      onRegisterDismiss={(dismiss) => {
        dismissRef.current = dismiss;
      }}
    />
  );

  if (Platform.OS === "web" && typeof document !== "undefined") {
    return createPortal(surface, document.body);
  }

  return (
    <Modal
      visible
      transparent={false}
      animationType="fade"
      onRequestClose={() => dismissRef.current()}
      statusBarTranslucent
      presentationStyle="fullScreen"
    >
      {surface}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.black,
    ...(Platform.OS === "web"
      ? ({
          width: "100vw",
          height: "100dvh",
          flex: 1,
        } as object)
      : { flex: 1 }),
  },
  stageShell: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    flex: 1,
  },
  galleryList: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  galleryListContent: {
    flexGrow: 1,
    height: "100%",
    ...(Platform.OS === "web" ? ({ minHeight: "100dvh" } as object) : null),
  },
  galleryPage: {
    flex: 1,
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? ({
          width: "100vw",
          height: "100dvh",
        } as object)
      : null),
  },
  imageStage: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: "100%",
    height: "100%",
    flex: 1,
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? ({
          width: "100vw",
          height: "100dvh",
        } as object)
      : null),
  },
  zoomLayer: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    flex: 1,
  },
  chromeLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
  closeButton: {
    position: "absolute",
    right: spacing.sm,
    zIndex: 31,
    width: LIGHTBOX_CLOSE_SIZE,
    height: LIGHTBOX_CLOSE_SIZE,
    borderRadius: LIGHTBOX_CLOSE_SIZE / 2,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.28)",
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0 1px 6px rgba(0, 0, 0, 0.35)" } as object)
      : null),
  },
  closeText: {
    color: "#FFFFFF",
    fontSize: LIGHTBOX_CLOSE_ICON,
    lineHeight: LIGHTBOX_CLOSE_ICON,
    fontWeight: "600",
  },
  galleryCounter: {
    position: "absolute",
    left: spacing.md,
    zIndex: 31,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(10, 10, 11, 0.75)",
  },
  galleryCounterText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "700",
  },
});
