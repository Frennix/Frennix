import { isVideoMime } from "./media-utils";

/** Supabase Storage standard upload limit per object (50 MiB on hosted projects). */
export const VIDEO_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;
export const IMAGE_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
export const VIDEO_UPLOAD_TIMEOUT_MS = 120_000;
export const IMAGE_UPLOAD_TIMEOUT_MS = 60_000;
export const THUMBNAIL_CAPTURE_TIMEOUT_MS = 15_000;
export const MEDIA_READ_TIMEOUT_MS = 30_000;
export const POST_CREATE_TIMEOUT_MS = 30_000;

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export function validateMediaUploadSize(size: number, mimeType: string): void {
  const isVideo = isVideoMime(mimeType);
  const maxBytes = isVideo ? VIDEO_UPLOAD_MAX_BYTES : IMAGE_UPLOAD_MAX_BYTES;

  if (size <= 0) {
    throw new Error("Media file is empty");
  }

  if (size > maxBytes) {
    const sizeMb = (size / (1024 * 1024)).toFixed(1);
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    throw new Error(
      isVideo
        ? `Video is too large (${sizeMb} MB). Maximum upload size is ${maxMb} MB.`
        : `Image is too large (${sizeMb} MB). Maximum upload size is ${maxMb} MB.`
    );
  }
}

export async function readMediaUploadBody(
  uri: string,
  mimeType: string,
  file?: File | null
): Promise<Blob | File> {
  if (file) {
    validateMediaUploadSize(file.size, mimeType);
    return file;
  }

  const response = await withTimeout(fetch(uri), MEDIA_READ_TIMEOUT_MS, "Reading media file");
  if (!response.ok) {
    throw new Error(`Could not read media file (HTTP ${response.status})`);
  }

  const blob = await withTimeout(response.blob(), MEDIA_READ_TIMEOUT_MS, "Reading media file");
  validateMediaUploadSize(blob.size, mimeType);
  return blob;
}
