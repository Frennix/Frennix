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
import { MediaLoadError } from "../packages/ui/src/MediaLoadError";
import type { FeedVideoFullscreenHandoff } from "../packages/ui/src/feedVideoPlaybackCoordinator";
import { ImmersiveVideoViewer } from "@/components/ImmersiveVideoViewer";
import { ImmersiveVideoOverlayShell } from "@/components/ImmersiveVideoOverlayShell";
import { isMobileWeb } from "@/lib/safari-visual-viewport";
import type { ImmersiveVideoGalleryContext } from "@/lib/immersive-video-gallery";
import type { ImmersiveVideoPlaylistState } from "@/lib/immersive-video-playlist-state";
import type { GalleryCloseContext } from "@/lib/useMediaGallery";
import type { Post } from "@frennix/types";
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
  withSpring,
} from "react-native-reanimated";
import { setLightboxOverlayOpen } from "@/lib/lightbox-overlay-state";
import { useCommentsOverlayOpen } from "@/lib/comments-overlay-state";
import {
  captureImmersiveSessionLayoutHeight,
  clearImmersiveSessionLayoutHeight,
} from "@/lib/immersive-session-layout";
import { restoreWebDocumentScrollLock } from "@/lib/web-modal-scroll-lock";

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
  immersiveVideo?: ImmersiveVideoGalleryContext;
  immersiveVideoPlaylist?: ImmersiveVideoPlaylistState;
  immersiveVideoUserId?: string;
  immersiveVideoAuthorProfile?: Post["author"];
  commentsInitiallyOpen?: boolean;
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
  onClose: (index: number, context?: GalleryCloseContext) => void;
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

const ZOOM_SCALE = 2;
const ZOOM_ANIM_MS = 240;
const SNAP_ANIM_MS = 260;
const RUBBERBAND_RATIO = 0.38;
const ZOOM_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const ZOOM_SPRING = { damping: 20, stiffness: 240, mass: 0.7 };

function clampScale(value: number) {
  "worklet";
  return Math.min(Math.max(value, 1), 4);
}

function getPanBounds(
  scale: number,
  rendered: { width: number; height: number },
  viewport: { width: number; height: number }
) {
  "worklet";
  return {
    maxX: Math.max(0, (rendered.width * scale - viewport.width) / 2),
    maxY: Math.max(0, (rendered.height * scale - viewport.height) / 2),
  };
}

function clampAxis(value: number, max: number) {
  "worklet";
  if (max <= 0) return 0;
  return Math.min(max, Math.max(-max, value));
}

function clampPan(x: number, y: number, bounds: { maxX: number; maxY: number }) {
  "worklet";
  return { x: clampAxis(x, bounds.maxX), y: clampAxis(y, bounds.maxY) };
}

function rubberbandAxis(offset: number, max: number, dimension: number) {
  "worklet";
  const resistance = Math.max(dimension * RUBBERBAND_RATIO, 24);
  if (max <= 0) {
    return (offset * RUBBERBAND_RATIO) / (1 + Math.abs(offset) / resistance);
  }
  if (offset > max) {
    const extra = offset - max;
    return max + extra / (1 + extra / resistance);
  }
  if (offset < -max) {
    const extra = -max - offset;
    return -max - extra / (1 + extra / resistance);
  }
  return offset;
}

function getContainedRenderedSize(
  naturalWidth: number,
  naturalHeight: number,
  viewport: { width: number; height: number }
) {
  if (!naturalWidth || !naturalHeight || viewport.width <= 0 || viewport.height <= 0) {
    return { width: viewport.width, height: viewport.height };
  }
  const fit = Math.min(viewport.width / naturalWidth, viewport.height / naturalHeight);
  return { width: naturalWidth * fit, height: naturalHeight * fit };
}

function zoomPanForDoubleTap(
  clientX: number,
  clientY: number,
  stage: { left: number; top: number; width: number; height: number },
  nextScale = ZOOM_SCALE
) {
  const dx = clientX - (stage.left + stage.width / 2);
  const dy = clientY - (stage.top + stage.height / 2);
  return {
    x: dx * (1 - nextScale),
    y: dy * (1 - nextScale),
    scale: nextScale,
  };
}

