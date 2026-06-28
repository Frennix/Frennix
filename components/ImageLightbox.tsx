import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { prefetchCachedImages } from "../packages/ui/src/CachedImage";
import { FullscreenVideoSlide } from "../packages/ui/src/FullscreenVideoSlide";
import { ProgressiveImage } from "../packages/ui/src/ProgressiveImage";
import { colors, spacing, typography } from "../packages/ui/src/theme";
import type { PostMediaItem } from "@frennix/types";
import { galleryNeighborImageUris } from "@frennix/types";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

/** @deprecated Use MediaGalleryState with typed items. */
export interface ImageGalleryState {
  images: string[];
  index: number;
  placeholderUris?: Array<string | null>;
}

export interface MediaGalleryState {
  items: PostMediaItem[];
  index: number;
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

function clampScale(value: number) {
  return Math.min(Math.max(value, 1), 4);
}

function NativeZoomableImage({
  uri,
  placeholderUri,
  stageWidth,
  stageHeight,
  isActive,
  onZoomChange,
}: {
  uri: string;
  placeholderUri?: string | null;
  stageWidth: number;
  stageHeight: number;
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
    <View style={[styles.stage, { width: stageWidth, height: stageHeight }]}>
      <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
        <Animated.View
          style={[
            styles.zoomLayer,
            { width: stageWidth, height: stageHeight },
            animatedStyle,
          ]}
        >
          <ProgressiveImage
            uri={uri}
            placeholderUri={placeholderUri}
            style={{ width: stageWidth, height: stageHeight }}
            contentFit="contain"
            recyclingKey={`lightbox-${uri}`}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function WebZoomableImage({
  uri,
  placeholderUri,
  stageWidth,
  stageHeight,
  onZoomChange,
}: {
  uri: string;
  placeholderUri?: string | null;
  stageWidth: number;
  stageHeight: number;
  onZoomChange: (zoomed: boolean) => void;
}) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const lastTap = useRef(0);

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

  return (
    <View
      style={[styles.stage, { width: stageWidth, height: stageHeight }]}
      collapsable={false}
      onTouchStart={(event) => {
        const touches = event.nativeEvent.touches;
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
      onTouchEnd={() => {
        dragStart.current = null;
        pinchStart.current = null;
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
      <View
        style={[
          styles.zoomLayer,
          {
            width: stageWidth,
            height: stageHeight,
            transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale }],
          },
        ]}
      >
        <ProgressiveImage
          uri={uri}
          placeholderUri={placeholderUri}
          style={{ width: stageWidth, height: stageHeight }}
          contentFit="contain"
          recyclingKey={`lightbox-web-${uri}`}
          accessibilityLabel="Full size image"
        />
      </View>
    </View>
  );
}

export function ImageLightbox({ gallery, onClose }: ImageLightboxProps) {
  const topInset = Platform.OS === "web" ? spacing.lg + 40 : spacing.xxl + 40;
  const [index, setIndex] = useState(0);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [pageWidth, setPageWidth] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);
  const listRef = useRef<FlatList<PostMediaItem>>(null);

  const items = gallery ? resolveGalleryItems(gallery) : [];
  const visible = items.length > 0;
  const stageWidth = pageWidth;
  const stageHeight = Math.max(pageHeight - topInset, 0);

  useEffect(() => {
    if (!gallery || !pageWidth) return;
    setIndex(gallery.index);
    setScrollEnabled(true);
    if (gallery.index > 0) {
      listRef.current?.scrollToOffset({ offset: pageWidth * gallery.index, animated: false });
    }
  }, [gallery, pageWidth]);

  useEffect(() => {
    if (items[index]?.kind === "video") setScrollEnabled(true);
  }, [index, items]);

  useEffect(() => {
    if (!items.length) return;
    const neighbors = galleryNeighborImageUris(items, index);
    if (neighbors.length) void prefetchCachedImages(neighbors);
  }, [items, index]);

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
    setScrollEnabled(!zoomed);
  }, []);

  const dismiss = useCallback(() => {
    onClose(index);
  }, [index, onClose]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss} statusBarTranslucent>
      <View
        style={styles.backdrop}
        onLayout={(event) => {
          setPageWidth(event.nativeEvent.layout.width);
          setPageHeight(event.nativeEvent.layout.height);
        }}
      >
        <Pressable style={styles.dismissArea} onPress={dismiss} accessibilityLabel="Dismiss image preview" />

        <View style={styles.content} pointerEvents="box-none">
          <Pressable
            style={styles.closeButton}
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.closeText}>✕</Text>
          </Pressable>

          {items.length > 1 ? (
            <View style={styles.galleryCounter} pointerEvents="none">
              <Text style={styles.galleryCounterText}>
                {index + 1}/{items.length}
              </Text>
            </View>
          ) : null}

          {pageWidth > 0 && stageHeight > 0 ? (
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
              renderItem={({ item, index: itemIndex }) => (
                <View style={[styles.galleryPage, { width: pageWidth, height: stageHeight }]}>
                  {item.kind === "video" ? (
                    <FullscreenVideoSlide
                      uri={item.url}
                      thumbnailUrl={item.thumbnailUrl}
                      stageWidth={stageWidth}
                      stageHeight={stageHeight}
                      isActive={itemIndex === index}
                    />
                  ) : Platform.OS === "web" ? (
                    <WebZoomableImage
                      uri={item.url}
                      placeholderUri={item.thumbnailUrl}
                      stageWidth={stageWidth}
                      stageHeight={stageHeight}
                      onZoomChange={handleZoomChange}
                    />
                  ) : (
                    <NativeZoomableImage
                      uri={item.url}
                      placeholderUri={item.thumbnailUrl}
                      stageWidth={stageWidth}
                      stageHeight={stageHeight}
                      isActive={itemIndex === index}
                      onZoomChange={handleZoomChange}
                    />
                  )}
                </View>
              )}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 10, 11, 0.96)",
  },
  dismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  galleryList: {
    flex: 1,
    width: "100%",
    ...(Platform.OS === "web" ? { overflow: "visible" as const } : null),
  },
  galleryPage: {
    justifyContent: "center",
    alignItems: "center",
    overflow: "visible",
  },
  stage: {
    justifyContent: "center",
    alignItems: "center",
    overflow: "visible",
  },
  zoomLayer: {
    justifyContent: "center",
    alignItems: "center",
    overflow: "visible",
  },
  closeButton: {
    position: "absolute",
    top: Platform.OS === "web" ? spacing.lg : spacing.xxl,
    right: spacing.lg,
    zIndex: 20,
    elevation: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    ...typography.body,
    color: colors.text,
    fontSize: 18,
    lineHeight: 20,
  },
  galleryCounter: {
    position: "absolute",
    top: Platform.OS === "web" ? spacing.lg : spacing.xxl,
    left: spacing.lg,
    zIndex: 20,
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
