import type {
  FriendRequestItem,
  FriendStatus,
  PaginatedProfilesResult,
  Profile,
  ProfileFavoriteItem,
  ProfileSocialContext,
} from "@frennix/types";
import { getSupabase } from "./supabase";

type PagePayload<T> = {
  items: T[];
  total: number;
  hasMore: boolean;
};

function parsePagePayload(raw: Record<string, unknown>): PagePayload<Profile> {
  return {
    items: (raw.items as Profile[]) ?? [],
    total: Number(raw.total ?? 0),
    hasMore: Boolean(raw.has_more),
  };
}

export async function sendFriendRequest(requesterId: string, recipientId: string) {
  const { data, error } = await getSupabase().rpc("send_friend_request", {
    p_requester_id: requesterId,
    p_recipient_id: recipientId,
  });
  if (error) throw error;
  return data as { status: string; friend_mode?: string };
}

export async function respondFriendRequest(
  recipientId: string,
  requesterId: string,
  accept: boolean
) {
  const { data, error } = await getSupabase().rpc("respond_friend_request", {
    p_recipient_id: recipientId,
    p_requester_id: requesterId,
    p_accept: accept,
  });
  if (error) throw error;
  return data as { status: string };
}

export async function cancelFriendRequest(requesterId: string, recipientId: string) {
  const { error } = await getSupabase().rpc("cancel_friend_request", {
    p_requester_id: requesterId,
    p_recipient_id: recipientId,
  });
  if (error) throw error;
}

export async function removeFriend(userId: string, friendId: string) {
  const { error } = await getSupabase().rpc("remove_friend", {
    p_user_id: userId,
    p_friend_id: friendId,
  });
  if (error) throw error;
}

export async function addFriendDirect(userId: string, friendId: string) {
  const { data, error } = await getSupabase().rpc("add_friend_direct", {
    p_user_id: userId,
    p_friend_id: friendId,
  });
  if (error) throw error;
  return data as { status: string };
}

export async function getFriendsPage(
  userId: string,
  options: { viewerId?: string; limit?: number; offset?: number } = {}
): Promise<PaginatedProfilesResult> {
  const { data, error } = await getSupabase().rpc("get_friends_page", {
    p_user_id: userId,
    p_viewer_id: options.viewerId ?? null,
    p_limit: options.limit ?? 30,
    p_offset: options.offset ?? 0,
  });
  if (error) throw error;
  return parsePagePayload((data ?? {}) as Record<string, unknown>);
}

export async function getFriendRequestsPage(
  userId: string,
  direction: "incoming" | "outgoing" = "incoming",
  options: { limit?: number; offset?: number } = {}
): Promise<{ items: FriendRequestItem[]; total: number; hasMore: boolean }> {
  const { data, error } = await getSupabase().rpc("get_friend_requests_page", {
    p_user_id: userId,
    p_direction: direction,
    p_limit: options.limit ?? 30,
    p_offset: options.offset ?? 0,
  });
  if (error) throw error;

  const payload = (data ?? {}) as Record<string, unknown>;
  const items = ((payload.items as Record<string, unknown>[]) ?? []).map((row) => ({
    id: String(row.id),
    status: String(row.status),
    createdAt: String(row.created_at),
    profile: row.profile as Profile,
  }));

  return {
    items,
    total: Number(payload.total ?? 0),
    hasMore: Boolean(payload.has_more),
  };
}

