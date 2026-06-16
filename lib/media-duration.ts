import { Platform } from "react-native";
import type { ImagePickerAsset } from "expo-image-picker";
import { isVideoMime } from "@frennix/api";

export const VIDEO_MAX_SECONDS = 60;
export const VIDEO_TOO_LONG_MESSAGE =
  "Video is too long. Please choose a video that is 60 seconds or less.";

/** Normalize picker duration to seconds (native reports ms; web reports seconds). */
export function normalizeVideoDuration(duration: number | null | undefined): number | null {
  if (duration == null || Number.isNaN(duration)) return null;
  if (duration > 1000) return duration / 1000;
  return duration;
}

export function formatVideoDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

export async function readVideoDurationSeconds(uri: string): Promise<number | null> {
  if (Platform.OS === "web") {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => resolve(video.duration);
      video.onerror = () => resolve(null);
      video.src = uri;
    });
  }

  try {
    const { Audio } = require("expo-av") as typeof import("expo-av");
    const { sound, status } = await Audio.Sound.createAsync({ uri }, { shouldPlay: false });
    await sound.unloadAsync();
    if (status.isLoaded && status.durationMillis != null) {
      return status.durationMillis / 1000;
    }
  } catch {
    return null;
  }

  return null;
}

export async function getVideoDurationSeconds(
  asset: ImagePickerAsset,
  mimeType: string
): Promise<number | null> {
  if (!isVideoMime(mimeType) && asset.type !== "video") return null;

  const fromAsset = normalizeVideoDuration(asset.duration);
  if (fromAsset != null) return fromAsset;

  return readVideoDurationSeconds(asset.uri);
}

export function isVideoTooLong(durationSeconds: number | null): boolean {
  return durationSeconds != null && durationSeconds > VIDEO_MAX_SECONDS;
}
