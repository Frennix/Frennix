import { useEffect, useState } from "react";
import { Image, Platform } from "react-native";

export type ImageDimensions = {
  width: number;
  height: number;
};

export function computeImageDisplayHeight(
  containerWidth: number,
  imageWidth: number,
  imageHeight: number,
  maxHeight?: number
): number {
  if (!containerWidth || !imageWidth || !imageHeight) return 0;
  const naturalHeight = containerWidth * (imageHeight / imageWidth);
  if (maxHeight && naturalHeight > maxHeight) return maxHeight;
  return naturalHeight;
}

export function useImageDimensions(uri: string | undefined) {
  const [dimensions, setDimensions] = useState<ImageDimensions | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!uri) {
      setDimensions(null);
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
        if (!cancelled) setDimensions({ width, height });
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
