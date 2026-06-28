import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { CachedImage } from "./CachedImage";
import { Skeleton } from "./Skeleton";
import { colors } from "./theme";

type ProgressiveImageProps = {
  uri: string;
  /** Low-res thumbnail shown while the full image loads. */
  placeholderUri?: string | null;
  style?: StyleProp<ViewStyle>;
  contentFit?: "cover" | "contain";
  accessibilityLabel?: string;
  onLoad?: () => void;
  onError?: () => void;
  recyclingKey?: string;
  /** Fade-in duration after decode (ms). */
  fadeDuration?: number;
};

const DEFAULT_FADE_MS = 280;

/** Skeleton placeholder → cached image crossfade — avoids blank flashes on slow connections. */
export function ProgressiveImage({
  uri,
  placeholderUri,
  style,
  contentFit = "cover",
  accessibilityLabel,
  onLoad,
  onError,
  recyclingKey,
  fadeDuration = DEFAULT_FADE_MS,
}: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const revealedRef = useRef(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    revealedRef.current = false;
    opacity.setValue(0);
  }, [uri, opacity]);

  const reveal = () => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    setLoaded(true);
    onLoad?.();
    Animated.timing(opacity, {
      toValue: 1,
      duration: fadeDuration,
      useNativeDriver: true,
    }).start();
  };

  if (failed) {
    return <View style={[styles.fallback, style]} accessibilityLabel={accessibilityLabel} />;
  }

  return (
    <View style={[styles.wrap, style]}>
      {!loaded ? <Skeleton style={StyleSheet.absoluteFillObject} /> : null}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
        <CachedImage
          uri={uri}
          placeholderUri={placeholderUri}
          contentFit={contentFit}
          recyclingKey={recyclingKey}
          accessibilityLabel={accessibilityLabel}
          style={StyleSheet.absoluteFill}
          onLoad={reveal}
          onLoadEnd={reveal}
          onError={() => {
            setFailed(true);
            onError?.();
          }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    backgroundColor: colors.surfaceElevated,
  },
  fallback: {
    backgroundColor: colors.surfaceElevated,
  },
});
