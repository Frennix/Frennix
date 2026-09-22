import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runMountedStoryReaction } from "./run-mounted-story-reaction";

describe("mounted Story Viewer reaction bridge", () => {
  it("a tap reaches the page onReact callback and awaits it once", async () => {
    const calls: unknown[][] = [];
    let sendDedicatedStoryReactionCalls = 0;
    const pageOnReact = async (
      ownerId: string,
      storyId: string,
      emoji: string,
      slideId?: string | null,
      requestId?: number
    ) => {
      calls.push([ownerId, storyId, emoji, slideId, requestId]);
      sendDedicatedStoryReactionCalls += 1;
    };
    const stages: string[] = [];

    await runMountedStoryReaction({
      emoji: "🔥",
      requestId: 17,
      storyId: "story-1",
      viewerId: "viewer-1",
      ownerId: "owner-1",
      slideId: "slide-1",
      pageOnReact,
      onStage: (stage, status) => stages.push(`${stage}:${status}`),
    });

    assert.equal(calls.length, 1);
    assert.equal(sendDedicatedStoryReactionCalls, 1);
    assert.deepEqual(calls[0], ["owner-1", "story-1", "🔥", "slide-1", 17]);
    assert.ok(stages.includes("viewer handler:ok"));
    assert.ok(stages.includes("page callback:ok"));
  });

  it("fails visibly when the page-level onReact callback is missing", async () => {
    const stages: string[] = [];
    await assert.rejects(
      () =>
        runMountedStoryReaction({
          emoji: "❤️",
          requestId: 2,
          storyId: "story-1",
          viewerId: "viewer-1",
          ownerId: "owner-1",
          slideId: null,
          pageOnReact: undefined,
          onStage: (stage, status, detail) => stages.push(`${stage}:${status}:${detail ?? ""}`),
        }),
      /couldn’t be delivered/i
    );
    assert.ok(stages.some((line) => line.includes("page callback:fail")));
  });
});
