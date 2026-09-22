import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildNotificationDisplay } from "../packages/api/src/notifications";
import type { Notification } from "../packages/types/src";
import {
  applyRenderedStoryReactionEmoji,
  applyStoryReactionNotificationWrite,
  buildStoryReactionNotificationPayload,
  overlayStoryReactionNotifications,
  planStoryReactionOwnerNotification,
  storyReactionNotificationDedupeKey,
} from "../packages/api/src/notifications";
import {
  applyMountedStoryReactionFromReadableSource,
  extractMountedStoryReactionRefs,
} from "../packages/api/src/story-reaction-notification-display";
import { executeStoryReactionDelivery, type StoryReactionDeliveryPorts } from "../packages/api/src/story-reaction-delivery";

/** Exact select("*") + enrich shape consumed by app/notifications.tsx → FrennixNotificationRow. */
function mountedNotificationsCenterRow(
  overrides: Partial<Notification> = {},
  payloadOverrides: Record<string, unknown> = {}
): Notification {
  return {
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    user_id: "owner-1",
    type: "story_reaction",
    payload: {
      story_id: "story-1",
      story_item_id: "slide-1",
      reactor_id: "viewer-1",
      reaction: "🔥",
      conversation_id: "conv-1",
      message_id: "msg-1",
      ...payloadOverrides,
    },
    read_at: null,
    created_at: "2026-09-22T07:00:00.000Z",
    deleted_at: null,
    actor_id: "viewer-1",
    entity_type: "story",
    entity_id: "story-1",
    title: "Story reaction",
    body: "Founder reacted 🔥 to your story",
    deep_link: "/notifications",
    category: "social",
    dedupe_key: "story_reaction:story-1:viewer-1",
    delivered_at: null,
    expires_at: null,
    metadata: {},
    actor: {
      id: "viewer-1",
      username: "founder",
      display_name: "Founder",
      avatar_url: null,
    } as Notification["actor"],
    ...overrides,
  };
}

