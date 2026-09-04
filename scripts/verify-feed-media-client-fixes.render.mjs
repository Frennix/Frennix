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

console.log("verify-feed-media-client-fixes.render: all assertions passed");
