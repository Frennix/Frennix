import type { Conversation, Message, Profile } from "@frennix/types";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { enrichMessagesWithReactions } from "./reactions";
import { formatSupabaseError } from "./profile-utils";
import { getBlockedIds } from "./moderation";
import { getSupabase } from "./supabase";
import { publishPlatformActivity } from "./platform-activity-engine";
import {
  subscribePostgresChanges,
  type RealtimeSubscription,
} from "./realtime-utils";

const typingChannels = new Map<string, RealtimeChannel>();
const MAX_PINNED_CONVERSATIONS = 3;
export const MAX_FAVORITE_TRAINING_PARTNERS = 5;
export const DELETED_FOR_EVERYONE_CONTENT = "Message deleted";

type ConversationPreferencesRow = {
  conversation_id: string;
  pinned_at: string | null;
  favorited_at: string | null;
  muted_at: string | null;
  marked_unread_at: string | null;
};

function formatMessagingError(error: unknown, context: string): Error {
  return formatSupabaseError(error, context);
}

async function getDeletedMessageIds(userId: string, messageIds: string[]): Promise<Set<string>> {
  if (!messageIds.length) return new Set();

  const { data, error } = await getSupabase()
    .from("message_user_deletions")
    .select("message_id")
    .eq("user_id", userId)
    .in("message_id", messageIds);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.message_id as string));
}

async function getHiddenConversationAt(
  userId: string,
  conversationIds: string[]
): Promise<Map<string, string>> {
  if (!conversationIds.length) return new Map();

  const { data, error } = await getSupabase()
    .from("conversation_user_hides")
    .select("conversation_id, hidden_at")
    .eq("user_id", userId)
    .in("conversation_id", conversationIds);

  if (error) throw error;

  return new Map(
    (data ?? []).map((row) => [
      row.conversation_id as string,
      row.hidden_at as string,
    ])
  );
}

function isConversationSuppressedFromInbox(
  suppressedAt: string | undefined,
  lastMessageAt: string | undefined,
  conversationUpdatedAt: string
): boolean {
  if (!suppressedAt) return false;
  const activityAt = lastMessageAt ?? conversationUpdatedAt;
  return new Date(activityAt).getTime() <= new Date(suppressedAt).getTime();
}

async function getDeletedConversationAt(
  userId: string,
  conversationIds: string[]
): Promise<Map<string, string>> {
  if (!conversationIds.length) return new Map();

  const { data, error } = await getSupabase()
    .from("conversation_user_deletions")
    .select("conversation_id, deleted_at")
    .eq("user_id", userId)
    .in("conversation_id", conversationIds);

  if (error) throw error;

  return new Map(
    (data ?? []).map((row) => [
      row.conversation_id as string,
      row.deleted_at as string,
    ])
  );
}

function maskDeletedForEveryoneMessage(message: Message): Message {
  if (!message.deleted_for_everyone_at) return message;
  return {
    ...message,
    content: DELETED_FOR_EVERYONE_CONTENT,
    media_url: null,
    post_id: null,
    shared_post: undefined,
  };
}

async function getConversationPreferencesMap(
  userId: string,
  conversationIds: string[]
): Promise<Map<string, ConversationPreferencesRow>> {
  if (!conversationIds.length) return new Map();

  const { data, error } = await getSupabase()
    .from("conversation_user_preferences")
    .select("conversation_id, pinned_at, favorited_at, muted_at, marked_unread_at")
    .eq("user_id", userId)
    .in("conversation_id", conversationIds);

  if (error) throw error;

  return new Map(
    (data ?? []).map((row) => [
      row.conversation_id as string,
      row as ConversationPreferencesRow,
    ])
  );
}

async function clearConversationInboxState(conversationId: string, userId: string) {
  await Promise.all([
    getSupabase()
      .from("conversation_user_hides")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("user_id", userId),
    getSupabase()
      .from("conversation_user_deletions")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("user_id", userId),
  ]);
}

function conversationActivityAt(conversation: Conversation): number {
  return new Date(conversation.last_message?.created_at ?? conversation.updated_at).getTime();
}

