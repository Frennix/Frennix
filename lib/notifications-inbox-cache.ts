import AsyncStorage from "@react-native-async-storage/async-storage";
import type { QueryClient } from "@tanstack/react-query";
import type { NotificationPageResult } from "@/lib/notification-query-cache";
import type { InfiniteData } from "@tanstack/react-query";

const CACHE_PREFIX = "notifications-inbox:v1:";
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type CachedInboxPayload = {
  savedAt: number;
  pages: NotificationPageResult[];
};

function cacheKey(userId: string, category: string) {
  return `${CACHE_PREFIX}${userId}:${category}`;
}

export async function readNotificationsInboxCache(
  userId: string,
  category = "all"
): Promise<InfiniteData<NotificationPageResult> | undefined> {
  if (!userId) return undefined;
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId, category));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CachedInboxPayload;
    if (!parsed?.pages?.length) return undefined;
    if (Date.now() - parsed.savedAt > CACHE_MAX_AGE_MS) {
      await AsyncStorage.removeItem(cacheKey(userId, category));
      return undefined;
    }
    return {
      pages: parsed.pages,
      pageParams: parsed.pages.map((_, index) => (index === 0 ? null : `cache-${index}`)),
    };
  } catch {
    return undefined;
  }
}

export async function writeNotificationsInboxCache(
  userId: string,
  category: string,
  data: InfiniteData<NotificationPageResult> | undefined
) {
  if (!userId || !data?.pages?.length) return;
  const payload: CachedInboxPayload = {
    savedAt: Date.now(),
    pages: data.pages.slice(0, 3),
  };
  try {
    await AsyncStorage.setItem(cacheKey(userId, category), JSON.stringify(payload));
  } catch {
    // Best-effort offline cache.
  }
}

export async function hydrateNotificationsInboxCache(
  queryClient: QueryClient,
  userId: string,
  category = "all"
) {
  if (!userId) return;
  const queryKey = ["notifications", userId, { category }] as const;
  const existing = queryClient.getQueryData<InfiniteData<NotificationPageResult>>(queryKey);
  if (existing?.pages?.length) return;

  const cached = await readNotificationsInboxCache(userId, category);
  if (!cached?.pages?.length) return;

  queryClient.setQueryData(queryKey, cached);
}
