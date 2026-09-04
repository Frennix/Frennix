/** True when a DOM img finished decoding before React registered onLoad. */
export function isDecodedDomImage(
  img: { complete: boolean; naturalWidth: number } | null | undefined
): boolean {
  return Boolean(img?.complete && img.naturalWidth > 0);
}
