import type { Conversation, Message, Profile } from "@frennix/types";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { enrichMessagesWithReactions } from "./reactions";
import { formatSupabaseError } from "./profile-utils";
import { getBlockedIds } from "./moderation";
import { getSupabase } from "./supabase";

const typingChannels = new Map<string, RealtimeChannel>();

function formatMessagingError(error: unknown, context: string): Error {
  return formatSupabaseError(error, context);
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

  const conversations: Conversation[] = [];

  for (const convId of convIds) {
    const { data: conv } = await getSupabase()
      .from("conversations")
      .select("*")
      .eq("id", convId)
      .single();

    const { data: lastMsg } = await getSupabase()
      .from("messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: members } = await getSupabase()
      .from("conversation_members")
      .select(`profile:profiles(*)`)
      .eq("conversation_id", convId)
      .neq("user_id", userId);

    const other = (members?.[0] as { profile: Profile } | undefined)?.profile;

    const { count: unreadCount } = await getSupabase()
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("conversation_id", convId)
      .neq("sender_id", userId)
      .is("read_at", null);

    conversations.push({
      ...(conv as Conversation),
      last_message: lastMsg as Message | undefined,
      other_participant: other,
      unread_count: unreadCount ?? 0,
    });
  }

  return conversations
    .filter((conv) => !conv.other_participant || !blockedIds.has(conv.other_participant.id))
    .sort(
      (a, b) =>
        new Date(b.last_message?.created_at ?? b.updated_at).getTime() -
        new Date(a.last_message?.created_at ?? a.updated_at).getTime()
    );
}

export async function getUnreadMessageCount(userId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from("messages")
    .select("*", { count: "exact", head: true })
    .neq("sender_id", userId)
    .is("read_at", null);

  if (error) throw error;
  return count ?? 0;
}

export async function markMessagesAsRead(conversationId: string, userId: string) {
  const { error } = await getSupabase()
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", userId)
    .is("read_at", null);

  if (error) throw error;
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

  if (!viewerId) return messages;
  return enrichMessagesWithReactions(messages, viewerId);
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  mediaUrl?: string | null,
  postId?: string | null
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
    })
    .select()
    .single();
  if (error) throw error;

  await getSupabase()
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return data as Message;
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

export function subscribeToMessages(
  conversationId: string,
  onMessage: (message: Message) => void
) {
  return getSupabase()
    .channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onMessage(payload.new as Message)
    )
    .subscribe();
}

export function subscribeToTyping(
  conversationId: string,
  currentUserId: string,
  onTyping: (typingUserId: string) => void
) {
  return getSupabase()
    .channel(`typing:${conversationId}`)
    .on("broadcast", { event: "typing" }, ({ payload }) => {
      const typingUserId = (payload as { userId?: string }).userId;
      if (typingUserId && typingUserId !== currentUserId) {
        onTyping(typingUserId);
      }
    })
    .subscribe();
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