async function getVisibleLastMessage(
  conversationId: string,
  userId: string
): Promise<Message | undefined> {
  const { data, error } = await getSupabase()
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) throw error;

  const messages = (data ?? []) as Message[];
  if (!messages.length) return undefined;

  const deletedIds = await getDeletedMessageIds(
    userId,
    messages.map((message) => message.id)
  );

  return messages
    .map(maskDeletedForEveryoneMessage)
    .find((message) => !deletedIds.has(message.id));
}

export async function getConversations(userId: string): Promise<Conversation[]> {
  const blockedIds = new Set(await getBlockedIds(userId));

  const { data: memberships, error } = await getSupabase()
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", userId);

  if (error) throw error;
  const convIds = (memberships ?? []).map((m) => m.conversation_id);
  if (!convIds.length) return [];

  const hiddenAtByConversation = await getHiddenConversationAt(userId, convIds);
  const deletedAtByConversation = await getDeletedConversationAt(userId, convIds);
  const preferencesByConversation = await getConversationPreferencesMap(userId, convIds);
  const conversations: Conversation[] = [];

  for (const convId of convIds) {
    const { data: conv } = await getSupabase()
      .from("conversations")
      .select("*")
      .eq("id", convId)
      .single();

    const lastMsg = await getVisibleLastMessage(convId, userId);

    const { data: members } = await getSupabase()
      .from("conversation_members")
      .select(`profile:profiles(*)`)
      .eq("conversation_id", convId)
      .neq("user_id", userId);

    const other = (members?.[0] as { profile: Profile } | undefined)?.profile;

    const { data: unreadMessages, error: unreadError } = await getSupabase()
      .from("messages")
      .select("id")
      .eq("conversation_id", convId)
      .neq("sender_id", userId)
      .is("read_at", null);

    if (unreadError) throw unreadError;

    const unreadIds = (unreadMessages ?? []).map((row) => row.id as string);
    const deletedUnreadIds = await getDeletedMessageIds(userId, unreadIds);
    let unreadCount = unreadIds.filter((id) => !deletedUnreadIds.has(id)).length;

    const conversation = conv as Conversation;
    const hiddenAt = hiddenAtByConversation.get(convId);
    const deletedAt = deletedAtByConversation.get(convId);
    if (
      isConversationSuppressedFromInbox(
        hiddenAt,
        lastMsg?.created_at,
        conversation.updated_at
      ) ||
      isConversationSuppressedFromInbox(
        deletedAt,
        lastMsg?.created_at,
        conversation.updated_at
      )
    ) {
      continue;
    }

    const prefs = preferencesByConversation.get(convId);
    const markedUnread = Boolean(prefs?.marked_unread_at);
    if (markedUnread && unreadCount === 0) {
      unreadCount = 1;
    }

    conversations.push({
      ...conversation,
      last_message: lastMsg,
      other_participant: other,
      unread_count: unreadCount,
      is_pinned: Boolean(prefs?.pinned_at),
      pinned_at: prefs?.pinned_at ?? null,
      is_favorite: Boolean(prefs?.favorited_at),
      favorited_at: prefs?.favorited_at ?? null,
      is_muted: Boolean(prefs?.muted_at),
      marked_unread: markedUnread,
    });
  }

  return conversations
    .filter((conv) => !conv.other_participant || !blockedIds.has(conv.other_participant.id))
    .sort((a, b) => {
      const aFavorite = a.is_favorite ? 1 : 0;
      const bFavorite = b.is_favorite ? 1 : 0;
      if (aFavorite !== bFavorite) return bFavorite - aFavorite;
      if (a.is_favorite && b.is_favorite && a.favorited_at && b.favorited_at) {
        const favoriteDelta =
          new Date(b.favorited_at).getTime() - new Date(a.favorited_at).getTime();
        if (favoriteDelta !== 0) return favoriteDelta;
      }

      const aPinned = a.is_pinned ? 1 : 0;
      const bPinned = b.is_pinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      if (a.is_pinned && b.is_pinned && a.pinned_at && b.pinned_at) {
        const pinDelta = new Date(b.pinned_at).getTime() - new Date(a.pinned_at).getTime();
        if (pinDelta !== 0) return pinDelta;
      }
      return conversationActivityAt(b) - conversationActivityAt(a);
    });
}

