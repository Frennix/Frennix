/**
 * Pure-function + mock DOM regression for feed media client fixes.
 */
import assert from "node:assert/strict";
import {
  feedVideoReadyToReveal,
  shouldShowFeedVideoLoadingPlaceholder,
  shouldShowFeedVideoPosterLayer,
  VIDEO_REVEAL_FALLBACK_MS,
  VIDEO_REVEAL_POLL_MS,
} from "../packages/ui/src/videoMediaDelivery.ts";
import {
  feedDisplayImageUri,
  shouldAttachFeedVideoSource,
} from "../packages/ui/src/feedMediaDelivery.ts";
import {
  computeFeedMediaFrameHeight,
  feedFillParentStyle,
  resolveFeedCarouselFrameSizing,
} from "../packages/ui/src/mediaLayout.ts";
import {
  isDecodedDomImage,
  shouldRevealCachedDomImage,
} from "../packages/ui/src/progressiveImageReveal.ts";

assert.equal(feedVideoReadyToReveal(0), false);
assert.equal(feedVideoReadyToReveal(1), false);
assert.equal(feedVideoReadyToReveal(2), true);
assert.equal(feedVideoReadyToReveal(3), true);

assert.equal(shouldShowFeedVideoPosterLayer(null, false), false);
assert.equal(shouldShowFeedVideoPosterLayer("https://example.com/p.jpg", false), true);
assert.equal(shouldShowFeedVideoPosterLayer("https://example.com/p.jpg", true), false);

assert.equal(
  shouldShowFeedVideoLoadingPlaceholder(null, false, true),
  true,
  "null thumbnail + waiting shows loading placeholder"
);
assert.equal(
  shouldShowFeedVideoLoadingPlaceholder(null, true, true),
  false,
  "decoded frame hides loading placeholder"
);
assert.equal(
  shouldShowFeedVideoLoadingPlaceholder("https://example.com/p.jpg", false, true),
  false,
  "poster present skips loading placeholder"
);

assert.ok(VIDEO_REVEAL_FALLBACK_MS > 0);
assert.ok(VIDEO_REVEAL_POLL_MS > 0);
assert.ok(VIDEO_REVEAL_FALLBACK_MS < 25_000);

const iphoneFeedWidth = 430;
const carouselSizing = resolveFeedCarouselFrameSizing(iphoneFeedWidth, "portrait");
assert.ok(
  carouselSizing.frameHeight > 0,
  "carousel frame must have deterministic nonzero height before images mount"
);
assert.equal(
  carouselSizing.frameHeight,
  computeFeedMediaFrameHeight(iphoneFeedWidth, 0, 0, "portrait"),
  "carousel sizing matches feed bucket height helper"
);
assert.ok(
  carouselSizing.frameAspectRatio > 0,
  "carousel pre-width probe keeps aspect ratio fallback"
);
assert.equal(
  resolveFeedCarouselFrameSizing(0, "portrait").frameHeight,
  0,
  "zero width skips pixel height until layout resolves"
);

class MockVideo extends EventTarget {
  constructor() {
    super();
    this.readyState = 0;
    this.style = { opacity: "0" };
    this.error = null;
  }
}

function revealWhenReady(video) {
  if (!feedVideoReadyToReveal(video.readyState)) return false;
  video.style.opacity = "1";
  return true;
}

const video = new MockVideo();
assert.equal(revealWhenReady(video), false);
video.readyState = 2;
assert.equal(revealWhenReady(video), true);
assert.equal(video.style.opacity, "1");

let pollTicks = 0;
const startedAt = Date.now();
const poll = setInterval(() => {
  pollTicks += 1;
  if (revealWhenReady(video)) {
    clearInterval(poll);
    return;
  }
  if (Date.now() - startedAt >= VIDEO_REVEAL_FALLBACK_MS) {
    clearInterval(poll);
    if (feedVideoReadyToReveal(video.readyState)) {
      revealWhenReady(video);
    }
  }
}, VIDEO_REVEAL_POLL_MS);

await new Promise((resolve) => setTimeout(resolve, VIDEO_REVEAL_POLL_MS * 2));
clearInterval(poll);
assert.ok(pollTicks >= 1);
assert.equal(video.style.opacity, "1", "fallback poll keeps opacity revealed once readyState >= 2");

class MockCachedImage {
  constructor() {
    this.complete = true;
    this.naturalWidth = 1200;
    this.naturalHeight = 1600;
    this.style = { opacity: "0" };
  }
}

class MockFreshImage {
  constructor() {
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this.style = { opacity: "0" };
  }
}

function revealCachedDomImage(img, wrapperStyle) {
  if (!shouldRevealCachedDomImage(img)) return false;
  wrapperStyle.opacity = "1";
  return true;
}

function applyProgressiveImageLayoutReset(img, state) {
  if (shouldRevealCachedDomImage(img)) {
    state.opacity = "1";
    state.revealed = true;
    return state;
  }
  state.revealed = false;
  state.opacity = "0";
  return state;
}

