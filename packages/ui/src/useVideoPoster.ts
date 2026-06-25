import { useEffect, useState } from "react";
import { Platform } from "react-native";

const posterCache = new Map<string, Promise<string | null>>();

async function captureVideoPosterWeb(videoSrc: string): Promise<string | null> {
  if (Platform.OS !== "web" || typeof globalThis.document === "undefined") return null;

  const document = globalThis.document;

  const captureWithCrossOrigin = (crossOrigin: string | null) =>
    new Promise<string | null>((resolve) => {
      const video = document.createElement("video");
      if (crossOrigin) video.crossOrigin = crossOrigin;
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;

      const cleanup = () => {
        video.src = "";
        video.load();
      };

      video.onloadeddata = () => {
        video.currentTime = Math.min(0.5, video.duration > 0 ? video.duration / 3 : 0.5);
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
        } catch {
          cleanup();
          resolve(null);
        }
      };

      video.onerror = () => {
        cleanup();
        resolve(null);
      };

      video.src = videoSrc.includes("#") ? videoSrc : `${videoSrc}#t=0.5`;
    });

  const isBlobOrData = videoSrc.startsWith("blob:") || videoSrc.startsWith("data:");
  if (isBlobOrData) {
    return captureWithCrossOrigin("anonymous");
  }

  const withCors = await captureWithCrossOrigin("anonymous");
  if (withCors) return withCors;
  return captureWithCrossOrigin(null);
}

async function captureVideoPosterNative(videoUri: string): Promise<string | null> {
  try {
    const VideoThumbnails = require("expo-video-thumbnails") as typeof import("expo-video-thumbnails");
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, { time: 500, quality: 0.85 });
    return uri;
  } catch {
    return null;
  }
}

function resolveFallbackPoster(videoUri: string): Promise<string | null> {
  const cached = posterCache.get(videoUri);
  if (cached) return cached;

  const pending =
    Platform.OS === "web"
      ? captureVideoPosterWeb(videoUri)
      : captureVideoPosterNative(videoUri);

  posterCache.set(videoUri, pending);
  void pending.catch(() => {
    posterCache.delete(videoUri);
  });

  return pending;
}

export type VideoPosterState = {
  posterUri: string | null;
  /** True once thumbnail URL or fallback capture attempt has finished. */
  ready: boolean;
  /** Use inline video element for first-frame display (web, when no stored thumbnail). */
  useVideoFrameFallback: boolean;
};

/** Returns a poster URI for a video — stored thumbnail first, then first-frame fallback. */
export function useVideoPoster(videoUri: string | undefined, thumbnailUrl?: string | null): VideoPosterState {
  const [posterUri, setPosterUri] = useState<string | null>(thumbnailUrl ?? null);
  const [ready, setReady] = useState(Boolean(thumbnailUrl) || !videoUri);
  const [useVideoFrameFallback, setUseVideoFrameFallback] = useState(
    Platform.OS === "web" && Boolean(videoUri) && !thumbnailUrl
  );

  useEffect(() => {
    if (thumbnailUrl) {
      setPosterUri(thumbnailUrl);
      setReady(true);
      setUseVideoFrameFallback(false);
      return;
    }

    if (!videoUri) {
      setPosterUri(null);
      setReady(true);
      setUseVideoFrameFallback(false);
      return;
    }

    let cancelled = false;

    if (Platform.OS === "web") {
      setPosterUri(null);
      setUseVideoFrameFallback(true);
      setReady(true);
      return;
    }

    setReady(false);
    setPosterUri(null);
    setUseVideoFrameFallback(false);

    void resolveFallbackPoster(videoUri).then((uri) => {
      if (cancelled) return;
      if (uri) {
        setPosterUri(uri);
        setUseVideoFrameFallback(false);
      }
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [videoUri, thumbnailUrl]);

  return { posterUri, ready, useVideoFrameFallback };
}
