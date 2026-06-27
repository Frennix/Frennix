import { useEffect, useState } from "react";
import { StyleSheet, View, type ImageStyle, type StyleProp } from "react-native";
import { CachedImage } from "./CachedImage";
import { Skeleton } from "./Skeleton";
import { colors } from "./theme";

type ProgressiveImageProps = {
  uri: string;
  /** Low-res thumbnail shown while the full image loads. */
  placeholderUri?: string | null;
  style?: StyleProp<ImageStyle>;
  contentFit?: "cover" | "contain";
  accessibilityLabel?: string;
  onLoad?: () => void;
  onError?: () => void;
  recyclingKey?: string;
};

/** Crossfades from a blurred thumbnail to full resolution — avoids white flash on decode. */
export function ProgressiveImage({
  uri,
  placeholderUri,
  style,
  contentFit = "cover",
  accessibilityLabel,
  onLoad,
  onError,
  recyclingKey,
}: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [uri]);

  if (failed) {
    return <View style={[styles.fallback, style]} accessibilityLabel={accessibilityLabel} />;
  }

  return (
    <View style={[styles.wrap, style]}>
      {!loaded ? <Skeleton width="100%" height="100%" style={StyleSheet.absoluteFill} /> : null}
      <CachedImage
        uri={uri}
        placeholderUri={placeholderUri}
        contentFit={contentFit}
        recyclingKey={recyclingKey}
        accessibilityLabel={accessibilityLabel}
        style={StyleSheet.absoluteFill}
        onLoad={() => {
          setLoaded(true);
          onLoad?.();
        }}
        onLoadEnd={() => {
          setLoaded(true);
        }}
        onError={() => {
          setFailed(true);
          onError?.();
        }}
      />
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
