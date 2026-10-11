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
import { feedDisplayImageUri, feedImageRequestAttrs, type FeedMediaLoadPriority } from "./feedMediaDelivery";
import { MediaLoadError } from "./MediaLoadError";
import { Skeleton } from "./Skeleton";
import { WebNativeImage } from "./WebNativeImage";
import { shouldRevealCachedDomImage } from "./progressiveImageReveal";
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
  /** Feed display requests a resized WebP and falls back to the original URL on error. */
  delivery?: "original" | "feed";
  /** Visible rows should outrank offscreen lookahead. */
  loadPriority?: FeedMediaLoadPriority;
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
  delivery = "original",
  loadPriority,
}: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [useOriginal, setUseOriginal] = useState(false);
  const [useNativeWebFallback, setUseNativeWebFallback] = useState(Platform.OS === "web");
  const [retryKey, setRetryKey] = useState(0);
  const seenUri = useRef(uri);
  if (seenUri.current !== uri) {
    seenUri.current = uri;
    if (useOriginal) setUseOriginal(false);
  }
  const optimizedUri = delivery === "feed" ? feedDisplayImageUri(uri) : uri;
  const requestUri = useOriginal ? uri : optimizedUri;
  const placeholderRequest =
    placeholderUri && delivery === "feed" ? feedDisplayImageUri(placeholderUri) : placeholderUri;
  const showThumb = Boolean(placeholderRequest && placeholderRequest !== requestUri);
  const requestAttrs = feedImageRequestAttrs(loadPriority);
  const imagePriority = loadPriority === "low" ? "low" : loadPriority === "high" ? "high" : undefined;
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
    setFailed(false);
    setUseNativeWebFallback(Platform.OS === "web");

    if (Platform.OS === "web" && shouldRevealCachedDomImage(webImgRef.current)) {
      reveal();
      return;
    }

    revealedRef.current = false;
    opacity.setValue(0);
    setLoaded(false);
  }, [requestUri, retryKey, opacity]);

  const handleRetry = () => {
    setFailed(false);
    setUseOriginal(false);
    setUseNativeWebFallback(Platform.OS === "web");
    revealedRef.current = false;
    opacity.setValue(0);
    setLoaded(false);
    setRetryKey((key) => key + 1);
  };

  const handleExpoImageError = () => {
    if (delivery === "feed" && !useOriginal && optimizedUri !== uri) {
      setUseOriginal(true);
      return;
    }
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
      <View
        style={[styles.wrap, style]}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ busy: !loaded }}
      >
        {showPlaceholder ? <Skeleton width="100%" height="100%" style={StyleSheet.absoluteFillObject} /> : null}
        {showThumb ? (
          <WebNativeImage
            uri={placeholderRequest!}
            contentFit={contentFit}
            accessibilityLabel={accessibilityLabel}
            fetchPriority="high"
            loading="eager"
          />
        ) : null}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
          <WebNativeImage
            key={`${requestUri}-${retryKey}`}
            ref={webImgRef}
            uri={requestUri}
            contentFit={contentFit}
            accessibilityLabel={accessibilityLabel}
            fetchPriority={requestAttrs.fetchPriority}
            loading={requestAttrs.loading}
            onLoad={reveal}
            onError={handleExpoImageError}
          />
        </Animated.View>
      </View>
    );
  }

  return (
    <View
      style={[styles.wrap, style]}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: !loaded }}
    >
      {showPlaceholder ? <Skeleton width="100%" height="100%" style={StyleSheet.absoluteFillObject} /> : null}
      {showThumb ? (
        <CachedImage
          uri={placeholderRequest!}
          style={StyleSheet.absoluteFillObject}
          contentFit={contentFit}
          priority="high"
          recyclingKey={recyclingKey ? `${recyclingKey}-thumb` : undefined}
        />
      ) : null}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
        <CachedImage
          key={`${requestUri}-${retryKey}`}
          uri={requestUri}
          placeholderUri={showThumb ? placeholderRequest : undefined}
          contentFit={contentFit}
          priority={imagePriority}
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
    position: "relative",
    overflow: "hidden",
    backgroundColor: colors.background,
    width: "100%",
    height: "100%",
  },
});
