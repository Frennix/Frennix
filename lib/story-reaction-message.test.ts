import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatStoryReactionDisplay,
  formatStoryReactionMessageContent,
  parseStoryReactionMessage,
  storyReactionIdempotencyKey,
} from "../packages/types/src/story-engagement";

describe("story reaction message copy", () => {
  it("stores Instagram-style content that can be parsed back", () => {
    const content = formatStoryReactionMessageContent("💪");
    assert.equal(content, "Reacted 💪 to your story");
    assert.deepEqual(parseStoryReactionMessage(content), { emoji: "💪" });
  });

  it("renders sender and owner labels", () => {
    assert.equal(
      formatStoryReactionDisplay({
        emoji: "💪",
        isOwn: true,
        ownerName: "Xoch",
      }),
      "You reacted 💪 to Xoch's story"
    );
    assert.equal(
      formatStoryReactionDisplay({
        emoji: "❤️",
        isOwn: false,
        senderName: "Markeith",
      }),
      "Markeith reacted ❤️ to your story"
    );
  });

  it("uses a stable viewer + story + slide key", () => {
    assert.equal(
      storyReactionIdempotencyKey("viewer-1", "story-1", "slide-1"),
      "viewer-1:story-1:slide-1"
    );
    assert.equal(
      storyReactionIdempotencyKey("viewer-1", "story-1", null),
      "viewer-1:story-1:story"
    );
  });
});