export async function getUnreadMessageCount(userId: string): Promise<number> {
  const conversations = await getConversations(userId);
  return conversations.reduce((total, conversation) => total + (conversation.unread_count ?? 0), 0);
}

export async function markMessagesAsRead(conversationId: string, userId: string) {
  const { error } = await getSupabase()
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", userId)
    .is("read_at", null);

  if (error) throw error;

  const { error: prefsError } = await getSupabase()
    .from("conversation_user_preferences")
    .upsert(
      {
        conversation_id: conversationId,
        user_id: userId,
        marked_unread_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "conversation_id,user_id" }
    );

  if (prefsError) throw prefsError;
}

export async function getOrCreateConversation(userId: string, otherUserId: string): Promise<string> {
  if (!userId || !otherUserId) {
    throw new Error("You must be signed in to start a conversation");
  }
  if (userId === otherUserId) {
    throw new Error("You cannot message yourself");
  }

  const blockedIds = await getBlockedIds(userId);
  if (blockedIds.includes(otherUserId)) {
    throw new Error("You cannot message this user");
  }

  const { data, error } = await getSupabase().rpc("create_or_get_dm_conversation", {
    user_a: userId,
    user_b: otherUserId,
  });

  if (error) {
    throw formatMessagingError(error, "Failed to create or find conversation");
  }

  if (!data) {
    throw new Error("Conversation could not be created");
  }

  await clearConversationInboxState(data as string, userId);
  return data as string;
}

export async function getConversationProfiles(
  conversationId: string
): Promise<Record<string, Profile>> {
  const { data, error } = await getSupabase()
    .from("conversation_members")
    .select(`user_id, profile:profiles(*)`)
    .eq("conversation_id", conversationId);

  if (error) throw error;

  const map: Record<string, Profile> = {};
  for (const row of data ?? []) {
    const entry = row as { user_id: string; profile: Profile | Profile[] | null };
    const profile = Array.isArray(entry.profile) ? entry.profile[0] : entry.profile;
    if (profile) map[entry.user_id] = profile;
  }
  return map;
}

export async function getMessages(conversationId: string, viewerId?: string): Promise<Message[]> {
  const { data, error } = await getSupabase()
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  let messages = (data ?? []) as Message[];

  if (viewerId) {
    const deletedIds = await getDeletedMessageIds(
      viewerId,
      messages.map((message) => message.id)
    );
    messages = messages
      .filter((message) => !deletedIds.has(message.id))
      .map(maskDeletedForEveryoneMessage);
  } else {
    messages = messages.map(maskDeletedForEveryoneMessage);
  }

  const postIds = messages.map((m) => m.post_id).filter((id): id is string => Boolean(id));

  if (postIds.length) {
    const { data: posts, error: postsError } = await getSupabase()
      .from("posts")
      .select(`*, author:profiles!posts_author_id_fkey(*)`)
      .in("id", [...new Set(postIds)]);

    if (postsError) throw postsError;

    const postById = new Map((posts ?? []).map((p) => [p.id, p as Message["shared_post"]]));
    messages = messages.map((m) => ({
      ...m,
      shared_post: m.post_id ? postById.get(m.post_id) : undefined,
    }));
  }

  const replyIds = messages
    .map((message) => message.reply_to_message_id)
    .filter((id): id is string => Boolean(id));

  if (replyIds.length) {
    const { data: replyRows, error: replyError } = await getSupabase()
      .from("messages")
      .select("id, content, sender_id, media_url, deleted_for_everyone_at")
      .in("id", [...new Set(replyIds)]);

    if (replyError) throw replyError;

    const replyById = new Map((replyRows ?? []).map((row) => [row.id as string, row]));
    messages = messages.map((message) => {
      const replyId = message.reply_to_message_id;
      if (!replyId) return message;
      const reply = replyById.get(replyId);
      if (!reply) return message;
      const replyDeletedForEveryone = Boolean(
        (reply as { deleted_for_everyone_at?: string | null }).deleted_for_everyone_at
      );
      return {
        ...message,
        reply_to: {
          id: reply.id as string,
          content: replyDeletedForEveryone
            ? DELETED_FOR_EVERYONE_CONTENT
            : (reply.content as string),
          sender_id: reply.sender_id as string,
          media_url: replyDeletedForEveryone
            ? null
            : ((reply.media_url as string | null) ?? null),
        },
      };
    });
  }

  if (!viewerId) return messages;
  return enrichMessagesWithReactions(messages, viewerId);
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  mediaUrl?: string | null,
  postId?: string | null,
  replyToMessageId?: string | null,
  storyReplyId?: string | null
) {
  const body =
    postId ? "Shared a post" : content.trim() || (mediaUrl ? "📷 Photo" : "");

  const { data, error } = await getSupabase()
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: body,
      media_url: mediaUrl ?? null,
      post_id: postId ?? null,
      reply_to_message_id: replyToMessageId ?? null,
      story_reply_id: storyReplyId ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  await publishPlatformActivity({
    userId: senderId,
    activityType: "message_sent",
    sourceType: "messages",
    sourceId: data.id as string,
    metadata: {
      conversation_id: conversationId,
      has_story_reply: Boolean(storyReplyId),
    },
  }).catch(() => undefined);

  if (storyReplyId) {
    await publishPlatformActivity({
      userId: senderId,
      activityType: "story_replied",
      sourceType: "messages",
      sourceId: data.id as string,
      metadata: { story_reply_id: storyReplyId },
    }).catch(() => undefined);
  }

  await clearConversationInboxState(conversationId, senderId);

  await getSupabase()
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return data as Message;
}

