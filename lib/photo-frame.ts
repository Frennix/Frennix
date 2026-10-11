/** Tall photos stay full-width until they would exceed twice the screen width. */
export const PHOTO_MAX_HEIGHT_RATIO = 2;

/**
 * Default feed frame matches the photo's aspect ratio, scaled to the available width.
 * A height limit shrinks the frame so the whole image still fits. Zoom can crop from there.
 */
export function feedFrameSize(
  containerWidth: number,
  viewportHeight: number,
  image?: { width: number; height: number }
) {
  const maxHeight = Math.max(240, Math.min(viewportHeight * 0.62, containerWidth * PHOTO_MAX_HEIGHT_RATIO));
  if (!image?.width || !image?.height) {
    return { frameWidth: containerWidth, frameHeight: Math.min(containerWidth, maxHeight) };
  }
  const naturalHeight = containerWidth * (image.height / image.width);
  if (naturalHeight <= maxHeight) {
    return { frameWidth: containerWidth, frameHeight: naturalHeight };
  }
  return { frameWidth: maxHeight / (image.height / image.width), frameHeight: maxHeight };
}
