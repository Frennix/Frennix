import { useEffect, useRef, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { colors, spacing, typography } from "@frennix/ui";

interface ImageLightboxProps {
  uri: string | null;
  onClose: () => void;
}

function clampScale(value: number) {
  return Math.min(Math.max(value, 1), 4);
}

function NativeLightboxImage({ uri, maxWidth, maxHeight }: { uri: string; maxWidth: number; maxHeight: number }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = clampScale(savedScale.value * event.scale);
    })
    .onEnd(() => {
      if (scale.value <= 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        return;
      }
      savedScale.value = scale.value;
    });

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value <= 1) return;
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={[styles.imageFrame, { width: maxWidth, height: maxHeight }]}>
      <GestureDetector gesture={Gesture.Simultaneous(pinch, pan)}>
        <Animated.Image
          source={{ uri }}
          style={[styles.image, animatedStyle]}
          resizeMode="contain"
          accessibilityLabel="Full size image"
        />
      </GestureDetector>
    </View>
  );
}

function WebLightboxImage({ uri, maxWidth, maxHeight }: { uri: string; maxWidth: number; maxHeight: number }) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const frameRef = useRef<View>(null);

  useEffect(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, [uri]);

  useEffect(() => {
    if (!uri) return;

    function onWheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.15 : 0.15;
      setScale((current) => {
        const next = clampScale(current + delta);
        if (next <= 1) setPan({ x: 0, y: 0 });
        return next;
      });
    }

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [uri]);

  function distance(touches: TouchList) {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  return (
    <View
      ref={frameRef}
      style={[styles.imageFrame, { width: maxWidth, height: maxHeight }]}
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
      }}
    >
      <Image
        source={{ uri }}
        style={[
          styles.image,
          {
            transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale }],
          },
        ]}
        resizeMode="contain"
        accessibilityLabel="Full size image"
      />
    </View>
  );
}

export function ImageLightbox({ uri, onClose }: ImageLightboxProps) {
  const { width, height } = useWindowDimensions();
  const imageMaxWidth = width - spacing.xl * 2;
  const imageMaxHeight = height - spacing.xxl * 4;

  return (
    <Modal
      visible={!!uri}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          style={styles.dismissArea}
          onPress={onClose}
          accessibilityLabel="Dismiss image preview"
        />

        <View style={styles.content} pointerEvents="box-none">
          <Pressable
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.closeText}>✕</Text>
          </Pressable>

          {uri ? (
            Platform.OS === "web" ? (
              <WebLightboxImage uri={uri} maxWidth={imageMaxWidth} maxHeight={imageMaxHeight} />
            ) : (
              <NativeLightboxImage uri={uri} maxWidth={imageMaxWidth} maxHeight={imageMaxHeight} />
            )
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
    justifyContent: "center",
    alignItems: "center",
  },
  dismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    zIndex: 1,
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
  imageFrame: {
    zIndex: 1,
    alignSelf: "center",
    overflow: "visible",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