const cached = new MockCachedImage();
const cachedWrapper = { opacity: "0" };
assert.equal(isDecodedDomImage(cached), true, "cached complete image is detected");
assert.equal(
  revealCachedDomImage(cached, cachedWrapper),
  true,
  "cached image reveals wrapper without waiting for load event"
);
assert.equal(cachedWrapper.opacity, "1");

const fresh = new MockFreshImage();
const freshWrapper = { opacity: "0" };
assert.equal(isDecodedDomImage(fresh), false, "in-flight image waits for onLoad");
assert.equal(revealCachedDomImage(fresh, freshWrapper), false);
assert.equal(freshWrapper.opacity, "0");

function cssPercentHeight(childHeight, parentHeight) {
  if (typeof childHeight === "number") return childHeight;
  if (childHeight === "100%" || childHeight === "fill") {
    return parentHeight > 0 ? parentHeight : 0;
  }
  return 0;
}

function carouselPhotoPaintHeight(frameHeight, pressFillsParent) {
  const pressHeight = pressFillsParent ? cssPercentHeight("fill", frameHeight) : cssPercentHeight("auto", frameHeight);
  const fillParentHeight = cssPercentHeight("100%", pressHeight);
  const imageHeight = cssPercentHeight("100%", fillParentHeight);
  return imageHeight;
}

function singlePhotoPaintHeight(frameHeight) {
  const pressHeight = frameHeight;
  return cssPercentHeight("100%", pressHeight);
}

const singlePhotoSizing = resolveFeedCarouselFrameSizing(iphoneFeedWidth, "portrait");
assert.ok(
  singlePhotoSizing.frameHeight > 0,
  "single-photo portrait bucket sizing stays nonzero for controls"
);
assert.equal(
  carouselPhotoPaintHeight(singlePhotoSizing.frameHeight, false),
  0,
  "carousel photos collapse when the press wrapper does not fill the slide"
);
assert.equal(
  carouselPhotoPaintHeight(singlePhotoSizing.frameHeight, true),
  singlePhotoSizing.frameHeight,
  "carousel photos fill the slide when the press wrapper fills the parent"
);
assert.equal(
  singlePhotoPaintHeight(singlePhotoSizing.frameHeight),
  singlePhotoSizing.frameHeight,
  "single-photo posts keep a self-sized frame"
);

const fillParent = feedFillParentStyle();
assert.equal(fillParent.height, "100%");
assert.equal(fillParent.width, "100%");
assert.equal(fillParent.flex, 1);
assert.equal(fillParent.alignSelf, "stretch");

const alreadyRevealed = applyProgressiveImageLayoutReset(cached, {
  opacity: "1",
  revealed: true,
});
assert.equal(
  alreadyRevealed.opacity,
  "1",
  "layout reset must not hide a decoded carousel/cached image"
);
assert.equal(alreadyRevealed.revealed, true);

const inFlightReset = applyProgressiveImageLayoutReset(fresh, {
  opacity: "1",
  revealed: true,
});
assert.equal(inFlightReset.opacity, "0");
assert.equal(inFlightReset.revealed, false);

const originalPng =
  "https://wkrwncovmpsveatlrqel.supabase.co/storage/v1/object/public/posts/author/photo.png";
const displayUri = feedDisplayImageUri(originalPng);
assert.ok(displayUri.includes("/storage/v1/render/image/public/"));
assert.ok(displayUri.includes("width=1080"));
assert.ok(displayUri.includes("format=webp"));
assert.ok(!displayUri.includes("/object/public/"));
assert.equal(
  feedDisplayImageUri("https://cdn.example.com/photo.jpg"),
  "https://cdn.example.com/photo.jpg",
  "non-supabase images stay unchanged"
);
assert.equal(
  feedDisplayImageUri("https://wkrwncovmpsveatlrqel.supabase.co/storage/v1/object/public/posts/a/clip.mp4"),
  "https://wkrwncovmpsveatlrqel.supabase.co/storage/v1/object/public/posts/a/clip.mp4",
  "videos are not sent through the image renderer"
);
assert.equal(feedDisplayImageUri("data:image/jpeg;base64,abc"), "data:image/jpeg;base64,abc");

assert.equal(
  shouldAttachFeedVideoSource({ loadPriority: "high", inView: false, preloadGranted: false, shouldPlay: false }),
  true,
  "visible feed video starts immediately"
);
assert.equal(
  shouldAttachFeedVideoSource({ loadPriority: "low", inView: false, preloadGranted: false, shouldPlay: false }),
  false,
  "offscreen video must not download ahead of the visible post"
);
assert.equal(
  shouldAttachFeedVideoSource({ loadPriority: "low", inView: true, preloadGranted: false, shouldPlay: false }),
  true
);
assert.equal(
  shouldShowFeedVideoLoadingPlaceholder(null, false, true),
  true,
  "missing poster shows a placeholder before the first frame"
);

console.log("verify-feed-media-client-fixes.render: all assertions passed");