export async function getMutualFriendsPage(
  viewerId: string,
  targetId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<PaginatedProfilesResult> {
  const { data, error } = await getSupabase().rpc("get_mutual_friends_page", {
    p_viewer_id: viewerId,
    p_target_id: targetId,
    p_limit: options.limit ?? 30,
    p_offset: options.offset ?? 0,
  });
  if (error) throw error;
  return parsePagePayload((data ?? {}) as Record<string, unknown>);
}

export async function getProfileSocialContext(
  viewerId: string | null,
  targetId: string
): Promise<ProfileSocialContext> {
  const { data, error } = await getSupabase().rpc("get_profile_social_context", {
    p_viewer_id: viewerId,
    p_target_id: targetId,
  });
  if (error) throw error;

  const raw = (data ?? {}) as Record<string, unknown>;
  return {
    friendsCount: Number(raw.friends_count ?? 0),
    mutualFriendsCount: Number(raw.mutual_friends_count ?? 0),
    mutualTrainingPartners: Number(raw.mutual_training_partners ?? 0),
    sharedInterests: Array.isArray(raw.shared_interests)
      ? (raw.shared_interests as string[])
      : [],
    sharedGoals: Array.isArray(raw.shared_goals) ? (raw.shared_goals as string[]) : [],
    friendStatus: (raw.friend_status as FriendStatus) ?? "none",
    isFollowing: Boolean(raw.is_following),
    isFavorited: Boolean(raw.is_favorited),
    isPinned: Boolean(raw.is_pinned),
    isMuted: Boolean(raw.is_muted),
    joinedAt: String(raw.joined_at ?? ""),
    lastActive: raw.last_active ? String(raw.last_active) : null,
    friendMode: (raw.friend_mode as ProfileSocialContext["friendMode"]) ?? "open",
  };
}

export async function setProfileFavorite(
  userId: string,
  favoriteUserId: string,
  favorite: boolean
) {
  const { error } = await getSupabase().rpc("set_profile_favorite", {
    p_user_id: userId,
    p_favorite_user_id: favoriteUserId,
    p_favorite: favorite,
  });
  if (error) throw error;
}

export async function setProfileFavoritePinned(
  userId: string,
  favoriteUserId: string,
  pinned: boolean
) {
  const { error } = await getSupabase().rpc("set_profile_favorite_pinned", {
    p_user_id: userId,
    p_favorite_user_id: favoriteUserId,
    p_pinned: pinned,
  });
  if (error) throw error;
}

export async function getFavoriteProfilesPage(
  userId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ items: ProfileFavoriteItem[]; total: number; hasMore: boolean }> {
  const { data, error } = await getSupabase().rpc("get_favorite_profiles_page", {
    p_user_id: userId,
    p_limit: options.limit ?? 30,
    p_offset: options.offset ?? 0,
  });
  if (error) throw error;

  const payload = (data ?? {}) as Record<string, unknown>;
  const items = ((payload.items as Record<string, unknown>[]) ?? []).map((row) => ({
    profile: row.profile as Profile,
    isPinned: Boolean(row.is_pinned),
    pinnedAt: row.pinned_at ? String(row.pinned_at) : null,
    createdAt: String(row.created_at),
  }));

  return {
    items,
    total: Number(payload.total ?? 0),
    hasMore: Boolean(payload.has_more),
  };
}

export async function getPeopleYouMayKnow(
  viewerId: string,
  limit = 12
): Promise<import("@frennix/types").DiscoverProfileItem[]> {
  const { data, error } = await getSupabase().rpc("get_people_you_may_know", {
    p_viewer_id: viewerId,
    p_limit: limit,
  });
  if (error) throw error;

  return ((data as Record<string, unknown>[]) ?? []).map((entry) => ({
    profile: entry.profile as Profile,
    mutualFollowers: Number(entry.mutual_followers ?? 0),
    mutualFriends: Number(entry.mutual_friends ?? 0),
    mutualTrainingPartners: Number(entry.mutual_training_partners ?? 0),
    mutualGroups: Number(entry.mutual_groups ?? 0),
    mutualChallenges: Number(entry.mutual_challenges ?? 0),
    badges: Array.isArray(entry.badges) ? (entry.badges as import("@frennix/types").DiscoverProfileBadge[]) : [],
  }));
}

export async function getFriendCount(userId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from("friendships")
    .select("user_a", { count: "exact", head: true })
    .or(`user_a.eq.${userId},user_b.eq.${userId}`);
  if (error) throw error;
  return count ?? 0;
}
