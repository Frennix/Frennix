import { createElement, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MediaLoadError } from "./MediaLoadError";
import { ProgressiveImage } from "./ProgressiveImage";
import { colors, spacing } from "./theme";
import { useVideoPoster } from "./useVideoPoster";

interface FullscreenVideoSlideProps {
  uri: string;
  thumbnailUrl?: string | null;
  stageWidth: number;
  stageHeight: number;
  isActive: boolean;
}

/** Full-screen gallery video slide with controls, mute toggle, and buffering state. */
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
        createElement("video", {
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
            width: stageWidth,
            height: stageHeight,
            objectFit: "contain",
            backgroundColor: colors.background,
          },
          onWaiting: () => setBuffering(true),
          onPlaying: () => setBuffering(false),
          onCanPlay: () => setBuffering(false),
          onError: () => setFailed(true),
        })
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

      <Pressable
        style={styles.muteButton}
        onPress={() => setMuted((current) => !current)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={muted ? "Unmute video" : "Mute video"}
      >
        <Text style={styles.muteIcon}>{muted ? "🔇" : "🔊"}</Text>
      </Pressable>
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
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10, 10, 11, 0.35)",
  },
  muteButton: {
    position: "absolute",
    bottom: spacing.lg,
    left: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10, 10, 11, 0.75)",
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 10,
  },
  muteIcon: {
    fontSize: 18,
    lineHeight: 20,
  },
});
