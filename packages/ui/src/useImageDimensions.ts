import { useEffect, useState } from "react";
import { Image, Platform } from "react-native";

export type ImageDimensions = {
  width: number;
  height: number;
};

const dimensionCache = new Map<string, ImageDimensions>();
const dimensionListeners = new Map<string, Set<(dimensions: ImageDimensions) => void>>();

export function peekImageDimensions(uri: string | undefined): ImageDimensions | null {
  if (!uri) return null;
  return dimensionCache.get(uri) ?? null;
}

/** Record dimensions from the image that is already on screen. Does not start a request. */
export function rememberImageDimensions(uri: string, width: number, height: number): void {
  if (!uri || width <= 0 || height <= 0) return;
  const existing = dimensionCache.get(uri);
  if (existing?.width === width && existing?.height === height) return;
  const next = { width, height };
  dimensionCache.set(uri, next);
  const listeners = dimensionListeners.get(uri);
  if (!listeners) return;
  for (const listener of listeners) listener(next);
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

export function useImageDimensions(
  uri: string | undefined,
  options?: { passive?: boolean }
) {
  const passive = options?.passive === true;
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
      if (passive) return;
    }

    if (passive) {
      if (!cached) {
        setDimensions(null);
        setFailed(false);
      }
      const listener = (next: ImageDimensions) => {
        setDimensions(next);
        setFailed(false);
      };
      let listeners = dimensionListeners.get(uri);
      if (!listeners) {
        listeners = new Set();
        dimensionListeners.set(uri, listeners);
      }
      listeners.add(listener);
      return () => {
        listeners?.delete(listener);
      };
    }

    if (cached) return;

    let cancelled = false;
    setDimensions(null);
    setFailed(false);

    if (Platform.OS === "web") {
      const img = new window.Image();
      img.onload = () => {
        if (!cancelled && img.naturalWidth > 0 && img.naturalHeight > 0) {
          rememberImageDimensions(uri, img.naturalWidth, img.naturalHeight);
          setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
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
          rememberImageDimensions(uri, width, height);
          setDimensions({ width, height });
        }
      },
      () => {
        if (!cancelled) setFailed(true);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [passive, uri]);

  return { dimensions, failed };
}
