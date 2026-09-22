import {
  canonicalizeStoryReaction,
  formatStoryReactionMessageContent,
  type StoryQuickReactionEmoji,
} from "@frennix/types";

export const REACTION_DELIVER_ERROR = "Reaction couldn’t be delivered. Try again.";
export const REACTION_SAVE_ERROR = "Reaction couldn’t be saved. Try again.";
export const REACTION_CONVERSATION_ERROR =
  "Reaction couldn’t be delivered. Couldn’t open the conversation.";
export const REACTION_MESSAGE_ERROR =
  "Reaction saved, but the message couldn’t be sent. Try again.";

export type StoryReactionDeliveryInput = {
  requestId: number;
  viewerId: string;
  storyOwnerId: string;
  storyId: string;
  slideId?: string | null;
  emoji: string;
};

export type StoryReactionWrite = {
  story_id: string;
  user_id: string;
  slide_id: string | null;
  reaction: StoryQuickReactionEmoji;
};

export type StoryReactionMessageWrite = {
  conversationId: string;
  senderId: string;
  content: string;
  mediaUrl: string | null;
  postId: null;
  replyToMessageId: null;
  storyReplyId: string | null;
};

export type StoryReactionExistingMessage = {
  id: string;
  conversation_id?: string;
  content: string;
  media_url: string | null;
  story_reply_id: string | null;
};

export type StoryReactionDeliveredMessage = {
  id: string;
  conversation_id: string;
};

export type StoryReactionDeliveryPorts = {
  getExistingReaction: (viewerId: string, storyId: string) => Promise<string | null>;
  upsertReaction: (row: StoryReactionWrite) => Promise<{ reaction: string }>;
  getOrCreateConversation: (viewerId: string, ownerId: string) => Promise<string>;
  findExistingMessage: (
    conversationId: string,
    viewerId: string,
    storyId: string
  ) => Promise<StoryReactionExistingMessage | null>;
  updateExistingMessage: (input: {
    id: string;
    senderId: string;
    content: string;
    mediaUrl: string | null;
    storyReplyId: string;
  }) => Promise<StoryReactionDeliveredMessage>;
  sendMessage: (input: StoryReactionMessageWrite) => Promise<StoryReactionDeliveredMessage>;
  getPreviewUrl?: (storyId: string, slideId?: string | null) => Promise<string | null>;
  isStoryLinkWriteError?: (error: unknown) => boolean;
  log: (event: string, extra: Record<string, unknown>) => void;
};

export type StoryReactionDeliveryResult = {
  requestId: number;
  emoji: StoryQuickReactionEmoji;
  conversationId: string;
  messageId: string;
  upserted: boolean;
  messageAction: "reused" | "updated" | "inserted";
};

function reactionWriteError(step: "save" | "conversation" | "message", error: unknown) {
  const fallback =
    step === "save"
      ? REACTION_SAVE_ERROR
      : step === "conversation"
        ? REACTION_CONVERSATION_ERROR
        : REACTION_MESSAGE_ERROR;
  if (error instanceof Error && error.message && error.message !== fallback) {
    return error;
  }
  return new Error(fallback);
}

/** Same fields the working story-reply path passes to sendMessage. */
export function storyReplyCompatibleMessageWrite(input: {
  conversationId: string;
  senderId: string;
  content: string;
  mediaUrl?: string | null;
  storyReplyId?: string | null;
}): StoryReactionMessageWrite {
  return {
    conversationId: input.conversationId,
    senderId: input.senderId,
    content: input.content,
    mediaUrl: input.mediaUrl ?? null,
    postId: null,
    replyToMessageId: null,
    storyReplyId: input.storyReplyId ?? null,
  };
}