function isPointInsideContainedImage(
  img: HTMLImageElement,
  clientX: number,
  clientY: number
): boolean {
  const bounds = img.getBoundingClientRect();
  const { naturalWidth, naturalHeight } = img;
  if (!naturalWidth || !naturalHeight || bounds.width <= 0 || bounds.height <= 0) {
    return false;
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
  const viewWidth = useSharedValue(1);
  const viewHeight = useSharedValue(1);

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
    scale.value = withSpring(1, ZOOM_SPRING);
    savedScale.value = 1;
    translateX.value = withSpring(0, ZOOM_SPRING);
    translateY.value = withSpring(0, ZOOM_SPRING);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    onZoomChange(false);
  }, [onZoomChange, scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY]);

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      const next = clampScale(savedScale.value * event.scale);
      scale.value = next;
      if (next <= 1.01) {
        translateX.value = 0;
        translateY.value = 0;
        onZoomChange(false);
        return;
      }
      const bounds = getPanBounds(
        next,
        { width: viewWidth.value, height: viewHeight.value },
        { width: viewWidth.value, height: viewHeight.value }
      );
      translateX.value = clampAxis(savedTranslateX.value, bounds.maxX);
      translateY.value = clampAxis(savedTranslateY.value, bounds.maxY);
      onZoomChange(true);
    })
    .onEnd(() => {
      if (scale.value <= 1.01) {
        resetZoom();
        return;
      }
      const bounds = getPanBounds(
        scale.value,
        { width: viewWidth.value, height: viewHeight.value },
        { width: viewWidth.value, height: viewHeight.value }
      );
      const next = clampPan(translateX.value, translateY.value, bounds);
      scale.value = withSpring(scale.value, ZOOM_SPRING);
      translateX.value = withSpring(next.x, ZOOM_SPRING);
      translateY.value = withSpring(next.y, ZOOM_SPRING);
      savedScale.value = scale.value;
      savedTranslateX.value = next.x;
      savedTranslateY.value = next.y;
      onZoomChange(true);
    });

  const pan = Gesture.Pan()
    .manualActivation(true)
    .onTouchesMove((_event, state) => {
      if (scale.value > 1.01) state.activate();
      else state.fail();
    })
    .onUpdate((event) => {
      const bounds = getPanBounds(
        scale.value,
        { width: viewWidth.value, height: viewHeight.value },
        { width: viewWidth.value, height: viewHeight.value }
      );
      translateX.value = rubberbandAxis(
        savedTranslateX.value + event.translationX,
        bounds.maxX,
        viewWidth.value
      );
      translateY.value = rubberbandAxis(
        savedTranslateY.value + event.translationY,
        bounds.maxY,
        viewHeight.value
      );
    })
    .onEnd(() => {
      const bounds = getPanBounds(
        scale.value,
        { width: viewWidth.value, height: viewHeight.value },
        { width: viewWidth.value, height: viewHeight.value }
      );
      const next = clampPan(translateX.value, translateY.value, bounds);
      translateX.value = withSpring(next.x, ZOOM_SPRING);
      translateY.value = withSpring(next.y, ZOOM_SPRING);
      savedTranslateX.value = next.x;
      savedTranslateY.value = next.y;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      if (scale.value > 1.01) {
        resetZoom();
        return;
      }
      const nextScale = ZOOM_SCALE;
      const bounds = getPanBounds(
        nextScale,
        { width: viewWidth.value, height: viewHeight.value },
        { width: viewWidth.value, height: viewHeight.value }
      );
      const next = clampPan(
        (event.x - viewWidth.value / 2) * (1 - nextScale),
        (event.y - viewHeight.value / 2) * (1 - nextScale),
        bounds
      );
      scale.value = withSpring(nextScale, ZOOM_SPRING);
      translateX.value = withSpring(next.x, ZOOM_SPRING);
      translateY.value = withSpring(next.y, ZOOM_SPRING);
      savedScale.value = nextScale;
      savedTranslateX.value = next.x;
      savedTranslateY.value = next.y;
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
    <View
      style={styles.imageStage}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0) viewWidth.value = width;
        if (height > 0) viewHeight.value = height;
      }}
    >
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
  onMediaError,
}: {
  uri: string;
  placeholderUri?: string | null;
  onZoomChange: (zoomed: boolean) => void;
  onLetterboxPress?: () => void;
  onMediaError?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pinchStart = useRef<{ distance: number; scale: number; x: number; y: number } | null>(null);
  const lastTap = useRef(0);
  const lastTapPos = useRef<{ x: number; y: number } | null>(null);
  const zoomToggledAt = useRef(0);
  const scaleRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const stageRef = useRef<View>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const movedDuringTouch = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  function getStageRect() {
    const node = stageRef.current as unknown as { getBoundingClientRect?: () => DOMRect } | null;
    return node?.getBoundingClientRect?.() ?? null;
  }

  function measureViewportAndRendered() {
    const stage = getStageRect();
    const img = imgRef.current;
    const viewport = stage
      ? { width: stage.width, height: stage.height }
      : {
          width: typeof window === "undefined" ? 1 : window.innerWidth,
          height: typeof window === "undefined" ? 1 : window.innerHeight,
        };
    const rendered = img
      ? getContainedRenderedSize(img.naturalWidth, img.naturalHeight, viewport)
      : viewport;
    return { viewport, rendered, stage };
  }

  function writeTransform(
    nextScale: number,
    x: number,
    y: number,
    animate: "none" | "zoom" | "snap" = "none"
  ) {
    scaleRef.current = nextScale;
    panRef.current = { x, y };
    const img = imgRef.current;
    if (!img) return;
    const duration = animate === "zoom" ? ZOOM_ANIM_MS : SNAP_ANIM_MS;
    img.style.transition = animate === "none" ? "none" : `transform ${duration}ms ${ZOOM_EASING}`;
    img.style.setProperty("--lx", `${x}px`);
    img.style.setProperty("--ly", `${y}px`);
    img.style.setProperty("--ls", String(nextScale));
    img.style.transform = "translate(var(--lx), var(--ly)) scale(var(--ls))";
  }

  function commitTransform(
    nextScale: number,
    x: number,
    y: number,
    animate: "none" | "zoom" | "snap" = "none"
  ) {
    writeTransform(nextScale, x, y, animate);
    onZoomChange(nextScale > 1.01);
  }

  function snapPanToBounds(nextScale: number, animate: "zoom" | "snap" = "snap") {
    if (nextScale <= 1.01) {
      commitTransform(1, 0, 0, animate);
      return;
    }
    const { viewport, rendered } = measureViewportAndRendered();
    const next = clampPan(
      panRef.current.x,
      panRef.current.y,
      getPanBounds(nextScale, rendered, viewport)
    );
    commitTransform(nextScale, next.x, next.y, animate);
  }

  useEffect(() => {
    writeTransform(1, 0, 0);
    setFailed(false);
    lastTap.current = 0;
    lastTapPos.current = null;
    onZoomChange(false);
  }, [uri, retryKey, onZoomChange]);

  useEffect(() => {
    function onWheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.15 : 0.15;
      const next = clampScale(scaleRef.current + delta);
      if (next <= 1.01) {
        commitTransform(1, 0, 0);
        return;
      }
      const { viewport, rendered } = measureViewportAndRendered();
      const clamped = clampPan(
        panRef.current.x,
        panRef.current.y,
        getPanBounds(next, rendered, viewport)
      );
      commitTransform(next, clamped.x, clamped.y);
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

  function toggleZoomAt(clientX: number, clientY: number) {
    if (scaleRef.current > 1.01) {
      commitTransform(1, 0, 0, "zoom");
      return;
    }
    const { viewport, rendered, stage } = measureViewportAndRendered();
    const raw = stage
      ? zoomPanForDoubleTap(clientX, clientY, stage, ZOOM_SCALE)
      : { x: 0, y: 0, scale: ZOOM_SCALE };
    const next = clampPan(raw.x, raw.y, getPanBounds(raw.scale, rendered, viewport));
    commitTransform(raw.scale, next.x, next.y, "zoom");
  }

  function handlePossibleDoubleTap(clientX: number, clientY: number) {
    const now = Date.now();
    if (now - zoomToggledAt.current < 80) return true;
    if (
      now - lastTap.current < 300 &&
      lastTapPos.current &&
      Math.hypot(clientX - lastTapPos.current.x, clientY - lastTapPos.current.y) < 40
    ) {
      lastTap.current = 0;
      lastTapPos.current = null;
      zoomToggledAt.current = now;
      toggleZoomAt(clientX, clientY);
      return true;
    }
    lastTap.current = now;
    lastTapPos.current = { x: clientX, y: clientY };
    return false;
  }

  function maybeDismissFromLetterbox(clientX: number, clientY: number) {
    if (scaleRef.current > 1.01 || movedDuringTouch.current || !onLetterboxPress || failed) return;
    const img = imgRef.current;
    if (!img) {
      onLetterboxPress();
      return;
    }
    if (!isPointInsideContainedImage(img, clientX, clientY)) {
      onLetterboxPress();
    }
  }

  if (failed) {
    return (
      <View style={styles.imageStage}>
        <MediaLoadError
          label="Photo unavailable"
          style={StyleSheet.absoluteFillObject}
          onRetry={() => {
            setFailed(false);
            setRetryKey((key) => key + 1);
          }}
        />
      </View>
    );
  }

  return (
    <View
      ref={stageRef}
      style={styles.imageStage}
      collapsable={false}
      onTouchStart={(event) => {
        movedDuringTouch.current = false;
        touchStart.current = null;
        writeTransform(scaleRef.current, panRef.current.x, panRef.current.y);
        const touches = event.nativeEvent.touches;
        if (touches.length === 1) {
          touchStart.current = { x: touches[0].pageX, y: touches[0].pageY };
        }
        if (touches.length === 2) {
          const dist = distance(touches as unknown as TouchList);
          pinchStart.current = {
            distance: dist,
            scale: scaleRef.current,
            x: panRef.current.x,
            y: panRef.current.y,
          };
          dragStart.current = null;
          return;
        }
        if (touches.length === 1 && scaleRef.current > 1.01) {
          dragStart.current = {
            x: touches[0].pageX,
            y: touches[0].pageY,
            panX: panRef.current.x,
            panY: panRef.current.y,
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
          if (next <= 1.01) {
            writeTransform(1, 0, 0);
            onZoomChange(false);
            return;
          }
          const { viewport, rendered } = measureViewportAndRendered();
          const bounds = getPanBounds(next, rendered, viewport);
          writeTransform(
            next,
            clampAxis(pinchStart.current.x, bounds.maxX),
            clampAxis(pinchStart.current.y, bounds.maxY)
          );
          onZoomChange(true);
          return;
        }
        if (touches.length === 1 && dragStart.current && scaleRef.current > 1.01) {
          const { viewport, rendered } = measureViewportAndRendered();
          const bounds = getPanBounds(scaleRef.current, rendered, viewport);
          writeTransform(
            scaleRef.current,
            rubberbandAxis(
              dragStart.current.panX + (touches[0].pageX - dragStart.current.x),
              bounds.maxX,
              viewport.width
            ),
            rubberbandAxis(
              dragStart.current.panY + (touches[0].pageY - dragStart.current.y),
              bounds.maxY,
              viewport.height
            )
          );
        }
      }}
      onTouchEnd={(event) => {
        const remaining = event.nativeEvent.touches?.length ?? 0;
        const wasPinch = Boolean(pinchStart.current);
        const wasDrag = Boolean(dragStart.current) && movedDuringTouch.current;
        if (remaining > 0) {
          if (remaining === 1 && scaleRef.current > 1.01) {
            const nextTouch = event.nativeEvent.touches[0];
            if (nextTouch) {
              dragStart.current = {
                x: nextTouch.pageX,
                y: nextTouch.pageY,
                panX: panRef.current.x,
                panY: panRef.current.y,
              };
            }
            pinchStart.current = null;
          }
          return;
        }

        const touch = event.nativeEvent.changedTouches[0];
        pinchStart.current = null;
        dragStart.current = null;
        touchStart.current = null;

        if (wasPinch) {
          snapPanToBounds(scaleRef.current);
          return;
        }
        if (wasDrag) {
          snapPanToBounds(scaleRef.current);
          return;
        }
        if (touch && !movedDuringTouch.current) {
          const didZoom = handlePossibleDoubleTap(touch.pageX, touch.pageY);
          if (!didZoom) {
            maybeDismissFromLetterbox(touch.pageX, touch.pageY);
          }
        }
        if (Date.now() - zoomToggledAt.current < 80) return;
        if (scaleRef.current <= 1.01) {
          commitTransform(1, 0, 0);
        }
      }}
      onTouchCancel={() => {
        pinchStart.current = null;
        dragStart.current = null;
        touchStart.current = null;
        snapPanToBounds(scaleRef.current);
      }}
      // @ts-expect-error web double-click zoom
      onDoubleClick={(event: { clientX: number; clientY: number }) => {
        const now = Date.now();
        if (now - zoomToggledAt.current < 80) return;
        zoomToggledAt.current = now;
        lastTap.current = 0;
        lastTapPos.current = null;
        toggleZoomAt(event.clientX, event.clientY);
      }}
    >
      {createElement("img", {
        key: retryKey,
        ref: imgRef,
        src: uri,
        alt: "",
        draggable: false,
        style: {
          ...WEB_LIGHTBOX_PLAIN_IMG_STYLE,
          transform: "translate(var(--lx, 0px), var(--ly, 0px)) scale(var(--ls, 1))",
          transformOrigin: "center center",
          willChange: "transform",
        },
        onLoad: () => {
          setFailed(false);
          writeTransform(scaleRef.current, panRef.current.x, panRef.current.y);
        },
        onError: () => {
          setFailed(true);
          onMediaError?.();
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
  const [layoutViewportHeight, setLayoutViewportHeight] = useState(() =>
    Platform.OS === "web" && typeof window !== "undefined" ? Math.round(window.innerHeight) : 0
  );
  const commentsOverlayOpen = useCommentsOverlayOpen();
  const listRef = useRef<FlatList<PostMediaItem>>(null);
  const dismissY = useRef(new Animated.Value(0)).current;
  const webSwipeStartY = useRef<number | null>(null);

  const items = gallery ? resolveGalleryItems(gallery) : [];
  const visible = items.length > 0;
  const videoHandoff =
    gallery && isMediaGalleryState(gallery) ? gallery.videoHandoff : undefined;
  const immersiveVideo =
    gallery && isMediaGalleryState(gallery) ? gallery.immersiveVideo : undefined;
  const immersiveVideoPlaylist =
    gallery && isMediaGalleryState(gallery) ? gallery.immersiveVideoPlaylist : undefined;
  const immersiveVideoUserId =
    gallery && isMediaGalleryState(gallery) ? gallery.immersiveVideoUserId : undefined;
  const immersiveVideoAuthorProfile =
    gallery && isMediaGalleryState(gallery) ? gallery.immersiveVideoAuthorProfile : undefined;
  const commentsInitiallyOpen =
    gallery && isMediaGalleryState(gallery) ? Boolean(gallery.commentsInitiallyOpen) : false;
  const useImmersiveVideo =
    Platform.OS === "web" &&
    isMobileWeb() &&
    Boolean(immersiveVideo?.postActions);
  const useImmersiveVideoPlaylist =
    useImmersiveVideo && Boolean(immersiveVideoPlaylist?.entries.length);
  const freezeImmersiveLayout =
    useImmersiveVideoPlaylist && (commentsOverlayOpen || commentsInitiallyOpen);
  const immersiveStageHeight =
    useImmersiveVideo && layoutViewportHeight > 0 ? layoutViewportHeight : pageHeight;
  const playlistCloseContextRef = useRef<GalleryCloseContext>({});

  const syncViewportSize = useCallback(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const viewport = window.visualViewport;
      setPageWidth(Math.round(viewport?.width ?? window.innerWidth));
      setPageHeight(Math.round(viewport?.height ?? window.innerHeight));
      if (!useImmersiveVideo) {
        setLayoutViewportHeight(Math.round(window.innerHeight));
      }
      return;
    }
  }, [useImmersiveVideo]);

  const dismiss = useCallback(() => {
    dismissY.setValue(0);
    onClose(index, useImmersiveVideoPlaylist ? playlistCloseContextRef.current : undefined);
  }, [dismissY, index, onClose, useImmersiveVideoPlaylist]);

  useEffect(() => {
    if (!useImmersiveVideoPlaylist || !immersiveVideoPlaylist) return;
    const entry = immersiveVideoPlaylist.entries[immersiveVideoPlaylist.initialIndex];
    if (entry) {
      playlistCloseContextRef.current = {
        postId: entry.postId,
        mediaIndex: entry.mediaIndex,
      };
    }
  }, [immersiveVideoPlaylist, useImmersiveVideoPlaylist]);

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
    if (!visible || Platform.OS !== "web" || typeof window === "undefined") {
      if (!visible) {
        clearImmersiveSessionLayoutHeight();
      }
      return;
    }
    if (useImmersiveVideo) {
      captureImmersiveSessionLayoutHeight(Math.round(window.innerHeight), false);
    }
    syncViewportSize();
    window.addEventListener("resize", syncViewportSize);
    window.visualViewport?.addEventListener("resize", syncViewportSize);
    return () => {
      window.removeEventListener("resize", syncViewportSize);
      window.visualViewport?.removeEventListener("resize", syncViewportSize);
    };
  }, [syncViewportSize, useImmersiveVideo, visible]);

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
    if (!visible) {
      setLightboxOverlayOpen(false);
      if (Platform.OS === "web") {
        restoreWebDocumentScrollLock();
      }
      return;
    }

    setLightboxOverlayOpen(true);

    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }

    return () => {
      setLightboxOverlayOpen(false);
      if (Platform.OS === "web") {
        restoreWebDocumentScrollLock();
      }
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
          !useImmersiveVideoPlaylist &&
          !zoomed &&
          gesture.dy > 8 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx),
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
    [dismiss, dismissY, useImmersiveVideoPlaylist, zoomed]
  );

  const handleWebTouchStart = useCallback(
    (event: { nativeEvent: { touches: Array<{ pageY: number }> } }) => {
      if (useImmersiveVideoPlaylist || zoomed || event.nativeEvent.touches.length !== 1) {
        webSwipeStartY.current = null;
        return;
      }
      webSwipeStartY.current = event.nativeEvent.touches[0].pageY;
    },
    [useImmersiveVideoPlaylist, zoomed]
  );

  const handleWebTouchMove = useCallback(
    (event: {
      nativeEvent: { touches: Array<{ pageY: number; pageX: number }> };
    }) => {
      if (
        useImmersiveVideoPlaylist ||
        zoomed ||
        webSwipeStartY.current === null ||
        event.nativeEvent.touches.length !== 1
      ) {
        return;
      }
      const touch = event.nativeEvent.touches[0];
      const dy = touch.pageY - webSwipeStartY.current;
      if (dy > 8) dismissY.setValue(dy);
    },
    [dismissY, useImmersiveVideoPlaylist, zoomed]
  );

  const handleWebTouchEnd = useCallback(
    (event: { nativeEvent: { changedTouches: Array<{ pageY: number }> } }) => {
      if (useImmersiveVideoPlaylist || zoomed || webSwipeStartY.current === null) {
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
    [dismiss, dismissY, useImmersiveVideoPlaylist, zoomed]
  );

  const handlePlaylistActiveEntryChange = useCallback(
    (entry: { postId: string; mediaIndex: number }) => {
      playlistCloseContextRef.current = entry;
    },
    []
  );

  if (!visible) return null;

  return (
    <View
      style={[
        styles.root,
        LIGHTBOX_WEB_ROOT,
        freezeImmersiveLayout ? ({ overflow: "visible" } as ViewStyle) : null,
      ]}
      {...(Platform.OS === "web"
        ? ({
            "data-frennix-lightbox": "true",
            ...(freezeImmersiveLayout
              ? ({ "data-frennix-immersive-comments-open": "true" } as object)
              : null),
          } as object)
        : null)}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (Platform.OS === "web") {
          if (useImmersiveVideo && height > 0) {
            setLayoutViewportHeight((current) => {
              if (freezeImmersiveLayout && current > 0) return current;
              return Math.round(height);
            });
          }
          syncViewportSize();
          return;
        }
        if (width > 0) setPageWidth(Math.round(width));
        if (height > 0) setPageHeight(Math.round(height));
      }}
      {...(Platform.OS !== "web" ? panResponder.panHandlers : {})}
      onTouchStart={Platform.OS === "web" ? handleWebTouchStart : undefined}
      onTouchMove={Platform.OS === "web" ? handleWebTouchMove : undefined}
      onTouchEnd={Platform.OS === "web" ? handleWebTouchEnd : undefined}
    >
      <Animated.View
        style={[
          styles.stageShell,
          freezeImmersiveLayout ? ({ overflow: "visible" } as ViewStyle) : null,
          freezeImmersiveLayout ? null : { transform: [{ translateY: dismissY }] },
        ]}
        pointerEvents="box-none"
        {...(Platform.OS === "web" && freezeImmersiveLayout
          ? ({ "data-frennix-lightbox-stage-shell": "true" } as object)
          : null)}
      >
        {pageWidth > 0 && pageHeight > 0 ? (
          useImmersiveVideoPlaylist && immersiveVideoPlaylist && immersiveVideoUserId ? (
            <ImmersiveVideoOverlayShell
              playlist={immersiveVideoPlaylist}
              userId={immersiveVideoUserId}
              authorProfile={immersiveVideoAuthorProfile}
              stageWidth={pageWidth}
              stageHeight={immersiveStageHeight}
              onClose={dismiss}
              onActiveEntryChange={handlePlaylistActiveEntryChange}
              commentsInitiallyOpen={commentsInitiallyOpen}
            />
          ) : (
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
                  useImmersiveVideo ? (
                    <ImmersiveVideoViewer
                      item={item}
                      mediaIndex={itemIndex}
                      stageWidth={pageWidth}
                      stageHeight={pageHeight}
                      isActive={itemIndex === index}
                      playbackHandoff={
                        itemIndex === index
                          ? immersiveVideo?.resumeHandoff ??
                            (videoHandoff && videoHandoff.mediaIndex === itemIndex
                              ? videoHandoff
                              : undefined)
                          : undefined
                      }
                      postActions={immersiveVideo!.postActions}
                      onClose={dismiss}
                    />
                  ) : (
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
                  )
                ) : Platform.OS === "web" ? (
                  <WebZoomableImage
                    uri={item.url}
                    placeholderUri={item.thumbnailUrl}
                    onZoomChange={handleZoomChange}
                    onLetterboxPress={!zoomed ? dismiss : undefined}
                    onMediaError={dismiss}
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
          )
        ) : null}
      </Animated.View>

      <View style={styles.chromeLayer} pointerEvents="box-none">
        {!useImmersiveVideo || items[index]?.kind !== "video" ? (
        <Pressable
          style={[styles.closeButton, { top: chromeTop }]}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Close"
          accessibilityHint="Closes the photo viewer"
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
        ) : null}

        { !useImmersiveVideoPlaylist && items.length > 1 ? (
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
