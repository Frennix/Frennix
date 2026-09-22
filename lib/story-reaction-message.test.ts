import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatStoryReactionDisplay,
  formatStoryReactionMessageContent,
  parseStoryReactionMessage,
  storyReactionIdempotencyKey,
} from "../packages/types/src/story-engagement";
import {
  canonicalizeStoryReaction,
  STORY_QUICK_REACTIONS,
} from "../packages/types/src/workout-story";

describe("story reaction message copy", () => {
  it("stores Instagram-style content that can be parsed back", () => {
    const content = formatStoryReactionMessageContent("💪");
    assert.equal(content, "Reacted 💪🏾 to your story");
    assert.deepEqual(parseStoryReactionMessage(content), { emoji: "💪🏾", key: "strong" });
  });

  it("renders sender and owner labels", () => {
    assert.equal(
      formatStoryReactionDisplay({
        emoji: "💪🏾",
        isOwn: true,
        ownerName: "Xoch",
      }),
      "You reacted 💪🏾 to Xoch's story"
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

describe("canonical story reactions", () => {
  it("exposes exactly the seven displayed reactions", () => {
    assert.deepEqual(
      STORY_QUICK_REACTIONS.map((reaction) => `${reaction.key}:${reaction.emoji}`),
      ["strong:💪🏾", "fire:🔥", "applause:👏", "love:❤️", "eyes:👀", "laugh:😂", "support:🤝"]
    );
  });

  it("maps every displayed option and skin-tone alias to a stored key", () => {
    for (const reaction of STORY_QUICK_REACTIONS) {
      assert.equal(canonicalizeStoryReaction(reaction.emoji)?.key, reaction.key);
      assert.equal(canonicalizeStoryReaction(reaction.key)?.emoji, reaction.emoji);
    }
    assert.equal(canonicalizeStoryReaction("💪")?.key, "strong");
    assert.equal(canonicalizeStoryReaction("💪")?.emoji, "💪🏾");
    assert.equal(canonicalizeStoryReaction("❤")?.key, "love");
    assert.equal(canonicalizeStoryReaction("unknown"), null);
  });

  it("formats a DM for every displayed reaction", () => {
    for (const reaction of STORY_QUICK_REACTIONS) {
      const content = formatStoryReactionMessageContent(reaction.key);
      assert.equal(content, `Reacted ${reaction.emoji} to your story`);
      assert.deepEqual(parseStoryReactionMessage(content), {
        emoji: reaction.emoji,
        key: reaction.key,
      });
    }
  });
});
