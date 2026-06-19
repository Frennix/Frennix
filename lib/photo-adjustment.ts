import * as ImageManipulator from "expo-image-manipulator";
import { Image, Platform } from "react-native";

/** Feed card media uses full width × 360px — match this aspect in the crop frame. */
export const FEED_MEDIA_HEIGHT = 360;

export type ImageDimensions = {
  width: number;
  height: number;
};

export type CropTransform = {
  scale: number;
  translateX: number;
  translateY: number;
};

/** Keep pan offsets inside the crop frame so the image always covers it. */
export function clampCropTransform(
  transform: CropTransform,
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number
): CropTransform {
  const coverScale = Math.max(frameWidth / imageWidth, frameHeight / imageHeight);
  const totalScale = coverScale * transform.scale;
  const displayWidth = imageWidth * totalScale;
  const displayHeight = imageHeight * totalScale;
  const maxX = Math.max(0, (displayWidth - frameWidth) / 2);
  const maxY = Math.max(0, (displayHeight - frameHeight) / 2);

  return {
    scale: transform.scale,
    translateX: Math.min(maxX, Math.max(-maxX, transform.translateX)),
    translateY: Math.min(maxY, Math.max(-maxY, transform.translateY)),
  };
}

export function clampTranslation(
  translateX: number,
  translateY: number,
  scale: number,
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number
) {
  const clamped = clampCropTransform(
    { scale, translateX, translateY },
    imageWidth,
    imageHeight,
    frameWidth,
    frameHeight
  );
  return { x: clamped.translateX, y: clamped.translateY };
}

/** Focal-point pinch zoom used by native RNGH and web touch handlers. */
export function computePinchTransform(
  pinchStartScale: number,
  pinchStartTranslateX: number,
  pinchStartTranslateY: number,
  pinchScaleMultiplier: number,
  focalX: number,
  focalY: number,
  frameWidth: number,
  frameHeight: number,
  imageWidth: number,
  imageHeight: number,
  minScale: number,
  maxScale: number
): CropTransform {
  const nextScale = Math.min(maxScale, Math.max(minScale, pinchStartScale * pinchScaleMultiplier));
  const scaleRatio = nextScale / pinchStartScale;
  const focalOffsetX = focalX - frameWidth / 2;
  const focalOffsetY = focalY - frameHeight / 2;
  const nextX = focalOffsetX - scaleRatio * (focalOffsetX - pinchStartTranslateX);
  const nextY = focalOffsetY - scaleRatio * (focalOffsetY - pinchStartTranslateY);

  return clampCropTransform(
    { scale: nextScale, translateX: nextX, translateY: nextY },
    imageWidth,
    imageHeight,
    frameWidth,
    frameHeight
  );
}

export type CropRegion = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

export function feedFrameSize(containerWidth: number, screenWidth: number) {
  const frameWidth = containerWidth;
  const frameHeight = frameWidth * (FEED_MEDIA_HEIGHT / screenWidth);
  return { frameWidth, frameHeight };
}

/** Square crop frame for profile avatars (displayed as a circle in the app). */
export function avatarFrameSize(containerWidth: number) {
  const size = Math.min(containerWidth, 320);
  return { frameWidth: size, frameHeight: size };
}

export function getImageDimensions(uri: string): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error)
    );
  });
}

/** Maps the visible crop frame to source-image pixel coordinates (cover + pan/zoom). */
export function computeCropRegion(
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
  transform: CropTransform
): CropRegion {
  const coverScale = Math.max(frameWidth / imageWidth, frameHeight / imageHeight);
  const totalScale = coverScale * transform.scale;

  const displayWidth = imageWidth * totalScale;
  const displayHeight = imageHeight * totalScale;

  const imageLeft = frameWidth / 2 - displayWidth / 2 + transform.translateX;
  const imageTop = frameHeight / 2 - displayHeight / 2 + transform.translateY;

  let originX = (0 - imageLeft) / totalScale;
  let originY = (0 - imageTop) / totalScale;
  let cropWidth = frameWidth / totalScale;
  let cropHeight = frameHeight / totalScale;

  originX = Math.max(0, Math.min(originX, imageWidth - 1));
  originY = Math.max(0, Math.min(originY, imageHeight - 1));
  cropWidth = Math.min(cropWidth, imageWidth - originX);
  cropHeight = Math.min(cropHeight, imageHeight - originY);

  return {
    originX: Math.round(originX),
    originY: Math.round(originY),
    width: Math.max(1, Math.round(cropWidth)),
    height: Math.max(1, Math.round(cropHeight)),
  };
}

export type AdjustedPhotoExport = {
  uri: string;
  mimeType: string;
  file?: File;
  width: number;
  height: number;
};

export async function exportAdjustedPhoto(
  uri: string,
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
  transform: CropTransform,
  options?: { maxEdge?: number }
): Promise<AdjustedPhotoExport> {
  const crop = computeCropRegion(imageWidth, imageHeight, frameWidth, frameHeight, transform);

  const maxEdge = options?.maxEdge ?? 1440;
  const cropAspect = crop.width / crop.height;
  const resize =
    crop.width >= crop.height
      ? { width: Math.min(maxEdge, crop.width) }
      : { height: Math.min(maxEdge, crop.height) };

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop }, { resize }],
    { compress: 0.88, format: ImageManipulator.SaveFormat.JPEG }
  );

  const mimeType = "image/jpeg";
  let file: File | undefined;

  if (Platform.OS === "web") {
    const response = await fetch(result.uri);
    const blob = await response.blob();
    const prefix = options?.maxEdge && options.maxEdge <= 512 ? "avatar" : "post-photo";
    file = new File([blob], `${prefix}-${Date.now()}.jpg`, { type: mimeType });
  }

  const dimensions = await getImageDimensions(result.uri);

  return {
    uri: result.uri,
    mimeType,
    file,
    width: dimensions.width,
    height: dimensions.height,
  };
}

export async function rotatePhoto(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ rotate: 90 }],
    { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}
