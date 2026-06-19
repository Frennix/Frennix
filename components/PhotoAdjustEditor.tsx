import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import {
  avatarFrameSize,
  clampCropTransform,
  exportAdjustedPhoto,
  feedFrameSize,
  getImageDimensions,
  rotatePhoto,
  type CropTransform,
} from "@/lib/photo-adjustment";
import type { PhotoAdjustmentMode } from "@/lib/photo-adjustment-flow";
import { colors, radius, spacing, typography } from "@frennix/ui";

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function clampTranslationWorklet(
  translateX: number,
  translateY: number,
  scale: number,
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number
) {
  "worklet";
  const coverScale = Math.max(frameWidth / imageWidth, frameHeight / imageHeight);
  const totalScale = coverScale * scale;
  const displayWidth = imageWidth * totalScale;
  const displayHeight = imageHeight * totalScale;
  const maxX = Math.max(0, (displayWidth - frameWidth) / 2);
  const maxY = Math.max(0, (displayHeight - frameHeight) / 2);

  return {
    x: Math.min(maxX, Math.max(-maxX, translateX)),
    y: Math.min(maxY, Math.max(-maxY, translateY)),
  };
}

type PhotoAdjustEditorProps = {
  uri: string;
  mode?: PhotoAdjustmentMode;
  onDone: (result: { uri: string; mimeType: string; file?: File }) => void;
  onCancel: () => void;
};

