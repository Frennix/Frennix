import { Image, type ImageProps } from "expo-image";
import { type StyleProp, type ImageStyle } from "react-native";

export type CachedImageProps = {
  uri: string;
  placeholderUri?: string | null;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageProps["contentFit"];
  transition?: number;
  cachePolicy?: ImageProps["cachePolicy"];
  recyclingKey?: string;
  accessibilityLabel?: string;
  onLoad?: () => void;
  onError?: () => void;
};

/** Remote image with memory+disk cache and optional thumbnail crossfade. */
export function CachedImage({
  uri,
  placeholderUri,
  style,
  contentFit = "cover",
  transition = 250,
  cachePolicy = "memory-disk",
  recyclingKey,
  accessibilityLabel,
  onLoad,
  onError,
}: CachedImageProps) {
  return (
    <Image
      source={{ uri }}
      placeholder={placeholderUri ? { uri: placeholderUri } : undefined}
      placeholderContentFit="cover"
      contentFit={contentFit}
      transition={transition}
      cachePolicy={cachePolicy}
      recyclingKey={recyclingKey ?? uri}
      style={style}
      accessibilityLabel={accessibilityLabel}
      onLoad={onLoad}
      onError={onError}
    />
  );
}

/** Bundled asset (require) with disk cache on native. */
export function CachedAssetImage({
  source,
  style,
  contentFit = "contain",
  accessibilityLabel,
}: {
  source: ImageProps["source"];
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageProps["contentFit"];
  accessibilityLabel?: string;
}) {
  return (
    <Image
      source={source}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      style={style}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

export function prefetchCachedImage(uri: string) {
  return Image.prefetch(uri, "memory-disk");
}

export function prefetchCachedImages(uris: string[]) {
  return Image.prefetch(uris, "memory-disk");
}
