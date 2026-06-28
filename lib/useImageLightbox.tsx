import { useCallback, useRef, useState } from "react";
import { ImageLightbox, type ImageGalleryState } from "@/components/ImageLightbox";

export type GalleryCloseHandler = (index: number) => void;

export function useImageLightbox() {
  const [gallery, setGallery] = useState<ImageGalleryState | null>(null);
  const closeHandlerRef = useRef<GalleryCloseHandler | null>(null);

  const openImage = useCallback((uri: string) => {
    closeHandlerRef.current = null;
    setGallery({ images: [uri], index: 0 });
  }, []);

  const openGallery = useCallback(
    (images: string[], index = 0, onClosed?: GalleryCloseHandler) => {
      const filtered = images.filter(Boolean);
      if (!filtered.length) return;
      const clampedIndex = Math.min(Math.max(index, 0), filtered.length - 1);
      closeHandlerRef.current = onClosed ?? null;
      setGallery({ images: filtered, index: clampedIndex });
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
