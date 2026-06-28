import { useCallback, useMemo } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { CachedImage, colors, radius, spacing, typography } from "@frennix/ui";
import { hapticLight } from "@/lib/haptics";

const TILE_WIDTH = 220;
const TILE_GAP = spacing.sm;
const SLOT_WIDTH = TILE_WIDTH + TILE_GAP;

export type ReorderablePhoto = {
  uri: string;
  key: string;
};

type ReorderablePhotoStripProps = {
  photos: ReorderablePhoto[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
};

function clampIndex(value: number, max: number) {
  return Math.min(Math.max(value, 0), max);
}

function DraggablePhotoTile({
  photo,
  index,
  total,
  disabled,
  onRemove,
  onReorder,
}: {
  photo: ReorderablePhoto;
  index: number;
  total: number;
  disabled?: boolean;
  onRemove: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);

  const commitReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex !== toIndex) {
        hapticLight();
        onReorder(fromIndex, toIndex);
      }
    },
    [onReorder]
  );

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activateAfterLongPress(180)
    .onBegin(() => {
      scale.value = withSpring(1.04);
      zIndex.value = 10;
      runOnJS(hapticLight)();
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onFinalize((event) => {
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      scale.value = withSpring(1);
      zIndex.value = 0;
      const toIndex = Math.min(
        Math.max(index + Math.round(event.translationX / SLOT_WIDTH), 0),
        total - 1
      );
      runOnJS(commitReorder)(index, toIndex);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    zIndex: zIndex.value,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.tile, animatedStyle]}>
        <CachedImage
          uri={photo.uri}
          style={styles.preview}
          contentFit="cover"
          recyclingKey={`reorder-${photo.key}`}
        />

        <Pressable
          style={styles.previewClose}
          onPress={() => onRemove(index)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Remove photo"
        >
          <Text style={styles.previewCloseText}>✕</Text>
        </Pressable>

        <View style={styles.dragHandle} pointerEvents="none">
          <Text style={styles.dragHandleText}>≡</Text>
        </View>

        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>
            {index === 0 ? "Cover" : `Photo ${index + 1}`}
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export function ReorderablePhotoStrip({
  photos,
  onReorder,
  onRemove,
  disabled,
}: ReorderablePhotoStripProps) {
  const photoRows = useMemo(
    () => photos.map((photo, index) => ({ ...photo, index })),
    [photos]
  );

  if (!photos.length) return null;

  return (
    <View style={styles.strip}>
      <View style={styles.row}>
        {photoRows.map(({ key, uri, index }) => (
          <DraggablePhotoTile
            key={key}
            photo={{ uri, key }}
            index={index}
            total={photos.length}
            disabled={disabled}
            onRemove={onRemove}
            onReorder={onReorder}
          />
        ))}
      </View>
      {photos.length > 1 ? (
        <Text style={styles.hint}>
          {Platform.OS === "web"
            ? "Press and drag photos to reorder. The first photo is the cover."
            : "Press and hold, then drag to reorder. The first photo is the cover."}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { gap: spacing.xs },
  row: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: TILE_GAP,
    paddingVertical: spacing.xs,
  },
  tile: {
    position: "relative",
    width: TILE_WIDTH,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  preview: {
    width: "100%",
    height: 220,
  },
  previewClose: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(10, 10, 11, 0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewCloseText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  dragHandle: {
    position: "absolute",
    top: spacing.xs,
    left: spacing.xs,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(10, 10, 11, 0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  dragHandleText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 18,
  },
  typeBadge: {
    position: "absolute",
    bottom: spacing.xs,
    left: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: "rgba(10, 10, 11, 0.75)",
  },
  typeBadgeText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "700",
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
