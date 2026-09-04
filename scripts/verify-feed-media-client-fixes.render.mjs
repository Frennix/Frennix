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
  computeFeedMediaFrameHeight,
  resolveFeedCarouselFrameSizing,
} from "../packages/ui/src/mediaLayout.ts";
import { isDecodedDomImage } from "../packages/ui/src/progressiveImageReveal.ts";

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
  if (!isDecodedDomImage(img)) return false;
  wrapperStyle.opacity = "1";
  return true;
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

const singlePhotoSizing = resolveFeedCarouselFrameSizing(iphoneFeedWidth, "portrait");
assert.ok(
  singlePhotoSizing.frameHeight > 0,
  "single-photo portrait bucket sizing stays nonzero for controls"
);

console.log("verify-feed-media-client-fixes.render: all assertions passed");
