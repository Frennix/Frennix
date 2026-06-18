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
  transform: CropTransform
): Promise<AdjustedPhotoExport> {
  const crop = computeCropRegion(imageWidth, imageHeight, frameWidth, frameHeight, transform);

  const maxEdge = 1440;
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
    file = new File([blob], `post-photo-${Date.now()}.jpg`, { type: mimeType });
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
