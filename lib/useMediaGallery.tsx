import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";
import { flushSync } from "react-dom";
import type { PostMediaItem, PostType } from "@frennix/types";
import { buildMediaGalleryState, normalizePostMediaItems } from "@frennix/types";
import type { FeedVideoFullscreenHandoff } from "@frennix/ui";
import { ImageLightbox, type ImageGalleryState, type MediaGalleryState } from "@/components/ImageLightbox";
import type { ImmersiveVideoGalleryContext } from "@/lib/immersive-video-gallery";
import type { ImmersiveVideoPlaylistState } from "@/lib/immersive-video-playlist-state";

export type GalleryCloseContext = {
  postId?: string;
  mediaIndex?: number;
};

export type GalleryCloseHandler = (index: number, context?: GalleryCloseContext) => void;

export type OpenGalleryOptions = {
  postType?: PostType;
  thumbnailUrl?: string | null;
  /** @deprecated Prefer passing PostMediaItem[] directly. */
  placeholderUris?: Array<string | null>;
  /** Feed inline video timestamp when opening fullscreen from the home feed. */
  videoHandoff?: FeedVideoFullscreenHandoff;
  /** Mobile web immersive video — post actions and resume handoff. */
  immersiveVideo?: ImmersiveVideoGalleryContext;
  /** Vertical swipe playlist for feed immersive videos. */
  immersiveVideoPlaylist?: ImmersiveVideoPlaylistState;
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
      const nextGallery = {
        ...buildMediaGalleryState(mediaUrls, {
          postType: options?.postType,
          thumbnailUrl: options?.thumbnailUrl,
          index,
        }),
        videoHandoff: options?.videoHandoff,
        immersiveVideo: options?.immersiveVideo,
        immersiveVideoPlaylist: options?.immersiveVideoPlaylist,
      };
      if (Platform.OS === "web" && options?.videoHandoff) {
        flushSync(() => setGallery(nextGallery));
        return;
      }
      setGallery(nextGallery);
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

  const handleClose = useCallback((finalIndex: number, context?: GalleryCloseContext) => {
    closeHandlerRef.current?.(finalIndex, context);
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
    closeGallery: media.closeGallery,
    lightbox: media.lightbox,
    lightboxVisible: Boolean(media.gallery),
  };
}

export { isMediaGalleryState };
