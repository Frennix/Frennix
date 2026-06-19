import { useEffect, useRef, type RefObject } from "react";
import type { View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import { clampTranslation, computePinchTransform } from "@/lib/photo-adjustment";

const MIN_SCALE = 1;
const MAX_SCALE = 4;

type GestureMode = "idle" | "pan" | "pinch";

type TouchSession = {
  mode: GestureMode;
  panStartX: number;
  panStartY: number;
  panOriginX: number;
  panOriginY: number;
  pinchStartDistance: number;
  pinchStartScale: number;
  pinchStartTranslateX: number;
  pinchStartTranslateY: number;
};

type UseWebCropGesturesOptions = {
  enabled: boolean;
  /** Resolved DOM element for the crop surface (RN web ref). */
  domElement: HTMLElement | null;
  frameWidth: number;
  frameHeight: number;
  imageWidth: number;
  imageHeight: number;
  scale: SharedValue<number>;
  savedScale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  savedTranslateX: SharedValue<number>;
  savedTranslateY: SharedValue<number>;
};

/** Resolve the underlying DOM node from a React Native web View ref. */
export function resolveCropSurfaceElement(ref: RefObject<View | null>): HTMLElement | null {
  const node = ref.current;
  if (!node) return null;

  if (typeof HTMLElement !== "undefined" && node instanceof HTMLElement) {
    return node;
  }

  const internal = node as {
    _nativeTag?: HTMLElement;
    node?: HTMLElement;
    getScrollableNode?: () => HTMLElement | null;
  };

  if (internal._nativeTag instanceof HTMLElement) return internal._nativeTag;
  if (internal.node instanceof HTMLElement) return internal.node;
  if (typeof internal.getScrollableNode === "function") {
    const scrollNode = internal.getScrollableNode();
    if (scrollNode instanceof HTMLElement) return scrollNode;
  }

  return node as unknown as HTMLElement;
}

function touchDistance(a: Touch, b: Touch) {
  return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
}

function touchMidpoint(a: Touch, b: Touch, rect: DOMRect) {
  return {
    x: (a.clientX + b.clientX) / 2 - rect.left,
    y: (a.clientY + b.clientY) / 2 - rect.top,
  };
}

function commitTransform(
  transform: { scale: number; translateX: number; translateY: number },
  scale: SharedValue<number>,
  savedScale: SharedValue<number>,
  translateX: SharedValue<number>,
  translateY: SharedValue<number>,
  savedTranslateX: SharedValue<number>,
  savedTranslateY: SharedValue<number>
) {
  scale.value = transform.scale;
  translateX.value = transform.translateX;
  translateY.value = transform.translateY;
  savedScale.value = transform.scale;
  savedTranslateX.value = transform.translateX;
  savedTranslateY.value = transform.translateY;
}

/**
 * iOS Safari / PWA do not deliver RNGH Pinch events reliably.
 * Attach native touch listeners with { passive: false } so preventDefault()
 * blocks browser page zoom and enables two-finger pinch on the crop surface.
 */
export function useWebCropGestures({
  enabled,
  domElement,
  frameWidth,
  frameHeight,
  imageWidth,
  imageHeight,
  scale,
  savedScale,
  translateX,
  translateY,
  savedTranslateX,
  savedTranslateY,
}: UseWebCropGesturesOptions) {
  const sessionRef = useRef<TouchSession>({
    mode: "idle",
    panStartX: 0,
    panStartY: 0,
    panOriginX: 0,
    panOriginY: 0,
    pinchStartDistance: 0,
    pinchStartScale: 1,
    pinchStartTranslateX: 0,
    pinchStartTranslateY: 0,
  });

  const metricsRef = useRef({
    frameWidth,
    frameHeight,
    imageWidth,
    imageHeight,
  });

  useEffect(() => {
    metricsRef.current = { frameWidth, frameHeight, imageWidth, imageHeight };
  }, [frameWidth, frameHeight, imageWidth, imageHeight]);

  useEffect(() => {
    if (!enabled || imageWidth <= 0 || imageHeight <= 0 || !domElement?.addEventListener) {
      return;
    }

    const element = domElement;
    const session = sessionRef.current;

    function beginPinch(touches: TouchList, rect: DOMRect) {
      if (touches.length < 2) return;
      const { distance, x, y } = {
        distance: touchDistance(touches[0], touches[1]),
        ...touchMidpoint(touches[0], touches[1], rect),
      };
      session.mode = "pinch";
      session.pinchStartDistance = Math.max(distance, 1);
      session.pinchStartScale = savedScale.value;
      session.pinchStartTranslateX = savedTranslateX.value;
      session.pinchStartTranslateY = savedTranslateY.value;
      session.panStartX = x;
      session.panStartY = y;
    }

    function beginPan(touch: Touch, rect: DOMRect) {
      session.mode = "pan";
      session.panStartX = touch.clientX;
      session.panStartY = touch.clientY;
      session.panOriginX = savedTranslateX.value;
      session.panOriginY = savedTranslateY.value;
    }

    function onTouchStart(event: TouchEvent) {
      const rect = element.getBoundingClientRect();
      const touches = event.touches;

      if (touches.length >= 2) {
        beginPinch(touches, rect);
        event.preventDefault();
        return;
      }

      if (touches.length === 1 && session.mode === "idle") {
        beginPan(touches[0], rect);
      }
    }

    function onTouchMove(event: TouchEvent) {
      const { frameWidth: fw, frameHeight: fh, imageWidth: iw, imageHeight: ih } =
        metricsRef.current;
      const rect = element.getBoundingClientRect();
      const touches = event.touches;

      if (touches.length >= 2) {
        event.preventDefault();

        if (session.mode !== "pinch") {
          beginPinch(touches, rect);
        }

        const distance = touchDistance(touches[0], touches[1]);
        const { x: focalX, y: focalY } = touchMidpoint(touches[0], touches[1], rect);
        const multiplier = distance / session.pinchStartDistance;

        const next = computePinchTransform(
          session.pinchStartScale,
          session.pinchStartTranslateX,
          session.pinchStartTranslateY,
          multiplier,
          focalX,
          focalY,
          fw,
          fh,
          iw,
          ih,
          MIN_SCALE,
          MAX_SCALE
        );

        scale.value = next.scale;
        translateX.value = next.translateX;
        translateY.value = next.translateY;
        return;
      }

      if (touches.length === 1 && session.mode === "pan") {
        event.preventDefault();

        const touch = touches[0];
        const deltaX = touch.clientX - session.panStartX;
        const deltaY = touch.clientY - session.panStartY;
        const clamped = clampTranslation(
          session.panOriginX + deltaX,
          session.panOriginY + deltaY,
          scale.value,
          iw,
          ih,
          fw,
          fh
        );
        translateX.value = clamped.x;
        translateY.value = clamped.y;
      }
    }

    function onTouchEnd(event: TouchEvent) {
      const touches = event.touches;
      const rect = element.getBoundingClientRect();

      if (touches.length >= 2) {
        beginPinch(touches, rect);
        return;
      }

      if (touches.length === 1) {
        commitTransform(
          {
            scale: scale.value,
            translateX: translateX.value,
            translateY: translateY.value,
          },
          scale,
          savedScale,
          translateX,
          translateY,
          savedTranslateX,
          savedTranslateY
        );
        beginPan(touches[0], rect);
        return;
      }

      if (session.mode !== "idle") {
        commitTransform(
          {
            scale: scale.value,
            translateX: translateX.value,
            translateY: translateY.value,
          },
          scale,
          savedScale,
          translateX,
          translateY,
          savedTranslateX,
          savedTranslateY
        );
      }

      session.mode = "idle";
    }

    const touchOptions: AddEventListenerOptions = { passive: false, capture: true };

    element.addEventListener("touchstart", onTouchStart, touchOptions);
    element.addEventListener("touchmove", onTouchMove, touchOptions);
    element.addEventListener("touchend", onTouchEnd, touchOptions);
    element.addEventListener("touchcancel", onTouchEnd, touchOptions);

    return () => {
      element.removeEventListener("touchstart", onTouchStart, touchOptions);
      element.removeEventListener("touchmove", onTouchMove, touchOptions);
      element.removeEventListener("touchend", onTouchEnd, touchOptions);
      element.removeEventListener("touchcancel", onTouchEnd, touchOptions);
      session.mode = "idle";
    };
  }, [
    enabled,
    domElement,
    imageWidth,
    imageHeight,
    scale,
    savedScale,
    translateX,
    translateY,
    savedTranslateX,
    savedTranslateY,
  ]);
}
