import { useLayoutEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { CachedImage } from "./CachedImage";
import { MediaLoadError } from "./MediaLoadError";
import { Skeleton } from "./Skeleton";
import { WebNativeImage } from "./WebNativeImage";
import { isDecodedDomImage } from "./progressiveImageReveal";
import { colors } from "./theme";

type ProgressiveImageProps = {
  uri: string;
  placeholderUri?: string | null;
  style?: StyleProp<ViewStyle>;
  contentFit?: "cover" | "contain";
  accessibilityLabel?: string;
  onLoad?: () => void;
  onError?: () => void;
  recyclingKey?: string;
  fadeDuration?: number;
  /** When false, skip skeleton placeholder (use initials/background until image loads). */
  showPlaceholder?: boolean;
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
  showPlaceholder = true,
}: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [useNativeWebFallback, setUseNativeWebFallback] = useState(Platform.OS === "web");
  const [retryKey, setRetryKey] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;
  const revealedRef = useRef(false);
  const webImgRef = useRef<HTMLImageElement | null>(null);

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

  useLayoutEffect(() => {
    setLoaded(false);
    setFailed(false);
    setUseNativeWebFallback(Platform.OS === "web");
    revealedRef.current = false;
    opacity.setValue(0);

    if (Platform.OS === "web" && useNativeWebFallback && isDecodedDomImage(webImgRef.current)) {
      reveal();
    }
  }, [uri, retryKey, opacity, useNativeWebFallback]);

  const handleRetry = () => {
    setFailed(false);
    setUseNativeWebFallback(Platform.OS === "web");
    revealedRef.current = false;
    opacity.setValue(0);
    setLoaded(false);
    setRetryKey((key) => key + 1);
  };

  const handleExpoImageError = () => {
    if (Platform.OS === "web" && !useNativeWebFallback) {
      setUseNativeWebFallback(true);
      revealedRef.current = false;
      opacity.setValue(0);
      setLoaded(false);
      return;
    }
    setFailed(true);
    onError?.();
  };

  if (failed) {
    return (
      <MediaLoadError label="Photo unavailable" onRetry={handleRetry} style={style} />
    );
  }

  if (Platform.OS === "web" && useNativeWebFallback) {
    return (
      <View style={[styles.wrap, style]} accessibilityLabel={accessibilityLabel}>
        {!loaded && showPlaceholder && !placeholderUri ? (
          <Skeleton style={StyleSheet.absoluteFillObject} />
        ) : null}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
          <WebNativeImage
            key={retryKey}
            ref={webImgRef}
            uri={uri}
            contentFit={contentFit}
            style={StyleSheet.absoluteFill}
            accessibilityLabel={accessibilityLabel}
            onLoad={reveal}
            onError={handleExpoImageError}
          />
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]} accessibilityLabel={accessibilityLabel}>
      {placeholderUri ? (
        <CachedImage
          uri={placeholderUri}
          style={StyleSheet.absoluteFillObject}
          contentFit={contentFit}
          recyclingKey={recyclingKey ? `${recyclingKey}-thumb` : undefined}
        />
      ) : null}
      {!loaded && showPlaceholder && !placeholderUri ? (
        <Skeleton style={StyleSheet.absoluteFillObject} />
      ) : null}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
        <CachedImage
          key={retryKey}
          uri={uri}
          placeholderUri={placeholderUri}
          contentFit={contentFit}
          recyclingKey={recyclingKey}
          accessibilityLabel={accessibilityLabel}
          style={StyleSheet.absoluteFill}
          onLoad={reveal}
          onLoadEnd={reveal}
          onError={handleExpoImageError}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    backgroundColor: colors.background,
    width: "100%",
    height: "100%",
  },
});
