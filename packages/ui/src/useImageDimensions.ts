import { useEffect, useState } from "react";
import { Image, Platform } from "react-native";

export type ImageDimensions = {
  width: number;
  height: number;
};

const dimensionCache = new Map<string, ImageDimensions>();

export function peekImageDimensions(uri: string | undefined): ImageDimensions | null {
  if (!uri) return null;
  return dimensionCache.get(uri) ?? null;
}

export function computeImageDisplayHeight(
  containerWidth: number,
  imageWidth: number,
  imageHeight: number,
  maxHeight?: number,
  maxPortraitRatio?: number
): number {
  if (!containerWidth || !imageWidth || !imageHeight) return 0;
  const aspectRatio = imageHeight / imageWidth;
  const cappedRatio =
    maxPortraitRatio != null && aspectRatio > maxPortraitRatio
      ? maxPortraitRatio
      : aspectRatio;
  const naturalHeight = containerWidth * cappedRatio;
  if (maxHeight && naturalHeight > maxHeight) return maxHeight;
  return naturalHeight;
}

export function useImageDimensions(uri: string | undefined) {
  const [dimensions, setDimensions] = useState<ImageDimensions | null>(() =>
    peekImageDimensions(uri)
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!uri) {
      setDimensions(null);
      setFailed(false);
      return;
    }

    const cached = dimensionCache.get(uri);
    if (cached) {
      setDimensions(cached);
      setFailed(false);
      return;
    }

    let cancelled = false;
    setDimensions(null);
    setFailed(false);

    if (Platform.OS === "web") {
      const img = new window.Image();
      img.onload = () => {
        if (!cancelled && img.naturalWidth > 0 && img.naturalHeight > 0) {
          const next = { width: img.naturalWidth, height: img.naturalHeight };
          dimensionCache.set(uri, next);
          setDimensions(next);
        }
      };
      img.onerror = () => {
        if (!cancelled) setFailed(true);
      };
      img.src = uri;
      return () => {
        cancelled = true;
      };
    }

    Image.getSize(
      uri,
      (width, height) => {
        if (!cancelled) {
          const next = { width, height };
          dimensionCache.set(uri, next);
          setDimensions(next);
        }
      },
      () => {
        if (!cancelled) setFailed(true);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [uri]);

  return { dimensions, failed };
}
