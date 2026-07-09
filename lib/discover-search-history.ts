import AsyncStorage from "@react-native-async-storage/async-storage";

const HISTORY_PREFIX = "discover-search-history:v1:";
const MAX_RECENT_SEARCHES = 10;

export type DiscoverRecentSearch = {
  query: string;
  searchedAt: number;
};

function historyKey(userId: string) {
  return `${HISTORY_PREFIX}${userId}`;
}

export async function readDiscoverSearchHistory(userId: string): Promise<DiscoverRecentSearch[]> {
  if (!userId) return [];
  try {
    const raw = await AsyncStorage.getItem(historyKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DiscoverRecentSearch[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => typeof entry?.query === "string" && entry.query.trim().length >= 2)
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

export async function addDiscoverSearchHistory(userId: string, query: string): Promise<DiscoverRecentSearch[]> {
  const trimmed = query.trim();
  if (!userId || trimmed.length < 2) return readDiscoverSearchHistory(userId);

  const existing = await readDiscoverSearchHistory(userId);
  const next: DiscoverRecentSearch[] = [
    { query: trimmed, searchedAt: Date.now() },
    ...existing.filter((entry) => entry.query.toLowerCase() !== trimmed.toLowerCase()),
  ].slice(0, MAX_RECENT_SEARCHES);

  try {
    await AsyncStorage.setItem(historyKey(userId), JSON.stringify(next));
  } catch {
    // Best-effort local persistence.
  }

  return next;
}

export async function removeDiscoverSearchHistoryItem(
  userId: string,
  query: string
): Promise<DiscoverRecentSearch[]> {
  const existing = await readDiscoverSearchHistory(userId);
  const next = existing.filter((entry) => entry.query !== query);
  try {
    await AsyncStorage.setItem(historyKey(userId), JSON.stringify(next));
  } catch {
    // Best-effort.
  }
  return next;
}

export async function clearDiscoverSearchHistory(userId: string): Promise<void> {
  if (!userId) return;
  try {
    await AsyncStorage.removeItem(historyKey(userId));
  } catch {
    // Best-effort.
  }
}
