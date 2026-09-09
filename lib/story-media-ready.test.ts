import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyStoryMediaFailed,
  applyStoryMediaReady,
  collectAuthorizedStoryPreloadUrls,
  collectViewerPreloadUrls,
  createStoryMediaReadyState,
  isAuthorizedStoryMediaUrl,
  retryStoryMediaReady,
  shouldStartStoryProgressTimer,
  storySlideNeedsMedia,
} from "./story-media-ready";

describe("story media timer gating", () => {
  it("starts text/workout slides ready so they can run the timer", () => {
    const state = createStoryMediaReadyState("0-0-true", false);
    assert.equal(state.ready, true);
    assert.equal(state.failed, false);
    assert.equal(
      shouldStartStoryProgressTimer({
        visible: true,
        hasStory: true,
        mediaReady: state.ready,
        mediaFailed: state.failed,
        autoAdvancePaused: false,
      }),
      true
    );
  });

  it("keeps media slides blocked until onLoad / rendered frame", () => {
    const loading = createStoryMediaReadyState("0-0-true", true);
    assert.equal(loading.ready, false);
    assert.equal(storySlideNeedsMedia({ kind: "media" }), true);
    assert.equal(
      shouldStartStoryProgressTimer({
        visible: true,
        hasStory: true,
        mediaReady: loading.ready,
        mediaFailed: loading.failed,
        autoAdvancePaused: false,
      }),
      false
    );

    const ready = applyStoryMediaReady(loading);
    assert.equal(ready.ready, true);
    assert.equal(ready.failed, false);
    assert.equal(
      shouldStartStoryProgressTimer({
        visible: true,
        hasStory: true,
        mediaReady: ready.ready,
        mediaFailed: ready.failed,
        autoAdvancePaused: false,
      }),
      true
    );
  });

  it("does not auto-advance while loading or after error", () => {
    const loading = createStoryMediaReadyState("1-0-true", true);
    const failed = applyStoryMediaFailed(loading);
    assert.equal(failed.ready, false);
    assert.equal(failed.failed, true);
    assert.equal(
      shouldStartStoryProgressTimer({
        visible: true,
        hasStory: true,
        mediaReady: failed.ready,
        mediaFailed: failed.failed,
        autoAdvancePaused: false,
      }),
      false
    );
  });

  it("retry clears failure and waits for the same authorized URL again", () => {
    const failed = applyStoryMediaFailed(createStoryMediaReadyState("0-1-true", true));
    const retried = retryStoryMediaReady(failed, true);
    assert.equal(retried.timerKey, "0-1-true");
    assert.equal(retried.ready, false);
    assert.equal(retried.failed, false);
  });

  it("resets readiness when the slide / timerKey changes", () => {
    const previous = applyStoryMediaReady(createStoryMediaReadyState("0-0-true", true));
    const next = createStoryMediaReadyState("0-1-true", true);
    assert.equal(previous.ready, true);
    assert.equal(next.timerKey, "0-1-true");
    assert.equal(next.ready, false);
    assert.equal(next.failed, false);
  });

  it("pauses timer while hold/reply/controls are open even after media is ready", () => {
    assert.equal(
      shouldStartStoryProgressTimer({
        visible: true,
        hasStory: true,
        mediaReady: true,
        mediaFailed: false,
        autoAdvancePaused: true,
      }),
      false
    );
  });
});

describe("authorized story preload", () => {
  it("preloads only current and next authorized http URLs", () => {
    const urls = collectAuthorizedStoryPreloadUrls(
      [
        {
          kind: "media",
          url: "https://example.test/object/sign/stories/current.jpg",
        },
        {
          kind: "media",
          url: "https://example.test/object/public/posts/u/stories/next.jpg",
        },
        {
          kind: "media",
          url: "https://example.test/object/sign/stories/third.jpg",
        },
      ],
      0
    );
    assert.deepEqual(urls, [
      "https://example.test/object/sign/stories/current.jpg",
      "https://example.test/object/public/posts/u/stories/next.jpg",
    ]);
  });

  it("never preloads unsigned private-bucket markers", () => {
    assert.equal(isAuthorizedStoryMediaUrl("stories-private:user/file.jpg"), false);
    const urls = collectAuthorizedStoryPreloadUrls(
      [{ kind: "media", url: "stories-private:user/file.jpg" }],
      0
    );
    assert.deepEqual(urls, []);
  });

  it("can include the next authorized viewer's first slide", () => {
    const urls = collectViewerPreloadUrls({
      currentSlides: [{ kind: "media", url: "https://example.test/a.jpg" }],
      currentIndex: 0,
      nextStoryFirstSlide: { kind: "media", url: "https://example.test/b.jpg" },
    });
    assert.deepEqual(urls, ["https://example.test/a.jpg", "https://example.test/b.jpg"]);
  });
});
