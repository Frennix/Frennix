import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import type { Profile, WorkoutEvent } from "@frennix/types";
import { searchFeedContent, type FeedSearchWorkoutResult } from "@frennix/api";
import { Avatar, FeedSearchBar, colors, spacing, typography } from "@frennix/ui";
import { DiscoverRecentSearches } from "@/components/DiscoverRecentSearches";
import { openDiscoverSearch } from "@/lib/discover-navigation";
import {
  addDiscoverSearchHistory,
  clearDiscoverSearchHistory,
  readDiscoverSearchHistory,
  removeDiscoverSearchHistoryItem,
  type DiscoverRecentSearch,
} from "@/lib/discover-search-history";
import {
  registerFeedSearchController,
  resetFeedScrollLayout,
} from "@/lib/feed-search-controller";
import { formatActivity } from "@/lib/labels";
import { pushScreen } from "@/lib/press-utils";
import { useAuth } from "@/providers/AuthProvider";

type FeedSearchSectionProps = {
  onActiveChange?: (active: boolean) => void;
  onFocusScroll?: () => void;
};

function formatEventWhen(startsAt: string) {
  try {
    return new Date(startsAt).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export const FeedSearchSection = memo(function FeedSearchSection({
  onActiveChange,
  onFocusScroll,
}: FeedSearchSectionProps) {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const inputRef = useRef<TextInput>(null);
  const activeRef = useRef(false);
  const queryRef = useRef("");
  const { height: windowHeight } = useWindowDimensions();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [active, setActive] = useState(false);
  const [recentSearches, setRecentSearches] = useState<DiscoverRecentSearch[]>([]);

  activeRef.current = active;
  queryRef.current = query;

  const panelMaxHeight = useMemo(
    () => Math.min(360, Math.max(220, windowHeight * 0.42)),
    [windowHeight]
  );

  const resetSearch = useCallback(() => {
    setActive(false);
    setQuery("");
    setDebouncedQuery("");
    setRecentSearches([]);
    Keyboard.dismiss();
    inputRef.current?.blur();
    resetFeedScrollLayout();
  }, []);

  useEffect(() => {
    registerFeedSearchController({
      reset: resetSearch,
      isStale: () => activeRef.current || queryRef.current.length > 0,
    });
    return () => registerFeedSearchController(null);
  }, [resetSearch]);

  useFocusEffect(
    useCallback(() => {
      if (activeRef.current || queryRef.current.length > 0) {
        resetSearch();
      } else {
        resetFeedScrollLayout();
      }
      return () => {
        resetSearch();
      };
    }, [resetSearch])
  );

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleViewportChange = () => {
      if (!activeRef.current) {
        resetFeedScrollLayout();
      }
    };

    viewport.addEventListener("resize", handleViewportChange);
    viewport.addEventListener("scroll", handleViewportChange);
    return () => {
      viewport.removeEventListener("resize", handleViewportChange);
      viewport.removeEventListener("scroll", handleViewportChange);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    onActiveChange?.(active);
  }, [active, onActiveChange]);

  useEffect(() => {
    if (!active || !userId) return;
    void readDiscoverSearchHistory(userId).then(setRecentSearches);
  }, [active, userId]);

  const hasQuery = debouncedQuery.length >= 2;

  const {
    data: results,
    isFetching,
    isError,
  } = useQuery({
    queryKey: ["feed-search", debouncedQuery, userId],
    queryFn: () => searchFeedContent(debouncedQuery, userId),
    enabled: active && hasQuery && !!userId,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });

  const athletes = results?.athletes ?? [];
  const workouts = results?.workouts ?? [];
  const events = results?.events ?? [];
  const hasResults = athletes.length > 0 || workouts.length > 0 || events.length > 0;
  const showPanel = active;
  const showRecent = showPanel && !query.trim() && recentSearches.length > 0;
  const showEmpty = showPanel && hasQuery && !isFetching && !isError && !hasResults;
  const showResults = showPanel && hasQuery && (isFetching || hasResults || isError);

  const closeSearch = useCallback(() => {
    resetSearch();
  }, [resetSearch]);

  const openSearch = useCallback(() => {
    setActive(true);
    onFocusScroll?.();
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [onFocusScroll]);

  const handleSelectQuery = useCallback((next: string) => {
    setQuery(next);
    setDebouncedQuery(next);
    inputRef.current?.focus();
  }, []);

  const persistSearch = useCallback(
    async (term: string) => {
      if (!userId || term.trim().length < 2) return;
      const next = await addDiscoverSearchHistory(userId, term);
      setRecentSearches(next);
    },
    [userId]
  );

  const handleAthletePress = useCallback(
    (profile: Profile) => {
      void persistSearch(query);
      resetSearch();
      if (profile.username) {
        pushScreen(`/user/${profile.username}`);
      }
    },
    [persistSearch, query, resetSearch]
  );

  const handleWorkoutPress = useCallback(
    (workout: FeedSearchWorkoutResult) => {
      void persistSearch(query);
      resetSearch();
      pushScreen({ pathname: "/stories/discover", params: { tag: workout.slug } });
    },
    [persistSearch, query, resetSearch]
  );

  const handleEventPress = useCallback(
    (event: WorkoutEvent) => {
      void persistSearch(query);
      resetSearch();
      pushScreen(`/event/${event.id}`);
    },
    [persistSearch, query, resetSearch]
  );

  const handleFilterPress = useCallback(() => {
    resetSearch();
    openDiscoverSearch({ openFilters: true });
  }, [resetSearch]);

  const handleClearQuery = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
    inputRef.current?.focus();
  }, []);

  return (
    <View style={styles.root} nativeID="feed-search-section">
      <View style={styles.barRow}>
        <View style={[styles.barFlex, active && styles.barFlexActive]}>
          <FeedSearchBar
            value={query}
            onChangeText={setQuery}
            inputRef={inputRef}
            onFocus={openSearch}
            onFilterPress={handleFilterPress}
            onClear={handleClearQuery}
          />
        </View>
        {active ? (
          <Pressable
            style={styles.cancelButton}
            onPress={closeSearch}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Cancel search"
          >
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        ) : null}
      </View>

      {showPanel ? (
        <View
          style={[styles.panel, { maxHeight: panelMaxHeight }]}
          nativeID="feed-search-results-panel"
        >
          {showRecent ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              contentContainerStyle={styles.panelContent}
            >
              <DiscoverRecentSearches
                searches={recentSearches}
                onSelect={handleSelectQuery}
                onRemove={async (term) => {
                  if (!userId) return;
                  setRecentSearches(await removeDiscoverSearchHistoryItem(userId, term));
                }}
                onClearAll={async () => {
                  if (!userId) return;
                  await clearDiscoverSearchHistory(userId);
                  setRecentSearches([]);
                }}
              />
            </ScrollView>
          ) : null}

          {showResults ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              contentContainerStyle={styles.panelContent}
            >
              {isFetching && !hasResults ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={colors.accent} />
                  <Text style={styles.loadingText}>Searching…</Text>
                </View>
              ) : null}

              {isError ? (
                <Text style={styles.emptyText}>Could not load results. Try again.</Text>
              ) : null}

              {athletes.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Athletes</Text>
                  {athletes.map((profile) => (
                    <Pressable
                      key={profile.id}
                      style={styles.resultRow}
                      onPress={() => handleAthletePress(profile)}
                    >
                      <Avatar uri={profile.avatar_url} name={profile.display_name} size={40} />
                      <View style={styles.resultText}>
                        <Text style={styles.resultTitle} numberOfLines={1}>
                          {profile.display_name}
                        </Text>
                        {profile.username ? (
                          <Text style={styles.resultSubtitle} numberOfLines={1}>
                            @{profile.username}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {workouts.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Workouts</Text>
                  {workouts.map((workout) => (
                    <Pressable
                      key={workout.id}
                      style={styles.resultRow}
                      onPress={() => handleWorkoutPress(workout)}
                    >
                      <View style={styles.workoutBadge}>
                        <Text style={styles.workoutBadgeText}>🏋️</Text>
                      </View>
                      <View style={styles.resultText}>
                        <Text style={styles.resultTitle} numberOfLines={1}>
                          {workout.label}
                        </Text>
                        <Text style={styles.resultSubtitle} numberOfLines={1}>
                          Explore {formatActivity(workout.slug)} stories
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {events.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Events</Text>
                  {events.map((event) => (
                    <Pressable
                      key={event.id}
                      style={styles.resultRow}
                      onPress={() => handleEventPress(event)}
                    >
                      <View style={styles.workoutBadge}>
                        <Text style={styles.workoutBadgeText}>📅</Text>
                      </View>
                      <View style={styles.resultText}>
                        <Text style={styles.resultTitle} numberOfLines={1}>
                          {event.title}
                        </Text>
                        <Text style={styles.resultSubtitle} numberOfLines={2}>
                          {[formatEventWhen(event.starts_at), event.location]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          ) : null}

          {showEmpty ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No results found</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    flexShrink: 1,
    overflow: "hidden",
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    overflow: "hidden",
  },
  barFlex: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  barFlexActive: {
    flexShrink: 1,
  },
  cancelButton: {
    flexShrink: 0,
    marginLeft: spacing.sm,
  },
  cancel: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: "600",
    paddingVertical: spacing.xs,
  },
  panel: {
    marginTop: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surfaceCard,
    overflow: "hidden",
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    flexShrink: 1,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0 8px 24px rgba(0,0,0,0.18)", boxSizing: "border-box" } as object)
      : null),
  },
  panelContent: {
    padding: spacing.sm,
    paddingBottom: spacing.xl + 56,
    gap: spacing.sm,
  },
  section: {
    gap: spacing.xxs,
    minWidth: 0,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    paddingHorizontal: spacing.xxs,
    paddingTop: spacing.xxs,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.surface,
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    overflow: "hidden",
  },
  resultText: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    gap: 2,
  },
  resultTitle: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "600",
  },
  resultSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  workoutBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
    flexShrink: 0,
  },
  workoutBadgeText: {
    fontSize: 18,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  loadingText: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  emptyWrap: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: "center",
  },
});
