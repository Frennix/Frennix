import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { FeedPage } from "@frennix/types";

const CACHE_PREFIX = "feed-cache:v1:";
const CACHE_MAX_AGE_MS = 30 * 60 * 1000;

type CachedFeedPayload = {
  savedAt: number;
  pages: FeedPage[];
};

function cacheKey(userId: string) {
  return `${CACHE_PREFIX}${userId}`;
}

function parseCachedFeedPayload(raw: string): FeedPage[] | undefined {
  const parsed = JSON.parse(raw) as CachedFeedPayload;
  if (!parsed?.pages?.length) return undefined;
  if (Date.now() - parsed.savedAt > CACHE_MAX_AGE_MS) return undefined;
  return parsed.pages;
}

function readFeedCacheSync(userId: string): FeedPage[] | undefined {
  if (!userId || Platform.OS !== "web" || typeof localStorage === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return undefined;
    const pages = parseCachedFeedPayload(raw);
    if (!pages) {
      localStorage.removeItem(cacheKey(userId));
      return undefined;
    }
    return pages;
  } catch {
    return undefined;
  }
}

function applyFeedCachePages(queryClient: QueryClient, userId: string, pages: FeedPage[]) {
  queryClient.setQueryData<InfiniteData<FeedPage>>(["feed", userId], {
    pages,
    pageParams: pages.reduce<(string | undefined)[]>(
      (params, page, index) => {
        if (index === 0) return [undefined];
        params.push(pages[index - 1]?.nextCursor ?? undefined);
        return params;
      },
      []
    ),
  });
}

export async function readFeedCache(userId: string): Promise<FeedPage[] | undefined> {
  if (!userId) return undefined;
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CachedFeedPayload;
    if (!parsed?.pages?.length) return undefined;
    if (Date.now() - parsed.savedAt > CACHE_MAX_AGE_MS) {
      await AsyncStorage.removeItem(cacheKey(userId));
      return undefined;
    }
    return parsed.pages;
  } catch {
    return undefined;
  }
}

export async function writeFeedCache(userId: string, pages: FeedPage[]) {
  if (!userId || !pages.length) return;
  const payload: CachedFeedPayload = {
    savedAt: Date.now(),
    pages: pages.slice(0, 2),
  };
  try {
    await AsyncStorage.setItem(cacheKey(userId), JSON.stringify(payload));
  } catch {
    // Best-effort — stale cache is better than a blank feed.
  }
}

/** Hydrate TanStack Query from web localStorage before the feed query runs. */
export function hydrateFeedCacheSync(queryClient: QueryClient, userId: string) {
  if (!userId) return false;

  const existing = queryClient.getQueryData<InfiniteData<FeedPage>>(["feed", userId]);
  if (existing?.pages?.length) return false;

  const pages = readFeedCacheSync(userId);
  if (!pages?.length) return false;

  applyFeedCachePages(queryClient, userId, pages);
  return true;
}

export async function hydrateFeedCache(queryClient: QueryClient, userId: string) {
  if (!userId) return false;

  const existing = queryClient.getQueryData<InfiniteData<FeedPage>>(["feed", userId]);
  if (existing?.pages?.length) return false;

  const pages = await readFeedCache(userId);
  if (!pages?.length) return false;

  queryClient.setQueryData<InfiniteData<FeedPage>>(["feed", userId], {
    pages,
    pageParams: pages.reduce<(string | undefined)[]>(
      (params, page, index) => {
        if (index === 0) return [undefined];
        params.push(pages[index - 1]?.nextCursor ?? undefined);
        return params;
      },
      []
    ),
  });

  return true;
}
