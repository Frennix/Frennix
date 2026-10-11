/** True when a DOM img finished decoding before React registered onLoad. */
export function isDecodedDomImage(
  img: { complete: boolean; naturalWidth: number } | null | undefined
): boolean {
  return Boolean(img?.complete && img.naturalWidth > 0);
}

/**
 * After a uri reset, reveal immediately when the img is already decoded.
 * Otherwise keep opacity at 0 until onLoad — do not wipe a later load.
 */
export function shouldRevealCachedDomImage(img: {
  complete: boolean;
  naturalWidth: number;
} | null | undefined): boolean {
  return isDecodedDomImage(img);
}