/** Hide a conversation from the current user's inbox (reappears on newer messages). */
export async function hideConversationForUser(conversationId: string, userId: string) {
  const { error } = await getSupabase().from("conversation_user_hides").upsert(
    {
      conversation_id: conversationId,
      user_id: userId,
      hidden_at: new Date().toISOString(),
    },
    { onConflict: "conversation_id,user_id" }
  );

  if (error) throw formatMessagingError(error, "Failed to hide conversation");
}

/** Permanently remove a conversation from the current user's inbox (delete for me). */
export async function deleteConversationForUser(conversationId: string, userId: string) {
  const { error } = await getSupabase().from("conversation_user_deletions").upsert(
    {
      conversation_id: conversationId,
      user_id: userId,
      deleted_at: new Date().toISOString(),
    },
    { onConflict: "conversation_id,user_id" }
  );

  if (error) throw formatMessagingError(error, "Failed to delete conversation");
}

/** Soft-delete multiple conversations for the current user. */
export async function deleteConversationsForUser(
  conversationIds: string[],
  userId: string
): Promise<void> {
  if (!conversationIds.length) return;

  const deletedAt = new Date().toISOString();
  const { error } = await getSupabase().from("conversation_user_deletions").upsert(
    conversationIds.map((conversationId) => ({
      conversation_id: conversationId,
      user_id: userId,
      deleted_at: deletedAt,
    })),
    { onConflict: "conversation_id,user_id" }
  );

  if (error) throw formatMessagingError(error, "Failed to delete conversations");
}

/** Archive (hide) a conversation from the current user's inbox. */
export async function archiveConversationForUser(conversationId: string, userId: string) {
  return hideConversationForUser(conversationId, userId);
}

/** Archive multiple conversations for the current user. */
export async function archiveConversationsForUser(
  conversationIds: string[],
  userId: string
): Promise<void> {
  if (!conversationIds.length) return;

  const hiddenAt = new Date().toISOString();
  const { error } = await getSupabase().from("conversation_user_hides").upsert(
    conversationIds.map((conversationId) => ({
      conversation_id: conversationId,
      user_id: userId,
      hidden_at: hiddenAt,
    })),
    { onConflict: "conversation_id,user_id" }
  );

  if (error) throw formatMessagingError(error, "Failed to archive conversations");
}

/** Mark all messages in a conversation read for the current user. */
export async function markConversationReadForUser(conversationId: string, userId: string) {
  await markMessagesAsRead(conversationId, userId);
}

/** Mark multiple conversations read for the current user. */
export async function markConversationsReadForUser(
  conversationIds: string[],
  userId: string
): Promise<void> {
  if (!conversationIds.length) return;
  await Promise.all(
    conversationIds.map((conversationId) => markMessagesAsRead(conversationId, userId))
  );
}

