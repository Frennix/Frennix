import AsyncStorage from "@react-native-async-storage/async-storage";
import type { QueryClient } from "@tanstack/react-query";
import type { Conversation } from "@frennix/types";

const CACHE_PREFIX = "messages-inbox:v1:";
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type CachedInboxPayload = {
  savedAt: number;
  conversations: Conversation[];
};

function cacheKey(userId: string) {
  return `${CACHE_PREFIX}${userId}`;
}

export async function readMessagesInboxCache(userId: string): Promise<Conversation[] | undefined> {
  if (!userId) return undefined;
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CachedInboxPayload;
    if (!parsed?.conversations?.length) return undefined;
    if (Date.now() - parsed.savedAt > CACHE_MAX_AGE_MS) {
      await AsyncStorage.removeItem(cacheKey(userId));
      return undefined;
    }
    return parsed.conversations;
  } catch {
    return undefined;
  }
}

export async function writeMessagesInboxCache(userId: string, conversations: Conversation[]) {
  if (!userId || !conversations.length) return;
  const payload: CachedInboxPayload = {
    savedAt: Date.now(),
    conversations,
  };
  try {
    await AsyncStorage.setItem(cacheKey(userId), JSON.stringify(payload));
  } catch {
    // Best-effort persistence for offline tab switches.
  }
}

export async function hydrateMessagesInboxCache(queryClient: QueryClient, userId: string) {
  if (!userId) return;
  const existing = queryClient.getQueryData<Conversation[]>(["conversations", userId]);
  if (existing?.length) return;

  const cached = await readMessagesInboxCache(userId);
  if (!cached?.length) return;

  queryClient.setQueryData(["conversations", userId], cached);
}
