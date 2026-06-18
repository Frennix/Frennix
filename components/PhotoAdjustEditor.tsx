import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import {
  exportAdjustedPhoto,
  feedFrameSize,
  getImageDimensions,
  rotatePhoto,
  type CropTransform,
} from "@/lib/photo-adjustment";
import { colors, radius, spacing, typography } from "@frennix/ui";

const MIN_SCALE = 1;
const MAX_SCALE = 4;

type PhotoAdjustEditorProps = {
  uri: string;
  onDone: (result: { uri: string; mimeType: string; file?: File }) => void;
  onCancel: () => void;
};

export function PhotoAdjustEditor({ uri, onDone, onCancel }: PhotoAdjustEditorProps) {
  const { width: screenWidth } = useWindowDimensions();
  const horizontalPadding = spacing.md * 2;
  const { frameWidth, frameHeight } = useMemo(
    () => feedFrameSize(screenWidth - horizontalPadding, screenWidth),
    [screenWidth]
  );

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
  }, [imageUri]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, savedScale.value * event.scale));
      scale.value = next;
    })
    .onEnd(() => {
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

  const baseImageStyle = useMemo(() => {
    if (!imageSize) return null;
    const coverScale = Math.max(frameWidth / imageSize.width, frameHeight / imageSize.height);
    return {
      width: imageSize.width * coverScale,
      height: imageSize.height * coverScale,
    };
  }, [imageSize, frameWidth, frameHeight]);

  function adjustZoom(delta: number) {
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, savedScale.value + delta));
    scale.value = next;
    savedScale.value = next;
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

    const transform: CropTransform = {
      scale: savedScale.value,
      translateX: savedTranslateX.value,
      translateY: savedTranslateY.value,
    };

    try {
      const exported = await exportAdjustedPhoto(
        imageUri,
        imageSize.width,
        imageSize.height,
        frameWidth,
        frameHeight,
        transform
      );
      onDone({ uri: exported.uri, mimeType: exported.mimeType, file: exported.file });
    } catch {
      setError("Could not save adjusted photo");
      setExporting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Adjust photo</Text>
      <Text style={styles.subtitle}>
        Pinch to zoom, drag to reposition. Preview matches how photos appear in the feed.
      </Text>

      <View style={[styles.frameOuter, { width: frameWidth, height: frameHeight }]}>
        {loading || !imageSize || !baseImageStyle ? (
          <View style={styles.frameLoading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <GestureDetector gesture={composedGesture}>
            <View style={styles.frame}>
              <Animated.Image
                source={{ uri: imageUri }}
                style={[styles.image, baseImageStyle, imageAnimatedStyle]}
                resizeMode="cover"
              />
            </View>
          </GestureDetector>
        )}
        <View style={styles.frameBorder} pointerEvents="none" />
        <View style={styles.feedBadge} pointerEvents="none">
          <Text style={styles.feedBadgeText}>Feed preview</Text>
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
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceElevated,
  },
  frame: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
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
    borderRadius: radius.md,
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
