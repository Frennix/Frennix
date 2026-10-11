import { Image, type ImageProps } from "expo-image";
import { type StyleProp, type ImageStyle } from "react-native";
import { filterImagePrefetchUris, isImageMediaUri } from "@frennix/types";
import { rememberImageDimensions } from "./useImageDimensions";

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
  onLoadEnd?: () => void;
  onError?: () => void;
};

export { isImageMediaUri, filterImagePrefetchUris };

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
  onLoadEnd,
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
      onLoad={(event) => {
        const source = event.source;
        if (source?.width > 0 && source?.height > 0) {
          rememberImageDimensions(uri, source.width, source.height);
        }
        onLoad?.();
      }}
      onLoadEnd={onLoadEnd}
      onError={onError}
    />
  );
}

/** Bundled asset (require) with disk cache on native. */
export function CachedAssetImage({
  source,
  style,
  contentFit = "contain",
  contentPosition,
  accessibilityLabel,
}: {
  source: ImageProps["source"];
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageProps["contentFit"];
  contentPosition?: ImageProps["contentPosition"];
  accessibilityLabel?: string;
}) {
  return (
    <Image
      source={source}
      contentFit={contentFit}
      contentPosition={contentPosition}
      cachePolicy="memory-disk"
      style={style}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

export function prefetchCachedImage(uri: string) {
  if (!isImageMediaUri(uri)) return Promise.resolve(false);
  return Image.prefetch(uri, "memory-disk");
}

export function prefetchCachedImages(uris: string[]) {
  const imageUris = filterImagePrefetchUris(uris);
  if (!imageUris.length) return Promise.resolve(false);
  return Image.prefetch(imageUris, "memory-disk");
}