export async function executeStoryReactionDelivery(
  input: StoryReactionDeliveryInput,
  ports: StoryReactionDeliveryPorts
): Promise<StoryReactionDeliveryResult> {
  const canonical = canonicalizeStoryReaction(input.emoji);
  if (!canonical) {
    ports.log("unsupported-emoji", {
      requestId: input.requestId,
      storyId: input.storyId,
    });
    throw new Error(REACTION_DELIVER_ERROR);
  }

  const emoji = canonical.emoji;
  const requestId = input.requestId;

  ports.log("handler-invoked", {
    requestId,
    storyId: input.storyId,
    viewerId: input.viewerId,
    storyOwnerId: input.storyOwnerId,
    slideId: input.slideId ?? null,
    emoji,
  });

  if (!input.storyId || !input.viewerId || !input.storyOwnerId) {
    throw new Error(REACTION_DELIVER_ERROR);
  }
  if (input.viewerId === input.storyOwnerId) {
    throw new Error("You cannot react to your own story");
  }

  const existing = canonicalizeStoryReaction(
    await ports.getExistingReaction(input.viewerId, input.storyId)
  );
  let upserted = false;
  if (existing?.emoji !== emoji) {
    ports.log("reaction-upsert-started", {
      requestId,
      storyId: input.storyId,
      emoji,
    });
    let saved: { reaction: string };
    try {
      saved = await ports.upsertReaction({
        story_id: input.storyId,
        user_id: input.viewerId,
        slide_id: input.slideId ?? null,
        reaction: emoji,
      });
    } catch (error) {
      ports.log("reaction-upsert-failed", {
        requestId,
        storyId: input.storyId,
        emoji,
        error: error instanceof Error ? error.message : String(error),
      });
      throw reactionWriteError("save", error);
    }
    const written = canonicalizeStoryReaction(saved.reaction)?.emoji;
    if (written !== emoji) {
      ports.log("reaction-upsert-mismatch", {
        requestId,
        storyId: input.storyId,
        emoji,
        written: saved.reaction,
      });
      throw new Error(REACTION_SAVE_ERROR);
    }
    upserted = true;
  }
  ports.log("reaction-upserted", {
    requestId,
    storyId: input.storyId,
    emoji,
    upserted,
  });

  let conversationId: string;
  try {
    conversationId = await ports.getOrCreateConversation(input.viewerId, input.storyOwnerId);
  } catch (error) {
    ports.log("conversation-failed", {
      requestId,
      storyId: input.storyId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw reactionWriteError("conversation", error);
  }
  ports.log("conversation-ready", {
    requestId,
    storyId: input.storyId,
    conversationId,
  });

  const content = formatStoryReactionMessageContent(emoji);
  const previewUrl = (await ports.getPreviewUrl?.(input.storyId, input.slideId)) ?? null;
  let existingMessage: StoryReactionExistingMessage | null = null;
  try {
    existingMessage = await ports.findExistingMessage(
      conversationId,
      input.viewerId,
      input.storyId
    );
  } catch (error) {
    ports.log("message-lookup-failed", {
      requestId,
      conversationId,
      storyId: input.storyId,
      error: error instanceof Error ? error.message : String(error),
    });
    existingMessage = null;
  }

  const sendLikeReply = async (storyReplyId: string | null) =>
    ports.sendMessage(
      storyReplyCompatibleMessageWrite({
        conversationId,
        senderId: input.viewerId,
        content,
        mediaUrl: previewUrl,
        storyReplyId,
      })
    );

  let message: StoryReactionDeliveredMessage;
  let messageAction: StoryReactionDeliveryResult["messageAction"] = "inserted";

  if (existingMessage) {
    const sameEmoji = existingMessage.content === content;
    const samePreview =
      (existingMessage.media_url ?? null) === (previewUrl ?? existingMessage.media_url ?? null);
    const sameStoryLink = existingMessage.story_reply_id === input.storyId;
    if (sameEmoji && samePreview && sameStoryLink) {
      message = {
        id: existingMessage.id,
        conversation_id: existingMessage.conversation_id ?? conversationId,
      };
      messageAction = "reused";
      ports.log("message-reused", {
        requestId,
        conversationId,
        messageId: message.id,
        emoji,
      });
    } else {
      try {
        message = await ports.updateExistingMessage({
          id: existingMessage.id,
          senderId: input.viewerId,
          content,
          mediaUrl: previewUrl ?? existingMessage.media_url ?? null,
          storyReplyId: input.storyId,
        });
        messageAction = "updated";
        ports.log("message-updated", {
          requestId,
          conversationId,
          messageId: message.id,
          emoji,
        });
      } catch (error) {
        ports.log("message-update-failed-fallback-insert", {
          requestId,
          conversationId,
          messageId: existingMessage.id,
          error: error instanceof Error ? error.message : String(error),
        });
        try {
          message = await sendLikeReply(input.storyId);
        } catch (insertError) {
          if (ports.isStoryLinkWriteError?.(insertError)) {
            message = await sendLikeReply(null);
          } else {
            ports.log("message-insert-failed", {
              requestId,
              conversationId,
              error: insertError instanceof Error ? insertError.message : String(insertError),
            });
            throw reactionWriteError("message", insertError);
          }
        }
        messageAction = "inserted";
        ports.log("message-inserted", {
          requestId,
          conversationId,
          messageId: message.id,
          emoji,
        });
      }
    }
  } else {
    try {
      message = await sendLikeReply(input.storyId);
    } catch (error) {
      if (ports.isStoryLinkWriteError?.(error)) {
        ports.log("message-retry-without-story-link", {
          requestId,
          conversationId,
          storyId: input.storyId,
        });
        try {
          message = await sendLikeReply(null);
        } catch (retryError) {
          ports.log("message-insert-failed", {
            requestId,
            conversationId,
            error: retryError instanceof Error ? retryError.message : String(retryError),
          });
          throw reactionWriteError("message", retryError);
        }
      } else {
        ports.log("message-insert-failed", {
          requestId,
          conversationId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw reactionWriteError("message", error);
      }
    }
    ports.log("message-inserted", {
      requestId,
      conversationId,
      messageId: message.id,
      emoji,
    });
  }

  ports.log("delivered", {
    requestId,
    storyId: input.storyId,
    conversationId,
    messageId: message.id,
    emoji,
    upserted,
    messageAction,
  });

  return {
    requestId,
    emoji,
    conversationId: message.conversation_id,
    messageId: message.id,
    upserted,
    messageAction,
  };
}