export function PhotoAdjustEditor({ uri, mode = "feed", onDone, onCancel }: PhotoAdjustEditorProps) {
  const isAvatar = mode === "avatar";
  const { width: screenWidth } = useWindowDimensions();
  const horizontalPadding = spacing.md * 2;
  const { frameWidth, frameHeight } = useMemo(() => {
    const containerWidth = screenWidth - horizontalPadding;
    return isAvatar
      ? avatarFrameSize(containerWidth)
      : feedFrameSize(containerWidth, screenWidth);
  }, [screenWidth, isAvatar]);

  const [imageUri, setImageUri] = useState(uri);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [error, setError] = useState("");

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchStartScale = useSharedValue(1);
  const pinchStartTranslateX = useSharedValue(0);
  const pinchStartTranslateY = useSharedValue(0);

  const imageWidthSv = useSharedValue(0);
  const imageHeightSv = useSharedValue(0);
  const frameWidthSv = useSharedValue(frameWidth);
  const frameHeightSv = useSharedValue(frameHeight);

  useEffect(() => {
    frameWidthSv.value = frameWidth;
    frameHeightSv.value = frameHeight;
  }, [frameWidth, frameHeight, frameWidthSv, frameHeightSv]);

  const resetTransform = useCallback(() => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getImageDimensions(imageUri)
      .then((dimensions) => {
        if (!cancelled) {
          setImageSize(dimensions);
          imageWidthSv.value = dimensions.width;
          imageHeightSv.value = dimensions.height;
          resetTransform();
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load this image");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [imageUri, imageWidthSv, imageHeightSv, resetTransform]);

  const panGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .onUpdate((event) => {
      const nextX = savedTranslateX.value + event.translationX;
      const nextY = savedTranslateY.value + event.translationY;
      const clamped = clampTranslationWorklet(
        nextX,
        nextY,
        scale.value,
        imageWidthSv.value,
        imageHeightSv.value,
        frameWidthSv.value,
        frameHeightSv.value
      );
      translateX.value = clamped.x;
      translateY.value = clamped.y;
    })
    .onEnd(() => {
      const clamped = clampTranslationWorklet(
        translateX.value,
        translateY.value,
        scale.value,
        imageWidthSv.value,
        imageHeightSv.value,
        frameWidthSv.value,
        frameHeightSv.value
      );
      translateX.value = clamped.x;
      translateY.value = clamped.y;
      savedTranslateX.value = clamped.x;
      savedTranslateY.value = clamped.y;
      savedScale.value = scale.value;
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      pinchStartScale.value = savedScale.value;
      pinchStartTranslateX.value = savedTranslateX.value;
      pinchStartTranslateY.value = savedTranslateY.value;
    })
    .onUpdate((event) => {
      const nextScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, pinchStartScale.value * event.scale)
      );
      const scaleRatio = nextScale / pinchStartScale.value;

      const focalOffsetX = event.focalX - frameWidthSv.value / 2;
      const focalOffsetY = event.focalY - frameHeightSv.value / 2;

      const nextX = focalOffsetX - scaleRatio * (focalOffsetX - pinchStartTranslateX.value);
      const nextY = focalOffsetY - scaleRatio * (focalOffsetY - pinchStartTranslateY.value);

      const clamped = clampTranslationWorklet(
        nextX,
        nextY,
        nextScale,
        imageWidthSv.value,
        imageHeightSv.value,
        frameWidthSv.value,
        frameHeightSv.value
      );

      scale.value = nextScale;
      translateX.value = clamped.x;
      translateY.value = clamped.y;
    })
    .onEnd(() => {
      const clamped = clampTranslationWorklet(
        translateX.value,
        translateY.value,
        scale.value,
        imageWidthSv.value,
        imageHeightSv.value,
        frameWidthSv.value,
        frameHeightSv.value
      );
      translateX.value = clamped.x;
      translateY.value = clamped.y;
      savedTranslateX.value = clamped.x;
      savedTranslateY.value = clamped.y;
      savedScale.value = scale.value;
    });

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  const imageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const baseImageLayout = useMemo(() => {
    if (!imageSize) return null;
    const coverScale = Math.max(frameWidth / imageSize.width, frameHeight / imageSize.height);
    const width = imageSize.width * coverScale;
    const height = imageSize.height * coverScale;
    return {
      width,
      height,
      left: (frameWidth - width) / 2,
      top: (frameHeight - height) / 2,
    };
  }, [imageSize, frameWidth, frameHeight]);

  function applyTransform(next: CropTransform) {
    if (!imageSize) return;
    const clamped = clampCropTransform(
      {
        scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, next.scale)),
        translateX: next.translateX,
        translateY: next.translateY,
      },
      imageSize.width,
      imageSize.height,
      frameWidth,
      frameHeight
    );
    scale.value = clamped.scale;
    savedScale.value = clamped.scale;
    translateX.value = clamped.translateX;
    translateY.value = clamped.translateY;
    savedTranslateX.value = clamped.translateX;
    savedTranslateY.value = clamped.translateY;
  }

  function adjustZoom(delta: number) {
    applyTransform({
      scale: savedScale.value + delta,
      translateX: savedTranslateX.value,
      translateY: savedTranslateY.value,
    });
  }

  async function handleRotate() {
    if (rotating || exporting) return;
    setRotating(true);
    setError("");
    try {
      const rotatedUri = await rotatePhoto(imageUri);
      setImageUri(rotatedUri);
      resetTransform();
    } catch {
      setError("Could not rotate image");
    } finally {
      setRotating(false);
    }
  }

  async function handleDone() {
    if (!imageSize || exporting) return;
    setExporting(true);
    setError("");

    const transform: CropTransform = clampCropTransform(
      {
        scale: savedScale.value,
        translateX: savedTranslateX.value,
        translateY: savedTranslateY.value,
      },
      imageSize.width,
      imageSize.height,
      frameWidth,
      frameHeight
    );

    try {
      const exported = await exportAdjustedPhoto(
        imageUri,
        imageSize.width,
        imageSize.height,
        frameWidth,
        frameHeight,
        transform,
        isAvatar ? { maxEdge: 512 } : undefined
      );
      onDone({ uri: exported.uri, mimeType: exported.mimeType, file: exported.file });
    } catch {
      setError("Could not save adjusted photo");
      setExporting(false);
    }
  }

  const frameRadius = isAvatar ? frameWidth / 2 : radius.md;
  const gestureSurfaceStyle = Platform.OS === "web" ? styles.gestureSurfaceWeb : undefined;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isAvatar ? "Adjust profile photo" : "Adjust photo"}</Text>
      <Text style={styles.subtitle}>
        {isAvatar
          ? "Pinch with two fingers to zoom and drag to reposition inside the circle."
          : "Pinch to zoom, drag to reposition. Preview matches how photos appear in the feed."}
      </Text>

      <View
        style={[
          styles.frameOuter,
          { width: frameWidth, height: frameHeight, borderRadius: frameRadius },
        ]}
      >
        {loading || !imageSize || !baseImageLayout ? (
          <View style={styles.frameLoading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <GestureDetector gesture={composedGesture}>
            <Animated.View
              style={[styles.gestureSurface, gestureSurfaceStyle]}
              collapsable={false}
            >
              <Animated.Image
                source={{ uri: imageUri }}
                style={[styles.image, baseImageLayout, imageAnimatedStyle]}
                resizeMode="cover"
              />
            </Animated.View>
          </GestureDetector>
        )}
        <View
          style={[styles.frameBorder, { borderRadius: frameRadius }]}
          pointerEvents="none"
        />
        <View style={styles.feedBadge} pointerEvents="none">
          <Text style={styles.feedBadgeText}>
            {isAvatar ? "Profile preview" : "Feed preview"}
          </Text>
        </View>
      </View>

      <View style={styles.controls}>
        <Pressable style={styles.controlButton} onPress={() => adjustZoom(0.25)} disabled={exporting}>
          <Text style={styles.controlText}>Zoom +</Text>
        </Pressable>
        <Pressable style={styles.controlButton} onPress={() => adjustZoom(-0.25)} disabled={exporting}>
          <Text style={styles.controlText}>Zoom −</Text>
        </Pressable>
        <Pressable style={styles.controlButton} onPress={handleRotate} disabled={exporting || rotating}>
          <Text style={styles.controlText}>{rotating ? "…" : "Rotate"}</Text>
        </Pressable>
        <Pressable style={styles.controlButton} onPress={resetTransform} disabled={exporting}>
          <Text style={styles.controlText}>Reset</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Pressable style={styles.cancelButton} onPress={onCancel} disabled={exporting}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.doneButton, exporting && styles.doneButtonDisabled]}
          onPress={handleDone}
          disabled={exporting || loading || !imageSize}
        >
          {exporting ? (
            <ActivityIndicator color={colors.black} size="small" />
          ) : (
            <Text style={styles.doneText}>Done</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
    gap: spacing.md,
  },
  title: { ...typography.heading, fontSize: 22 },
  subtitle: { ...typography.bodySmall, color: colors.textMuted, lineHeight: 20 },
  frameOuter: {
    alignSelf: "center",
    position: "relative",
    overflow: "hidden",
    backgroundColor: colors.surfaceElevated,
  },
  gestureSurface: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  gestureSurfaceWeb: {
    touchAction: "none",
    userSelect: "none",
    cursor: "grab",
  } as object,
  frameLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    position: "absolute",
  },
  frameBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  feedBadge: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: "rgba(10, 10, 11, 0.75)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  feedBadgeText: { ...typography.caption, color: colors.text, fontWeight: "600" },
  controls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "center",
  },
  controlButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  controlText: { ...typography.bodySmall, color: colors.text, fontWeight: "600" },
  error: { ...typography.bodySmall, color: colors.danger, textAlign: "center" },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: "auto",
  },
  cancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  cancelText: { ...typography.body, color: colors.textSecondary, fontWeight: "600" },
  doneButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  doneButtonDisabled: { opacity: 0.6 },
  doneText: { ...typography.body, color: colors.black, fontWeight: "700" },
});
