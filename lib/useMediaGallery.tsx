import { useCallback, useRef, useState } from "react";
import type { PostMediaItem, PostType } from "@frennix/types";
import { buildMediaGalleryState, normalizePostMediaItems } from "@frennix/types";
import { ImageLightbox, type ImageGalleryState, type MediaGalleryState } from "@/components/ImageLightbox";

export type GalleryCloseHandler = (index: number) => void;

export type OpenGalleryOptions = {
  postType?: PostType;
  thumbnailUrl?: string | null;
  /** @deprecated Prefer passing PostMediaItem[] directly. */
  placeholderUris?: Array<string | null>;
};

function isMediaGalleryState(
  state: ImageGalleryState | MediaGalleryState
): state is MediaGalleryState {
  return "items" in state;
}

export function useMediaGallery() {
  const [gallery, setGallery] = useState<ImageGalleryState | MediaGalleryState | null>(null);
  const closeHandlerRef = useRef<GalleryCloseHandler | null>(null);

  const openMediaGallery = useCallback(
    (items: PostMediaItem[], index = 0, onClosed?: GalleryCloseHandler) => {
      const filtered = items.filter((item) => Boolean(item.url));
      if (!filtered.length) return;
      const clampedIndex = Math.min(Math.max(index, 0), filtered.length - 1);
      closeHandlerRef.current = onClosed ?? null;
      setGallery({ items: filtered, index: clampedIndex });
    },
    []
  );

  const openGallery = useCallback(
    (
      mediaUrls: string[],
      index = 0,
      onClosed?: GalleryCloseHandler,
      options?: OpenGalleryOptions
    ) => {
      closeHandlerRef.current = onClosed ?? null;
      setGallery(
        buildMediaGalleryState(mediaUrls, {
          postType: options?.postType,
          thumbnailUrl: options?.thumbnailUrl,
          index,
        })
      );
    },
    []
  );

  const openImage = useCallback(
    (uri: string, placeholderUri?: string | null) => {
      closeHandlerRef.current = null;
      openMediaGallery(
        normalizePostMediaItems([uri], { thumbnailUrl: placeholderUri ?? null }),
        0
      );
    },
    [openMediaGallery]
  );

  const handleClose = useCallback((finalIndex: number) => {
    closeHandlerRef.current?.(finalIndex);
    closeHandlerRef.current = null;
    setGallery(null);
  }, []);

  const lightbox = <ImageLightbox gallery={gallery} onClose={handleClose} />;

  return {
    openImage,
    openGallery,
    openMediaGallery,
    closeGallery: handleClose,
    lightbox,
    gallery,
  };
}

/** @deprecated Use useMediaGallery — kept for existing imports. */
export function useImageLightbox() {
  const media = useMediaGallery();
  return {
    openImage: media.openImage,
    openGallery: media.openGallery,
    closeImage: media.closeGallery,
    lightbox: media.lightbox,
  };
}

export { isMediaGalleryState };
