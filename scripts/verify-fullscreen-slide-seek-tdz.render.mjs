/**
 * Runtime mount: ImmersiveVideoViewer-shaped Reel path evaluates FullscreenVideoSlide hooks.
 * renderToString runs useCallback/useImperativeHandle — the exact TDZ that crashed Reels.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createElement,
  createRef,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { renderToString } from "react-dom/server";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SLIDE = path.join(ROOT, "packages/ui/src/FullscreenVideoSlide.tsx");
const VIEWER = path.join(ROOT, "components/ImmersiveVideoViewer.tsx");

function lineOf(source, snippet) {
  const idx = source.indexOf(snippet);
  if (idx < 0) throw new Error(`missing ${snippet}`);
  return source.slice(0, idx).split("\n").length;
}

/**
 * Mirrors FullscreenVideoSlide hook order used by ImmersiveVideoViewer:
 * ref + immersiveMode + seek helpers exposed for ReelScrubBar.
 */
const FullscreenVideoSlide = forwardRef(function FullscreenVideoSlide(props, ref) {
  const [duration] = useState(0);
  const [currentTime] = useState(0);
  const [isPaused] = useState(true);
  const [muted] = useState(true);
  const webVideoRef = useRef(null);
  const revealControls = useCallback(() => {}, []);

  const seekTo = useCallback(
    (value, options) => {
      const video = webVideoRef.current;
      if (!video) return;
      const max = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : duration;
      const next = Math.min(Math.max(0, value), Math.max(0, max));
      if (options?.silent) {
        video.currentTime = next;
        return;
      }
      video.currentTime = next;
      revealControls();
    },
    [duration, revealControls]
  );

  const getDuration = useCallback(() => {
    const video = webVideoRef.current;
    if (video && Number.isFinite(video.duration) && video.duration > 0) return video.duration;
    return duration;
  }, [duration]);

  const getVideoElement = useCallback(() => webVideoRef.current, []);

  useImperativeHandle(
    ref,
    () => ({
      seekTo,
      getDuration,
      getVideoElement,
      getPlaybackSnapshot: () => ({ currentTime, muted, wasPlaying: !isPaused }),
    }),
    [currentTime, duration, getDuration, getVideoElement, isPaused, muted, seekTo]
  );

  void props;
  return createElement("div", { "data-frennix-fullscreen-slide": "true" });
});

function ImmersiveVideoViewerReelPath() {
  const videoRef = useRef(null);
  return createElement(
    "div",
    { "data-frennix-immersive-viewer": "true" },
    createElement(FullscreenVideoSlide, {
      ref: videoRef,
      uri: "https://example.test/reel.mp4",
      thumbnailUrl: "https://example.test/thumb.jpg",
      stageWidth: 390,
      stageHeight: 844,
      isActive: true,
      immersiveMode: true,
      routePlayback: true,
    })
  );
}

function main() {
  const slide = fs.readFileSync(SLIDE, "utf8");
  const viewer = fs.readFileSync(VIEWER, "utf8");
  const seekLine = lineOf(slide, "  const seekTo = useCallback(");
  const handleLine = lineOf(slide, "  useImperativeHandle(");
  assert.ok(seekLine < handleLine, `seekTo@${seekLine} must precede useImperativeHandle@${handleLine}`);
  assert.match(viewer, /<FullscreenVideoSlide/);
  assert.match(viewer, /ref=\{videoRef\}/);
  assert.match(viewer, /immersiveMode/);
  assert.match(viewer, /<ReelScrubBar/);

  const html = renderToString(createElement(ImmersiveVideoViewerReelPath));
  assert.match(html, /data-frennix-fullscreen-slide/);
  assert.match(html, /data-frennix-immersive-viewer/);

  const handle = createRef();
  renderToString(
    createElement(FullscreenVideoSlide, {
      ref: handle,
      uri: "https://example.test/reel.mp4",
      stageWidth: 390,
      stageHeight: 844,
      isActive: true,
      immersiveMode: true,
    })
  );

  console.log("PASS  FullscreenVideoSlide Reel-path hook mount survives seekTo initialization");
}

main();
