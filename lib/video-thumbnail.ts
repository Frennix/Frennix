import { Platform } from "react-native";
import {
  captureVideoPosterWeb,
  dataUrlToBytes,
  isVideoMime,
  readImageBytes,
  THUMBNAIL_CAPTURE_TIMEOUT_MS,
  uploadPostThumbnail,
  withTimeout,
} from "@frennix/api";

async function captureVideoPosterNative(videoUri: string): Promise<string | null> {
  try {
    const VideoThumbnails = require("expo-video-thumbnails") as typeof import("expo-video-thumbnails");
    const { uri } = await withTimeout(
      VideoThumbnails.getThumbnailAsync(videoUri, { time: 500, quality: 0.85 }),
      THUMBNAIL_CAPTURE_TIMEOUT_MS,
      "Video thumbnail capture"
    );
    return uri;
  } catch {
    return null;
  }
}

/** Generate thumbnail bytes and upload to storage for a new video post. */
export async function generateAndUploadVideoThumbnail(
  userId: string,
  videoUri: string,
  mimeType: string,
  file?: File | null
): Promise<string | null> {
  if (!isVideoMime(mimeType)) return null;

  try {
    if (Platform.OS === "web") {
      const objectUrl = file ? URL.createObjectURL(file) : videoUri;
      const dataUrl = await captureVideoPosterWeb(objectUrl);
      if (file) URL.revokeObjectURL(objectUrl);
      if (!dataUrl) return null;
      return uploadPostThumbnail(userId, dataUrlToBytes(dataUrl));
    }

    const posterUri = await captureVideoPosterNative(videoUri);
    if (!posterUri) return null;
    const bytes = await readImageBytes(posterUri);
    return uploadPostThumbnail(userId, new Uint8Array(bytes));
  } catch {
    return null;
  }
}
