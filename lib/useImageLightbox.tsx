import { useCallback, useRef, useState } from "react";
import { ImageLightbox, type ImageGalleryState } from "@/components/ImageLightbox";

export type GalleryCloseHandler = (index: number) => void;

export type OpenGalleryOptions = {
  placeholderUris?: Array<string | null>;
};

export function useImageLightbox() {
  const [gallery, setGallery] = useState<ImageGalleryState | null>(null);
  const closeHandlerRef = useRef<GalleryCloseHandler | null>(null);

  const openImage = useCallback((uri: string, placeholderUri?: string | null) => {
    closeHandlerRef.current = null;
    setGallery({
      images: [uri],
      index: 0,
      placeholderUris: placeholderUri ? [placeholderUri] : undefined,
    });
  }, []);

  const openGallery = useCallback(
    (
      images: string[],
      index = 0,
      onClosed?: GalleryCloseHandler,
      options?: OpenGalleryOptions
    ) => {
      const filtered = images.filter(Boolean);
      if (!filtered.length) return;
      const clampedIndex = Math.min(Math.max(index, 0), filtered.length - 1);
      closeHandlerRef.current = onClosed ?? null;
      setGallery({
        images: filtered,
        index: clampedIndex,
        placeholderUris: options?.placeholderUris,
      });
    },
    []
  );

  const handleClose = useCallback((finalIndex: number) => {
    closeHandlerRef.current?.(finalIndex);
    closeHandlerRef.current = null;
    setGallery(null);
  }, []);

  const lightbox = <ImageLightbox gallery={gallery} onClose={handleClose} />;

  return { openImage, openGallery, closeImage: handleClose, lightbox };
}
