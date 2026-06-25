import { useCallback, useState } from "react";
import { ImageLightbox } from "@/components/ImageLightbox";

export function useImageLightbox() {
  const [uri, setUri] = useState<string | null>(null);

  const openImage = useCallback((nextUri: string) => {
    setUri(nextUri);
  }, []);

  const closeImage = useCallback(() => {
    setUri(null);
  }, []);

  const lightbox = <ImageLightbox uri={uri} onClose={closeImage} />;

  return { openImage, closeImage, lightbox };
}
