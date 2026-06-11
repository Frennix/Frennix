import { useEffect } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { colors, spacing, typography } from "@frennix/ui";

interface ImageLightboxProps {
  uri: string | null;
  onClose: () => void;
}

export function ImageLightbox({ uri, onClose }: ImageLightboxProps) {
  const { width, height } = useWindowDimensions();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  useEffect(() => {
    if (uri) {
      scale.value = 1;
      savedScale.value = 1;
    }
  }, [uri, scale, savedScale]);

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = savedScale.value * event.scale;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        return;
      }
      if (scale.value > 4) {
        scale.value = withTiming(4);
        savedScale.value = 4;
        return;
      }
      savedScale.value = scale.value;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

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
        <Pressable style={styles.dismissArea} onPress={onClose} accessibilityLabel="Close image preview" />

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
              <Animated.Image
                source={{ uri }}
                style={[styles.image, { maxWidth: imageMaxWidth, maxHeight: imageMaxHeight }]}
                resizeMode="contain"
              />
            ) : (
              <GestureDetector gesture={pinch}>
                <Animated.Image
                  source={{ uri }}
                  style={[
                    styles.image,
                    { maxWidth: imageMaxWidth, maxHeight: imageMaxHeight },
                    animatedStyle,
                  ]}
                  resizeMode="contain"
                />
              </GestureDetector>
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
  },
  closeButton: {
    position: "absolute",
    top: Platform.OS === "web" ? spacing.lg : spacing.xxl,
    right: spacing.lg,
    zIndex: 2,
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
  image: {
    zIndex: 1,
    alignSelf: "center",
  },
});
