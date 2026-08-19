import { createElement, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { MediaLoadError } from "./MediaLoadError";
import { ProgressiveImage } from "./ProgressiveImage";
import { colors } from "./theme";
import { useVideoPoster } from "./useVideoPoster";

/** Align with ImageLightbox close chrome — native mute sits left of the ✕. */
const LIGHTBOX_CLOSE_SIZE = 34;
const LIGHTBOX_CLOSE_RIGHT_INSET = 8;
const LIGHTBOX_CONTROL_GAP = 12;
const WEB_LIGHTBOX_TOP_RIGHT_GUTTER =
  LIGHTBOX_CLOSE_RIGHT_INSET + LIGHTBOX_CLOSE_SIZE + LIGHTBOX_CONTROL_GAP;

interface FullscreenVideoSlideProps {
  uri: string;
  thumbnailUrl?: string | null;
  stageWidth: number;
  stageHeight: number;
  isActive: boolean;
}

/** Full-screen gallery video slide — native controls handle audio; no feed-style mute overlay. */
export function FullscreenVideoSlide({
  uri,
  thumbnailUrl,
  stageWidth,
  stageHeight,
  isActive,
}: FullscreenVideoSlideProps) {
  const posterState = useVideoPoster(uri, thumbnailUrl);
  const [muted, setMuted] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  const nativeVideoRef = useRef<{ pauseAsync: () => Promise<void>; playAsync: () => Promise<void>; setIsMutedAsync: (v: boolean) => Promise<void> } | null>(null);

  useEffect(() => {
    setFailed(false);
  }, [uri, retryKey]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const video = webVideoRef.current;
    if (!video) return;

    video.muted = muted;
    if (isActive && !failed) void video.play().catch(() => setFailed(true));
    else video.pause();
  }, [isActive, muted, failed, uri, retryKey]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const video = nativeVideoRef.current;
    if (!video) return;

    void (async () => {
      try {
        await video.setIsMutedAsync(muted);
        if (isActive && !failed) await video.playAsync();
        else await video.pauseAsync();
      } catch {
        setFailed(true);
      }
    })();
  }, [isActive, muted, failed, uri, retryKey]);

  const handleRetry = useCallback(() => {
    setFailed(false);
    setRetryKey((key) => key + 1);
  }, []);

  if (failed) {
    return (
      <View style={[styles.stage, { width: stageWidth, height: stageHeight }]}>
        <MediaLoadError label="Video unavailable" onRetry={handleRetry} />
      </View>
    );
  }

  return (
    <View style={[styles.stage, { width: stageWidth, height: stageHeight }]}>
      {Platform.OS === "web" ? (
        <View style={[styles.webVideoChrome, { width: stageWidth, height: stageHeight }]}>
          {createElement("video", {
            key: retryKey,
            ref: (node: HTMLVideoElement | null) => {
              webVideoRef.current = node;
            },
            src: uri,
            controls: true,
            muted,
            playsInline: true,
            preload: isActive ? "auto" : "metadata",
            poster: posterState.posterUri ?? thumbnailUrl ?? undefined,
            style: {
              width: "100%",
              height: "100%",
              objectFit: "contain",
              backgroundColor: colors.background,
            },
            onWaiting: () => setBuffering(true),
            onPlaying: () => setBuffering(false),
            onCanPlay: () => setBuffering(false),
            onError: () => setFailed(true),
          })}
        </View>
      ) : (
        (() => {
          try {
            const { Video, ResizeMode } = require("expo-av") as typeof import("expo-av");
            return (
              <Video
                key={retryKey}
                ref={(ref) => {
                  nativeVideoRef.current = ref;
                }}
                source={{ uri }}
                style={{ width: stageWidth, height: stageHeight }}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={isActive}
                isMuted={muted}
                useNativeControls
                posterSource={
                  posterState.posterUri ? { uri: posterState.posterUri } : undefined
                }
                usePoster={Boolean(posterState.posterUri)}
                onPlaybackStatusUpdate={(status) => {
                  if (!status.isLoaded) {
                    if ("error" in status && status.error) setFailed(true);
                    return;
                  }
                  setBuffering(status.isBuffering);
                }}
              />
            );
          } catch {
            return <MediaLoadError label="Video unavailable" onRetry={handleRetry} />;
          }
        })()
      )}

      {!isActive && posterState.posterUri ? (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <ProgressiveImage
            uri={posterState.posterUri}
            placeholderUri={thumbnailUrl}
            style={{ width: stageWidth, height: stageHeight }}
            contentFit="contain"
            accessibilityLabel="Video poster"
          />
        </View>
      ) : null}

      {buffering ? (
        <View style={styles.bufferingOverlay} pointerEvents="none">
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    justifyContent: "center",
    alignItems: "center",
    overflow: "visible",
    backgroundColor: colors.background,
  },
  webVideoChrome: {
    paddingRight: WEB_LIGHTBOX_TOP_RIGHT_GUTTER,
    ...(Platform.OS === "web"
      ? ({
          paddingTop: "max(env(safe-area-inset-top, 0px), 12px)",
          boxSizing: "border-box",
        } as object)
      : null),
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10, 10, 11, 0.35)",
  },
});