describe("story reaction owner notification", () => {
  it("uses a stable dedupe key that does not include the emoji", () => {
    const fire = storyReactionNotificationDedupeKey("story-1", "viewer-1");
    const laugh = storyReactionNotificationDedupeKey("story-1", "viewer-1");
    assert.equal(fire, "story_reaction:story-1:viewer-1");
    assert.equal(fire, laugh);
    assert.equal(fire.includes("🔥"), false);
  });

  it("creates a story_reaction notification for the owner after first delivery", async () => {
    const plan = planStoryReactionOwnerNotification({
      ownerId: "owner-1",
      actorId: "viewer-1",
      storyId: "story-1",
      slideId: "slide-1",
      emoji: "🔥",
      conversationId: "conv-1",
      messageId: "msg-1",
    });
    assert.equal(plan.action, "create");
    assert.equal(plan.write.ownerId, "owner-1");
    assert.equal(plan.write.actorId, "viewer-1");
    assert.deepEqual(
      plan.write.payload,
      buildStoryReactionNotificationPayload({
        storyId: "story-1",
        slideId: "slide-1",
        reactorId: "viewer-1",
        emoji: "🔥",
        conversationId: "conv-1",
        messageId: "msg-1",
      })
    );

    const creates: unknown[] = [];
    const refreshes: unknown[] = [];
    const result = await applyStoryReactionNotificationWrite(plan, {
      create: async (write) => {
        creates.push(write);
        return "notif-1";
      },
      refresh: async (write) => {
        refreshes.push(write);
        return write.dedupeKey;
      },
    });
    assert.equal(result.action, "created");
    assert.equal(result.notificationId, "notif-1");
    assert.equal(creates.length, 1);
    assert.equal(refreshes.length, 0);
    assert.equal((creates[0] as { payload: { reactor_id: string } }).payload.reactor_id, "viewer-1");
  });

  it("does not create a second notification when the same emoji is repeated", async () => {
    const plan = planStoryReactionOwnerNotification({
      ownerId: "owner-1",
      actorId: "viewer-1",
      storyId: "story-1",
      emoji: "🔥",
      previousEmoji: "🔥",
      conversationId: "conv-1",
      messageId: "msg-1",
    });
    assert.equal(plan.action, "reuse");
    assert.equal(plan.write.dedupeKey, storyReactionNotificationDedupeKey("story-1", "viewer-1"));

    let createCalls = 0;
    let refreshCalls = 0;
    const first = await applyStoryReactionNotificationWrite(plan, {
      create: async () => {
        createCalls += 1;
        return "notif-1";
      },
      refresh: async () => {
        refreshCalls += 1;
        return "notif-1";
      },
    });
    const second = await applyStoryReactionNotificationWrite(plan, {
      create: async () => {
        createCalls += 1;
        return null;
      },
      refresh: async () => {
        refreshCalls += 1;
        return "notif-1";
      },
    });
    assert.equal(first.action, "created");
    assert.equal(second.action, "reused");
    assert.equal(createCalls, 2);
    assert.equal(refreshCalls, 0);
    assert.equal(first.notificationId, "notif-1");
    assert.equal(second.notificationId, null);
  });

  it("updates the existing notification when the emoji changes", async () => {
    const plan = planStoryReactionOwnerNotification({
      ownerId: "owner-1",
      actorId: "viewer-1",
      storyId: "story-1",
      slideId: "slide-1",
      emoji: "😂",
      previousEmoji: "🔥",
      conversationId: "conv-1",
      messageId: "msg-existing",
    });
    assert.equal(plan.action, "update");
    assert.equal(plan.write.dedupeKey, storyReactionNotificationDedupeKey("story-1", "viewer-1"));
    assert.equal(plan.write.payload.reaction, "😂");
    assert.equal(plan.write.payload.story_item_id, "slide-1");

    const payloads: unknown[] = [];
    const result = await applyStoryReactionNotificationWrite(plan, {
      create: async () => null,
      refresh: async (write) => {
        payloads.push(write.payload);
        return "notif-1";
      },
    });
    assert.equal(result.action, "updated");
    assert.equal(result.notificationId, "notif-1");
    assert.equal((payloads[0] as { reaction: string }).reaction, "😂");
  });

  it("notifies the owner after a successful reaction delivery", async () => {
    const notifies: unknown[] = [];
    const ports: StoryReactionDeliveryPorts = {
      getExistingReaction: async () => null,
      upsertReaction: async (row) => ({ reaction: row.reaction }),
      getOrCreateConversation: async () => "conv-1",
      findExistingMessage: async () => null,
      updateExistingMessage: async () => {
        throw new Error("update should not run on the first tap");
      },
      sendMessage: async (input) => ({ id: "msg-1", conversation_id: input.conversationId }),
      notifyOwner: async (input) => {
        notifies.push(input);
        return { action: "created", notificationId: "notif-1" };
      },
      log: () => undefined,
    };

    const result = await executeStoryReactionDelivery(
      {
        requestId: 9,
        viewerId: "viewer-1",
        storyOwnerId: "owner-1",
        storyId: "story-1",
        slideId: "slide-1",
        emoji: "🔥",
      },
      ports
    );
    assert.equal(result.notifyAction, "created");
    assert.equal(result.notificationId, "notif-1");
    assert.equal(notifies.length, 1);
    assert.deepEqual(notifies[0], {
      ownerId: "owner-1",
      actorId: "viewer-1",
      storyId: "story-1",
      slideId: "slide-1",
      emoji: "🔥",
      previousEmoji: null,
      conversationId: "conv-1",
      messageId: "msg-1",
      messageAction: "inserted",
    });
  });

  it("keeps one notification key when delivery updates an existing reaction DM", async () => {
    const notifies: Array<{ emoji: string; previousEmoji: string | null }> = [];
    const ports: StoryReactionDeliveryPorts = {
      getExistingReaction: async () => "🔥",
      upsertReaction: async (row) => ({ reaction: row.reaction }),
      getOrCreateConversation: async () => "conv-1",
      findExistingMessage: async () => ({
        id: "msg-existing",
        conversation_id: "conv-1",
        content: "Reacted 🔥 to your story",
        media_url: null,
        story_reply_id: "story-1",
      }),
      updateExistingMessage: async (input) => ({ id: input.id, conversation_id: "conv-1" }),
      sendMessage: async () => {
        throw new Error("should update, not insert");
      },
      notifyOwner: async (input) => {
        notifies.push({ emoji: input.emoji, previousEmoji: input.previousEmoji });
        return { action: "updated", notificationId: "notif-1" };
      },
      log: () => undefined,
    };

    const result = await executeStoryReactionDelivery(
      {
        requestId: 10,
        viewerId: "viewer-1",
        storyOwnerId: "owner-1",
        storyId: "story-1",
        emoji: "😂",
      },
      ports
    );
    assert.equal(result.messageAction, "updated");
    assert.equal(result.notifyAction, "updated");
    assert.equal(notifies.length, 1);
    assert.equal(notifies[0]?.emoji, "😂");
    assert.equal(notifies[0]?.previousEmoji, "🔥");
    assert.equal(
      storyReactionNotificationDedupeKey("story-1", "viewer-1"),
      storyReactionNotificationDedupeKey("story-1", "viewer-1")
    );
  });

  it("changes the rendered Notifications Center copy when the emoji changes", () => {
    const original = applyRenderedStoryReactionEmoji(
      {
        id: "notif-1",
        user_id: "owner-1",
        type: "story_reaction",
        payload: {
          story_id: "story-1",
          reactor_id: "viewer-1",
          reaction: "🔥",
        },
        read_at: null,
        created_at: "2026-09-22T00:00:00.000Z",
        actor_id: "viewer-1",
      },
      "🔥",
      "Founder"
    );
    const originalDisplay = buildNotificationDisplay(original, "Founder");
    assert.equal(originalDisplay.headline, "Story reaction");
    assert.equal(originalDisplay.detail, "Founder reacted 🔥 to your Story.");

    const updated = applyRenderedStoryReactionEmoji(original, "❤️", "Founder");
    const updatedDisplay = buildNotificationDisplay(updated, "Founder");
    assert.equal(updated.payload.reaction, "❤️");
    assert.equal(updated.title, "Story reaction");
    assert.equal(updated.body, "Founder reacted ❤️ to your Story.");
    assert.equal(updatedDisplay.detail, "Founder reacted ❤️ to your Story.");
    assert.equal(updatedDisplay.detail.includes("🔥"), false);

    const overlaid = overlayStoryReactionNotifications(
      [original],
      [{ story_id: "story-1", user_id: "viewer-1", reaction: "❤️" }]
    );
    assert.equal(overlaid.length, 1);
    assert.equal(overlaid[0]?.payload.reaction, "❤️");
    assert.equal(
      buildNotificationDisplay(overlaid[0]!, "Founder").detail,
      "Founder reacted ❤️ to your Story."
    );
  });

  it("reads the mounted Notifications Center select(*) payload keys", () => {
    const row = mountedNotificationsCenterRow();
    const refs = extractMountedStoryReactionRefs(row);
    assert.equal(refs.storyId, "story-1");
    assert.equal(refs.storyItemId, "slide-1");
    assert.equal(refs.actorId, "viewer-1");
    assert.equal(refs.storedReaction, "🔥");
    assert.equal(refs.conversationId, "conv-1");
    assert.equal(refs.messageId, "msg-1");
    assert.equal(refs.dedupeKey, "story_reaction:story-1:viewer-1");
    assert.deepEqual(refs.payloadKeys, [
      "conversation_id",
      "message_id",
      "reaction",
      "reactor_id",
      "story_id",
      "story_item_id",
    ]);
  });

  it("maps camelCase and emoji aliases from the same mounted payload shape", () => {
    const row = mountedNotificationsCenterRow(
      { actor_id: null, dedupe_key: null },
      {
        story_id: undefined,
        story_item_id: undefined,
        reactor_id: undefined,
        reaction: undefined,
        conversation_id: undefined,
        message_id: undefined,
        storyId: "story-alias",
        slideId: "slide-alias",
        viewer_id: "viewer-alias",
        emoji: "😂",
        conversationId: "conv-alias",
        messageId: "msg-alias",
      }
    );
    const refs = extractMountedStoryReactionRefs(row);
    assert.equal(refs.storyId, "story-alias");
    assert.equal(refs.storyItemId, "slide-alias");
    assert.equal(refs.actorId, "viewer-alias");
    assert.equal(refs.storedReaction, "😂");
    assert.equal(refs.conversationId, "conv-alias");
    assert.equal(refs.messageId, "msg-alias");
    assert.equal(refs.computedDedupeKey, "story_reaction:story-alias:viewer-alias");
  });

  it("renders the owner Notifications Center from the readable reaction DM, not the stale payload", () => {
    const stored = mountedNotificationsCenterRow();
    const storedDisplay = buildNotificationDisplay(stored, stored.actor?.display_name ?? "Someone");
    assert.equal(storedDisplay.detail, "Founder reacted 🔥 to your Story.");

    const resolved = applyMountedStoryReactionFromReadableSource({
      notification: stored,
      dmRow: {
        id: "msg-1",
        conversation_id: "conv-1",
        sender_id: "viewer-1",
        content: "Reacted ❤️ to your story",
        story_reply_id: "story-1",
      },
    });

    const mountedDisplay = buildNotificationDisplay(
      resolved,
      resolved.actor?.display_name ?? "Someone"
    );
    assert.equal(resolved.id, stored.id);
    assert.equal(resolved.payload.reaction, "❤️");
    assert.equal(mountedDisplay.detail, "Founder reacted ❤️ to your Story.");
    assert.equal(mountedDisplay.detail.includes("🔥"), false);
  });

  it("keeps one notification when the readable DM supplies the updated emoji", () => {
    const stored = mountedNotificationsCenterRow();
    const resolved = applyMountedStoryReactionFromReadableSource({
      notification: stored,
      dmRow: {
        id: "msg-1",
        conversation_id: "conv-1",
        sender_id: "viewer-1",
        content: "Reacted ❤️ to your story",
        story_reply_id: "story-1",
      },
    });

    assert.equal(resolved.id, stored.id);
    assert.equal(
      buildNotificationDisplay(resolved, "Founder").detail,
      "Founder reacted ❤️ to your Story."
    );
  });

  it("keeps the stored emoji when the readable DM lookup returns no row", () => {
    const stored = mountedNotificationsCenterRow();
    const resolved = applyMountedStoryReactionFromReadableSource({
      notification: stored,
    });
    assert.equal(resolved.payload.reaction, "🔥");
    assert.equal(
      buildNotificationDisplay(resolved, "Founder").detail,
      "Founder reacted 🔥 to your Story."
    );
  });
});
