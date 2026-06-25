import {
  THUMBNAIL_CAPTURE_TIMEOUT_MS,
  withTimeout,
} from "./upload-utils";

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Capture a JPEG poster frame from a video on web (for upload). */
export async function captureVideoPosterWeb(videoSrc: string): Promise<string | null> {
  if (typeof document === "undefined") return null;

  try {
    return await withTimeout(
      captureVideoPosterWebInner(videoSrc),
      THUMBNAIL_CAPTURE_TIMEOUT_MS,
      "Video thumbnail capture"
    );
  } catch {
    return null;
  }
}

async function captureVideoPosterWebInner(videoSrc: string): Promise<string | null> {
  const captureWithCrossOrigin = (crossOrigin: string | null) =>
    new Promise<string | null>((resolve, reject) => {
      const video = document.createElement("video");
      if (crossOrigin) video.crossOrigin = crossOrigin;
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;

      const cleanup = () => {
        video.src = "";
        video.load();
      };

      video.onloadeddata = () => {
        video.currentTime = Math.min(0.25, video.duration > 0 ? video.duration / 2 : 0.25);
      };

      video.onseeked = () => {
        try {
          const width = video.videoWidth || 640;
          const height = video.videoHeight || 360;
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            cleanup();
            resolve(null);
            return;
          }
          ctx.drawImage(video, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          cleanup();
          resolve(dataUrl);
        } catch (error) {
          cleanup();
          reject(error);
        }
      };

      video.onerror = () => {
        cleanup();
        reject(new Error("Could not load video for thumbnail"));
      };

      video.src = videoSrc;
    });

  const isBlobOrData = videoSrc.startsWith("blob:") || videoSrc.startsWith("data:");
  if (isBlobOrData) {
    return captureWithCrossOrigin("anonymous");
  }

  const withCors = await captureWithCrossOrigin("anonymous");
  if (withCors) return withCors;
  return captureWithCrossOrigin(null);
}
