/**
 * Mounts the visibility hook and a FullscreenVideoSlide-shaped handle so
 * temporal-dead-zone `seekTo` initialization errors fail this check.
 *
 * renderToString evaluates useCallback / useImperativeHandle dependency arrays
 * during render — the same TDZ path that crashed the Reels tab.
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
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { renderToString } from "react-dom/server";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SLIDE = path.join(ROOT, "packages/ui/src/FullscreenVideoSlide.tsx");
const VISIBILITY = path.join(ROOT, "packages/ui/src/useMediaVisibility.ts");

const MEDIA_AUTOPLAY_VISIBILITY_THRESHOLD = 0.6;

function hookLine(source, snippet) {
  const idx = source.indexOf(snippet);
  if (idx < 0) throw new Error(`Missing snippet: ${snippet}`);
  return source.slice(0, idx).split("\n").length;
}

/**
 * Production visibility hook, minus the react-native Platform import.
 * Declaration order and the useEffect body match useMediaVisibility.ts.
 */
function useMediaVisibility(externallyVisible) {
  const containerRef = useRef(null);
  const [intersectionVisible, setIntersectionVisible] = useState(externallyVisible);

  useEffect(() => {
    if (!externallyVisible) {
      setIntersectionVisible(false);
      return;
    }

    if (typeof document === "undefined") {
      setIntersectionVisible(true);
      return;
    }

    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setIntersectionVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const ratio = entries[0]?.intersectionRatio ?? 0;
        setIntersectionVisible(ratio >= MEDIA_AUTOPLAY_VISIBILITY_THRESHOLD);
      },
      { threshold: [0, MEDIA_AUTOPLAY_VISIBILITY_THRESHOLD, 1] }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [externallyVisible]);

  const isMostlyVisible = externallyVisible && intersectionVisible;
  return { containerRef, isMostlyVisible };
}

function MediaVisibilityProbe({ visible }) {
  const { isMostlyVisible } = useMediaVisibility(visible);
  return createElement("div", { "data-visible": String(isMostlyVisible) });
}

function FullscreenSlideHandleProbeInner(_props, ref) {
  const [currentTime] = useState(0);
  const [duration] = useState(10);
  const [isPaused] = useState(true);
  const [muted] = useState(true);

  const toggleMute = useCallback(() => {}, []);
  const seekTo = useCallback((value) => value, []);

  useImperativeHandle(
    ref,
    () => ({
      seekTo,
      getDuration: () => duration,
    }),
    [currentTime, duration, isPaused, muted, seekTo, toggleMute]
  );

  return createElement("div", { "data-slide": "ok" });
}

const FullscreenSlideHandleProbe = forwardRef(FullscreenSlideHandleProbeInner);

function BadSeekToBeforeInitInner(_props, ref) {
  const [duration] = useState(10);

  useImperativeHandle(
    ref,
    () => ({
      seekTo,
    }),
    [seekTo]
  );

  const seekTo = useCallback((value) => value, []);
  return createElement("div", null);
}

const BadSeekToBeforeInit = forwardRef(BadSeekToBeforeInitInner);

function assertThrowsTdz(mount) {
  let thrown = null;
  try {
    mount();
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown, "expected temporal-dead-zone initialization error");
  const message = String(thrown && thrown.message);
  assert.match(
    message,
    /Cannot access ['"]seekTo['"] before initialization|before initialization/,
    `unexpected error: ${message}`
  );
}

async function main() {
  const slide = fs.readFileSync(SLIDE, "utf8");
  const visibility = fs.readFileSync(VISIBILITY, "utf8");

  const lines = {
    seekTo: hookLine(slide, "const seekTo = useCallback"),
    handle: hookLine(slide, "useImperativeHandle("),
    visibilityEffect: hookLine(visibility, "useEffect(() => {"),
  };
  assert.ok(
    lines.seekTo < lines.handle,
    `FullscreenVideoSlide hook order must stay TDZ-safe (${JSON.stringify(lines)})`
  );
  assert.ok(!/\bseekTo\b/.test(visibility), "useMediaVisibility must not close over seekTo");

  renderToString(createElement(MediaVisibilityProbe, { visible: true }));
  renderToString(createElement(MediaVisibilityProbe, { visible: false }));

  const slideRef = createRef();
  renderToString(createElement(FullscreenSlideHandleProbe, { ref: slideRef }));

  assertThrowsTdz(() => {
    renderToString(createElement(BadSeekToBeforeInit, { ref: createRef() }));
  });

  console.log("PASS  useMediaVisibility mount + FullscreenVideoSlide handle order survive TDZ");
}

main().catch((error) => {
  console.error("FAIL  FullscreenVideoSlide / visibility hook TDZ mount —", error);
  process.exit(1);
});
