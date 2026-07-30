import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Search, X } from "lucide-react-native";
import type { Profile, WorkoutEvent } from "@frennix/types";
import { searchFeedContent, type FeedSearchWorkoutResult } from "@frennix/api";
import { Avatar, colors, spacing, typography } from "@frennix/ui";
import { DiscoverRecentSearches } from "@/components/DiscoverRecentSearches";
import {
  addDiscoverSearchHistory,
  clearDiscoverSearchHistory,
  readDiscoverSearchHistory,
  removeDiscoverSearchHistoryItem,
  type DiscoverRecentSearch,
} from "@/lib/discover-search-history";
import {
  registerFeedSearchController,
  resetFeedHorizontalScroll,
} from "@/lib/feed-search-controller";
import { formatActivity } from "@/lib/labels";
import { pushScreen } from "@/lib/press-utils";
import { useAuth } from "@/providers/AuthProvider";

type FeedSearchOverlayProps = {
  onOpen?: () => void;
  onClose?: () => void;
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

export const FeedSearchOverlay = memo(function FeedSearchOverlay({
  onOpen,
  onClose,
}: FeedSearchOverlayProps) {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const openRef = useRef(false);
  const queryRef = useRef("");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<DiscoverRecentSearch[]>([]);

  openRef.current = open;
  queryRef.current = query;

  const closeSearch = useCallback(() => {
    setOpen(false);
    setQuery("");
    setDebouncedQuery("");
    Keyboard.dismiss();
    inputRef.current?.blur();
    resetFeedHorizontalScroll();
    onClose?.();
  }, [onClose]);

  const openSearch = useCallback(() => {
    onOpen?.();
    setOpen(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [onOpen]);

  const resetSearch = useCallback(() => {
    closeSearch();
  }, [closeSearch]);

  useEffect(() => {
    registerFeedSearchController({
      open: openSearch,
      close: closeSearch,
      reset: resetSearch,
      isOpen: () => openRef.current,
      isStale: () => openRef.current || queryRef.current.length > 0,
    });
    return () => registerFeedSearchController(null);
  }, [closeSearch, openSearch, resetSearch]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        resetSearch();
      };
    }, [resetSearch])
  );

  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      closeSearch();
      return true;
    });
    return () => subscription.remove();
  }, [closeSearch, open]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open || !userId) return;
    void readDiscoverSearchHistory(userId).then(setRecentSearches);
  }, [open, userId]);

  const hasQuery = debouncedQuery.length >= 2;

  const {
    data: results,
    isFetching,
    isError,
  } = useQuery({
    queryKey: ["feed-search", debouncedQuery, userId],
    queryFn: () => searchFeedContent(debouncedQuery, userId),
    enabled: open && hasQuery && !!userId,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });

  const athletes = results?.athletes ?? [];
  const workouts = results?.workouts ?? [];
  const events = results?.events ?? [];
  const hasResults = athletes.length > 0 || workouts.length > 0 || events.length > 0;
  const showRecent = !query.trim() && recentSearches.length > 0;
  const showEmpty = hasQuery && !isFetching && !isError && !hasResults;
  const showResults = hasQuery && (isFetching || hasResults || isError);

  const persistSearch = useCallback(
    async (term: string) => {
      if (!userId || term.trim().length < 2) return;
      const next = await addDiscoverSearchHistory(userId, term);
      setRecentSearches(next);
    },
    [userId]
  );

  const handleSelectQuery = useCallback((next: string) => {
    setQuery(next);
    setDebouncedQuery(next);
    inputRef.current?.focus();
  }, []);

  const handleAthletePress = useCallback(
    (profile: Profile) => {
      void persistSearch(query);
      closeSearch();
      if (profile.username) {
        pushScreen(`/user/${profile.username}`);
      }
    },
    [closeSearch, persistSearch, query]
  );

  const handleWorkoutPress = useCallback(
    (workout: FeedSearchWorkoutResult) => {
      void persistSearch(query);
      closeSearch();
      pushScreen({ pathname: "/stories/discover", params: { tag: workout.slug } });
    },
    [closeSearch, persistSearch, query]
  );

  const handleEventPress = useCallback(
    (event: WorkoutEvent) => {
      void persistSearch(query);
      closeSearch();
      pushScreen(`/event/${event.id}`);
    },
    [closeSearch, persistSearch, query]
  );

  if (!open) return null;

  return (
    <View
      style={[styles.overlay, webOverlayStyle]}
      nativeID="feed-search-overlay"
      accessibilityViewIsModal
    >
      <View style={[styles.searchHeader, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.searchInputWrapper}>
          <View style={styles.searchInputBar}>
            <Search size={18} color={colors.textMuted} strokeWidth={2.25} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search athletes, workouts, events"
              placeholderTextColor={colors.textMuted}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              accessibilityRole="search"
              accessibilityLabel="Search athletes, workouts, events"
            />
            {query.length > 0 ? (
              <Pressable
                onPress={() => {
                  setQuery("");
                  setDebouncedQuery("");
                  inputRef.current?.focus();
                }}
                hitSlop={8}
                style={styles.clearButton}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <X size={16} color={colors.textMuted} strokeWidth={2.25} />
              </Pressable>
            ) : null}
          </View>
        </View>
        <Pressable
          onPress={closeSearch}
          hitSlop={8}
          style={styles.cancelButton}
          accessibilityRole="button"
          accessibilityLabel="Cancel search"
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.resultsList}
        contentContainerStyle={[
          styles.resultsContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {showRecent ? (
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
        ) : null}

        {showResults && isFetching && !hasResults ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.loadingText}>Searching…</Text>
          </View>
        ) : null}

        {showResults && isError ? (
          <Text style={styles.emptyText}>Could not load results. Try again.</Text>
        ) : null}

        {showResults && athletes.length > 0 ? (
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

        {showResults && workouts.length > 0 ? (
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

        {showResults && events.length > 0 ? (
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
                    {[formatEventWhen(event.starts_at), event.location].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        {showEmpty ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No results found</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
});

const webOverlayStyle: ViewStyle =
  Platform.OS === "web"
    ? ({
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        height: "100dvh",
        zIndex: 9999,
        boxSizing: "border-box",
      } as ViewStyle)
    : {
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 1000,
      };

const styles = StyleSheet.create({
  overlay: {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    backgroundColor: colors.backgroundFeed,
    overflow: "hidden",
  },
  searchHeader: {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    gap: 10,
    paddingBottom: spacing.sm,
  },
  searchInputWrapper: {
    flex: 1,
    minWidth: 0,
  },
  searchInputBar: {
    minHeight: 48,
    borderRadius: 17,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
  },
  searchInput: {
    ...typography.bodySmall,
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
    paddingVertical: Platform.OS === "web" ? spacing.xs : spacing.sm,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as ViewStyle) : null),
  },
  clearButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cancelButton: {
    flexShrink: 0,
  },
  cancelText: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: "600",
  },
  resultsList: {
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
  },
  resultsContent: {
    paddingHorizontal: spacing.md,
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
    alignItems: "center",
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: "center",
  },
});