/** Mark multiple conversations unread for the current user. */
export async function markConversationsUnreadForUser(
  conversationIds: string[],
  userId: string
): Promise<void> {
  if (!conversationIds.length) return;

  const markedAt = new Date().toISOString();
  const { error } = await getSupabase().from("conversation_user_preferences").upsert(
    conversationIds.map((conversationId) => ({
      conversation_id: conversationId,
      user_id: userId,
      marked_unread_at: markedAt,
      updated_at: markedAt,
    })),
    { onConflict: "conversation_id,user_id" }
  );

  if (error) throw formatMessagingError(error, "Failed to mark conversations unread");
}

/** Pin a training partner conversation (max 3). */
export async function pinConversationForUser(conversationId: string, userId: string) {
  const { count, error: countError } = await getSupabase()
    .from("conversation_user_preferences")
    .select("conversation_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("pinned_at", "is", null);

  if (countError) throw countError;
  if ((count ?? 0) >= MAX_PINNED_CONVERSATIONS) {
    throw new Error(`You can pin up to ${MAX_PINNED_CONVERSATIONS} conversations`);
  }

  const { error } = await getSupabase().from("conversation_user_preferences").upsert(
    {
      conversation_id: conversationId,
      user_id: userId,
      pinned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "conversation_id,user_id" }
  );

  if (error) throw formatMessagingError(error, "Failed to pin conversation");
}

export async function unpinConversationForUser(conversationId: string, userId: string) {
  const { error } = await getSupabase().from("conversation_user_preferences").upsert(
    {
      conversation_id: conversationId,
      user_id: userId,
      pinned_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "conversation_id,user_id" }
  );

  if (error) throw formatMessagingError(error, "Failed to unpin conversation");
}

/** Favorite a training partner (max 5) — separate from pinned conversations. */
export async function favoriteConversationForUser(conversationId: string, userId: string) {
  const { count, error: countError } = await getSupabase()
    .from("conversation_user_preferences")
    .select("conversation_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("favorited_at", "is", null);

  if (countError) throw countError;
  if ((count ?? 0) >= MAX_FAVORITE_TRAINING_PARTNERS) {
    throw new Error(
      `You can favorite up to ${MAX_FAVORITE_TRAINING_PARTNERS} training partners`
    );
  }

  const { error } = await getSupabase().from("conversation_user_preferences").upsert(
    {
      conversation_id: conversationId,
      user_id: userId,
      favorited_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "conversation_id,user_id" }
  );

  if (error) throw formatMessagingError(error, "Failed to favorite training partner");

  await publishPlatformActivity({
    userId,
    activityType: "training_partner_favorited",
    sourceType: "conversations",
    sourceId: conversationId,
  }).catch(() => undefined);
}

export async function unfavoriteConversationForUser(conversationId: string, userId: string) {
  const { error } = await getSupabase().from("conversation_user_preferences").upsert(
    {
      conversation_id: conversationId,
      user_id: userId,
      favorited_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "conversation_id,user_id" }
  );

  if (error) throw formatMessagingError(error, "Failed to unfavorite training partner");
}

export async function muteConversationForUser(conversationId: string, userId: string) {
  const { error } = await getSupabase().from("conversation_user_preferences").upsert(
    {
      conversation_id: conversationId,
      user_id: userId,
      muted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "conversation_id,user_id" }
  );

  if (error) throw formatMessagingError(error, "Failed to mute conversation");
}

export async function unmuteConversationForUser(conversationId: string, userId: string) {
  const { error } = await getSupabase().from("conversation_user_preferences").upsert(
    {
      conversation_id: conversationId,
      user_id: userId,
      muted_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "conversation_id,user_id" }
  );

  if (error) throw formatMessagingError(error, "Failed to unmute conversation");
}

export async function markConversationUnreadForUser(conversationId: string, userId: string) {
  const { error } = await getSupabase().from("conversation_user_preferences").upsert(
    {
      conversation_id: conversationId,
      user_id: userId,
      marked_unread_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "conversation_id,user_id" }
  );

  if (error) throw formatMessagingError(error, "Failed to mark conversation unread");
}

/** Soft-delete a message for the current user only (delete for me). */
export async function deleteMessageForUser(messageId: string, userId: string) {
  const { error } = await getSupabase().from("message_user_deletions").upsert(
    {
      message_id: messageId,
      user_id: userId,
      deleted_at: new Date().toISOString(),
    },
    { onConflict: "message_id,user_id" }
  );

  if (error) throw formatMessagingError(error, "Failed to delete message");
}

/** Retract a sent message for all conversation members (delete for everyone). */
export async function deleteMessageForEveryone(messageId: string, userId: string) {
  const { data: message, error: fetchError } = await getSupabase()
    .from("messages")
    .select("id, sender_id, deleted_for_everyone_at")
    .eq("id", messageId)
    .single();

  if (fetchError) throw formatMessagingError(fetchError, "Failed to delete message");
  if ((message?.sender_id as string) !== userId) {
    throw new Error("You can only delete your own messages for everyone");
  }
  if (message?.deleted_for_everyone_at) return;

  const { error } = await getSupabase()
    .from("messages")
    .update({ deleted_for_everyone_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("sender_id", userId);

  if (error) throw formatMessagingError(error, "Failed to delete message for everyone");
}

export async function uploadMessageMedia(userId: string, uri: string, mimeType: string) {
  const ext = mimeType.split("/")[1] ?? "jpg";
  const fileName = `${userId}/${Date.now()}.${ext}`;
  const response = await fetch(uri);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();

  const { error } = await getSupabase().storage
    .from("messages")
    .upload(fileName, arrayBuffer, { contentType: mimeType });

  if (error) throw error;
  const { data } = getSupabase().storage.from("messages").getPublicUrl(fileName);
  return data.publicUrl;
}

export type MessagesRealtimeSubscription = RealtimeSubscription & {
  ok: boolean;
};

export function subscribeToMessages(
  conversationId: string,
  onMessage: (message: Message) => void
): MessagesRealtimeSubscription {
  const subscription = subscribePostgresChanges(
    "messages",
    conversationId,
    [
      {
        config: {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        callback: (payload) => onMessage((payload as { new: Message }).new),
      },
    ]
  );

  return {
    ...subscription,
    ok: subscription.channel != null,
  };
}

export function subscribeToTyping(
  conversationId: string,
  currentUserId: string,
  onTyping: (typingUserId: string) => void
): RealtimeChannel | null {
  try {
    const topic = `typing:${conversationId}`;
    const supabase = getSupabase();
    const existing = supabase
      .getChannels()
      .find((channel) => channel.topic === `realtime:${topic}`);

    if (existing) {
      void supabase.removeChannel(existing);
      if (typingChannels.get(conversationId) === existing) {
        typingChannels.delete(conversationId);
      }
    }

    const channel = supabase
      .channel(topic)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const typingUserId = (payload as { userId?: string }).userId;
        if (typingUserId && typingUserId !== currentUserId) {
          onTyping(typingUserId);
        }
      })
      .subscribe();

    return channel;
  } catch (error) {
    console.warn("[messaging] typing subscription failed", error);
    return null;
  }
}

export async function broadcastTyping(conversationId: string, userId: string) {
  let channel = typingChannels.get(conversationId);
  if (!channel) {
    channel = getSupabase().channel(`typing:${conversationId}`);
    typingChannels.set(conversationId, channel);
    await channel.subscribe();
  }

  await channel.send({
    type: "broadcast",
    event: "typing",
    payload: { userId },
  });
}

export function teardownTypingChannel(
  conversationId: string,
  channel: RealtimeChannel | null | undefined
): void {
  if (channel) {
    try {
      channel.unsubscribe();
    } catch (error) {
      console.warn("[messaging] typing unsubscribe failed", error);
    }
    void getSupabase().removeChannel(channel);
  }
  if (typingChannels.get(conversationId) === channel) {
    typingChannels.delete(conversationId);
  }
}

/** Clears module-level typing caches on sign-out (component effects also teardown channels). */
export function resetMessagingRealtimeState(): void {
  typingChannels.clear();
}
