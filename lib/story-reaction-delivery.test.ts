import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  executeStoryReactionDelivery,
  storyReplyCompatibleMessageWrite,
  type StoryReactionDeliveryPorts,
  type StoryReactionMessageWrite,
  type StoryReactionWrite,
} from "../packages/api/src/story-reaction-delivery";
import {
  applyStoryReactionTap,
  createStoryReactionSelection,
  runLatestStoryReactionSend,
} from "./story-reaction-selection";

function createMockPorts() {
  const writes: StoryReactionWrite[] = [];
  const messages: StoryReactionMessageWrite[] = [];
  const events: string[] = [];
  const ports: StoryReactionDeliveryPorts = {
    getExistingReaction: async () => null,
    upsertReaction: async (row) => {
      writes.push(row);
      return { reaction: row.reaction };
    },
    getOrCreateConversation: async () => "conv-1",
    findExistingMessage: async () => null,
    updateExistingMessage: async () => {
      throw new Error("update should not run on the first tap");
    },
    sendMessage: async (input) => {
      messages.push(input);
      return { id: "msg-1", conversation_id: input.conversationId };
    },
    getPreviewUrl: async () => null,
    log: (event) => {
      events.push(event);
    },
  };
  return { ports, writes, messages, events };
}

describe("story reaction delivery path", () => {
  it("one tap causes exactly one reaction write and one DM delivery", async () => {
    let state = createStoryReactionSelection(null);
    const tap = applyStoryReactionTap(state, "🔥");
    state = tap.state;
    assert.equal(tap.shouldSend, true);

    const { ports, writes, messages, events } = createMockPorts();
    let handlerCalls = 0;

    const settled = await runLatestStoryReactionSend(state, tap.requestId, async () => {
      handlerCalls += 1;
      await executeStoryReactionDelivery(
        {
          requestId: tap.requestId,
          viewerId: "viewer-1",
          storyOwnerId: "owner-1",
          storyId: "story-1",
          slideId: "slide-1",
          emoji: "🔥",
        },
        ports
      );
    });

    assert.equal(settled.discardedBeforeSend, false);
    assert.equal(settled.invoked, true);
    assert.equal(handlerCalls, 1);
    assert.equal(writes.length, 1);
    assert.equal(messages.length, 1);
    assert.equal(writes[0]?.reaction, "🔥");
    assert.equal(writes[0]?.story_id, "story-1");
    assert.equal(writes[0]?.user_id, "viewer-1");
    assert.equal(messages[0]?.content, "Reacted 🔥 to your story");
    assert.deepEqual(
      messages[0],
      storyReplyCompatibleMessageWrite({
        conversationId: "conv-1",
        senderId: "viewer-1",
        content: "Reacted 🔥 to your story",
        mediaUrl: null,
        storyReplyId: "story-1",
      })
    );
    assert.equal(settled.state.status, "sent");
    assert.equal(settled.state.selected, "🔥");
    assert.deepEqual(events.slice(0, 3), [
      "handler-invoked",
      "reaction-upsert-started",
      "reaction-upserted",
    ]);
    assert.ok(events.includes("conversation-ready"));
    assert.ok(events.includes("message-inserted"));
    assert.ok(events.includes("delivered"));
  });

  it("writes the same displayed arm emoji the UI uses", async () => {
    const { ports, writes, messages } = createMockPorts();
    const result = await executeStoryReactionDelivery(
      {
        requestId: 7,
        viewerId: "viewer-1",
        storyOwnerId: "owner-1",
        storyId: "story-1",
        emoji: "💪",
      },
      ports
    );
    assert.equal(result.emoji, "💪🏾");
    assert.equal(writes[0]?.reaction, "💪🏾");
    assert.equal(messages[0]?.content, "Reacted 💪🏾 to your story");
  });

  it("updates an existing story-reaction message instead of inserting a second one", async () => {
    const { ports, writes, messages } = createMockPorts();
    let updates = 0;
    ports.getExistingReaction = async () => "🔥";
    ports.findExistingMessage = async () => ({
      id: "msg-existing",
      conversation_id: "conv-1",
      content: "Reacted 🔥 to your story",
      media_url: null,
      story_reply_id: "story-1",
    });
    ports.updateExistingMessage = async (input) => {
      updates += 1;
      return { id: input.id, conversation_id: "conv-1" };
    };

    const result = await executeStoryReactionDelivery(
      {
        requestId: 2,
        viewerId: "viewer-1",
        storyOwnerId: "owner-1",
        storyId: "story-1",
        emoji: "😂",
      },
      ports
    );

    assert.equal(writes.length, 1);
    assert.equal(writes[0]?.reaction, "😂");
    assert.equal(messages.length, 0);
    assert.equal(updates, 1);
    assert.equal(result.messageAction, "updated");
    assert.equal(result.messageId, "msg-existing");
  });

  it("still inserts a DM if the existing-message lookup fails", async () => {
    const { ports, messages } = createMockPorts();
    ports.findExistingMessage = async () => {
      throw new Error("lookup failed");
    };
    const result = await executeStoryReactionDelivery(
      {
        requestId: 3,
        viewerId: "viewer-1",
        storyOwnerId: "owner-1",
        storyId: "story-1",
        emoji: "👏",
      },
      ports
    );
    assert.equal(messages.length, 1);
    assert.equal(result.messageAction, "inserted");
  });
});
