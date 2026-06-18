import { Platform } from "react-native";
import { MEDIA_READ_TIMEOUT_MS, normalizeMediaExt, withTimeout } from "@frennix/api";

/** On web, ensure the picker asset is a File for reliable Supabase uploads. */
export async function resolveVideoUploadFile(
  uri: string,
  mimeType: string,
  file?: File
): Promise<File | undefined> {
  if (file) return file;
  if (Platform.OS !== "web") return undefined;

  const response = await withTimeout(fetch(uri), MEDIA_READ_TIMEOUT_MS, "Reading video file");
  if (!response.ok) {
    throw new Error(`Could not read video file (HTTP ${response.status})`);
  }

  const blob = await withTimeout(response.blob(), MEDIA_READ_TIMEOUT_MS, "Reading video file");
  const ext = normalizeMediaExt(mimeType);
  return new File([blob], `video.${ext}`, { type: mimeType });
}
