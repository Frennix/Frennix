import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { DiscoverPeopleSkeleton } from "@/components/DiscoverProfileSkeleton";
import { DiscoverListSkeleton } from "@/components/DiscoverListSkeleton";
import { AppIcon } from "@/components/AppIcon";
import { scrollFlatListToTop, handleTabRetap } from "@/lib/tab-scroll-registry";
import { useScrollAtTop } from "@/lib/useScrollAtTop";
import { useTabScrollRegistration } from "@/lib/useTabScrollRegistration";
import { getErrorMessage, getChallenges, getGroups, getSuggestedAthletes, searchProfiles } from "@frennix/api";
import type { SuggestedAthlete } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { DiscoverChallengeRow } from "@/components/DiscoverChallengeRow";
import { useSuggestedFollow } from "@/lib/useSuggestedFollow";
import { formatActivity } from "@/lib/labels";
import { pushScreen } from "@/lib/press-utils";
import { useGuardedRefresh } from "@/lib/useGuardedRefresh";
import {
  frennixRefreshControlProps,
  tabScreenContainer,
  tabScreenScrollSurface,
  useTabScreenWebHeightStyle,
} from "@/lib/screen-shell";
import {
  DiscoverProfileCard,
  EmptyState,
  GroupCard,
  Input,
  QueryErrorState,
  colors,
  spacing,
  typography,
} from "@frennix/ui";

type Tab = "people" | "groups" | "challenges";

function profileInterestLabels(activities: string[] | undefined, limit = 4) {
  return (activities ?? []).slice(0, limit).map(formatActivity);
}

export default function DiscoverScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const webHeightStyle = useTabScreenWebHeightStyle();
  const [tab, setTab] = useState<Tab>("people");
  const [peopleSearch, setPeopleSearch] = useState("");
  const [debouncedPeopleSearch, setDebouncedPeopleSearch] = useState("");
  const [groupQuery, setGroupQuery] = useState("");
  const { isFollowing, toggleFollow, followMutation } = useSuggestedFollow(userId);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPeopleSearch(peopleSearch.trim()), 300);
    return () => clearTimeout(timer);
  }, [peopleSearch]);

  const isSearchingPeople = debouncedPeopleSearch.length > 0;

  const {
    data: searchResults = [],
    isFetching: searchLoading,
    isError: searchError,
    error: searchQueryError,
    refetch: refetchSearch,
    isRefetching: searchRefetching,
  } = useQuery({
    queryKey: ["discover-people", debouncedPeopleSearch],
    queryFn: () => searchProfiles(debouncedPeopleSearch, 30, userId),
    enabled: tab === "people" && isSearchingPeople,
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  });

  const {
    data: suggestions = [],
    isFetching: suggestionsLoading,
    isError: suggestionsError,
    error: suggestionsQueryError,
    refetch: refetchSuggestions,
    isRefetching: suggestionsRefetching,
  } = useQuery({
    queryKey: ["discover-suggestions", userId],
    queryFn: () => getSuggestedAthletes(userId, 20),
    enabled: tab === "people" && !isSearchingPeople && !!userId,
    staleTime: 120_000,
    placeholderData: (previousData) => previousData,
  });

  const {
    data: groups = [],
    isFetching: groupsLoading,
    isError: groupsError,
    error: groupsQueryError,
    refetch: refetchGroups,
    isRefetching: groupsRefetching,
  } = useQuery({
    queryKey: ["discover-groups", groupQuery],
    queryFn: () => getGroups({ query: groupQuery || undefined }),
    enabled: tab === "groups",
    staleTime: 120_000,
    placeholderData: (previousData) => previousData,
  });

  const {
    data: challenges = [],
    isFetching: challengesLoading,
    isError: challengesError,
    error: challengesQueryError,
    refetch: refetchChallenges,
    isRefetching: challengesRefetching,
  } = useQuery({
    queryKey: ["discover-challenges"],
    queryFn: getChallenges,
    enabled: tab === "challenges",
    staleTime: 120_000,
    placeholderData: (previousData) => previousData,
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: "people", label: "People" },
    { key: "groups", label: "Groups" },
    { key: "challenges", label: "Challenges" },
  ];

  const onRefreshPeople = useGuardedRefresh(
    useCallback(async () => {
      if (isSearchingPeople) await refetchSearch();
      else await refetchSuggestions();
    }, [isSearchingPeople, refetchSearch, refetchSuggestions]),
    { errorTitle: "Could not refresh people", haptic: true }
  );

  const onRefreshGroups = useGuardedRefresh(
    useCallback(() => refetchGroups(), [refetchGroups]),
    { errorTitle: "Could not refresh groups" }
  );

  const onRefreshChallenges = useGuardedRefresh(
    useCallback(() => refetchChallenges(), [refetchChallenges]),
    { errorTitle: "Could not refresh challenges" }
  );

  const peopleData: SuggestedAthlete[] = isSearchingPeople
    ? searchResults.map((profile) => ({
        profile,
        score: 0,
        reason: "",
        mutual_count: 0,
        shared_activities: profile.activities ?? [],
        shared_goals: profile.fitness_goals ?? [],
      }))
    : suggestions;

  const peopleLoading = isSearchingPeople ? searchLoading : suggestionsLoading;
  const peopleError = isSearchingPeople ? searchError : suggestionsError;
  const peopleQueryError = isSearchingPeople ? searchQueryError : suggestionsQueryError;
  const peopleRefetching = isSearchingPeople ? searchRefetching : suggestionsRefetching;

  const peopleListRef = useRef<FlatList<SuggestedAthlete>>(null);
  const groupsListRef = useRef<FlatList<(typeof groups)[number]>>(null);
  const challengesListRef = useRef<FlatList<(typeof challenges)[number]>>(null);
  const { onScroll, isAtTop, resetAtTop } = useScrollAtTop();

  useEffect(() => {
    resetAtTop();
  }, [resetAtTop, tab]);

  useTabScrollRegistration(
    "discover",
    useCallback(() => {
      const activeRef =
        tab === "people" ? peopleListRef : tab === "groups" ? groupsListRef : challengesListRef;
      handleTabRetap({
        isAtTop,
        scrollToTop: () => scrollFlatListToTop(activeRef.current),
        refresh: () => {
          if (tab === "people") void onRefreshPeople();
          else if (tab === "groups") void onRefreshGroups();
          else void onRefreshChallenges();
        },
      });
    }, [isAtTop, onRefreshChallenges, onRefreshGroups, onRefreshPeople, tab])
  );

  if (tab === "people" && peopleError && peopleData.length === 0) {
    return (
      <View style={[styles.container, webHeightStyle]}>
        <QueryErrorState
          title="Could not load people"
          message={getErrorMessage(peopleQueryError)}
          onRetry={() => void (isSearchingPeople ? refetchSearch() : refetchSuggestions())}
        />
      </View>
    );
  }

  if (tab === "groups" && groupsError && groups.length === 0) {
    return (
      <View style={[styles.container, webHeightStyle]}>
        <QueryErrorState
          title="Could not load groups"
          message={getErrorMessage(groupsQueryError)}
          onRetry={() => void refetchGroups()}
        />
      </View>
    );
  }

  if (tab === "challenges" && challengesError && challenges.length === 0) {
    return (
      <View style={[styles.container, webHeightStyle]}>
        <QueryErrorState
          title="Could not load challenges"
          message={getErrorMessage(challengesQueryError)}
          onRetry={() => void refetchChallenges()}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, webHeightStyle]}>
      <Text style={styles.header}>Find your training community</Text>

      <Text style={styles.matchingSectionTitle}>Matching</Text>
      <View style={styles.matchingCards}>
        <Pressable style={styles.matchingCard} onPress={() => pushScreen("/matching")}>
          <View style={styles.matchingCardIcon}>
            <AppIcon name="users" color={colors.accent} size={24} />
          </View>
          <View style={styles.matchingCardCopy}>
            <Text style={styles.matchingCardTitle}>Find training partners</Text>
            <Text style={styles.matchingCardBody}>
              Browse athletes who share your goals and workout style — connect to train together.
            </Text>
          </View>
          <AppIcon name="chevron-right" color={colors.textMuted} size={20} />
        </Pressable>

        <Pressable style={styles.matchingCard} onPress={() => pushScreen("/trainers")}>
          <View style={styles.matchingCardIcon}>
            <AppIcon name="dumbbell" color={colors.accent} size={24} />
          </View>
          <View style={styles.matchingCardCopy}>
            <Text style={styles.matchingCardTitle}>Find a trainer</Text>
            <Text style={styles.matchingCardBody}>
              Connect with professional coaches for online or in-person training.
            </Text>
          </View>
          <AppIcon name="chevron-right" color={colors.textMuted} size={20} />
        </Pressable>
      </View>

      {tab === "people" ? (
        <View style={styles.searchBlock}>
          <Input
            placeholder="Search by name, interests, workout type, or bio..."
            value={peopleSearch}
            onChangeText={setPeopleSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.searchHint}>
            Try &quot;basketball&quot;, &quot;yoga&quot;, or a name from someone&apos;s bio
          </Text>
        </View>
      ) : tab === "groups" ? (
        <Input placeholder="Search groups..." value={groupQuery} onChangeText={setGroupQuery} />
      ) : null}

      <View style={styles.tabRow}>
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "people" ? (
        <FlatList
          ref={peopleListRef}
          style={[tabScreenScrollSurface, webHeightStyle]}
          data={peopleData}
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyExtractor={(item) => item.profile.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={peopleRefetching}
              onRefresh={() => void onRefreshPeople()}
              {...frennixRefreshControlProps}
            />
          }
          ListHeaderComponent={
            !isSearchingPeople ? (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Suggested athletes</Text>
                <Text style={styles.sectionBody}>
                  Based on shared sports, workout interests, location, mutual connections, and activity.
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            peopleLoading ? (
              <DiscoverPeopleSkeleton />
            ) : (
              <EmptyState
                title={isSearchingPeople ? "No people found" : "No suggestions yet"}
                description={
                  isSearchingPeople
                    ? "Try a different name, fitness interest, workout type, or bio keyword."
                    : "Complete your profile with activities and city to get better athlete recommendations."
                }
              />
            )
          }
          renderItem={({ item }) => {
            const profile = item.profile;
            const following = isFollowing(profile.id);
            return (
              <DiscoverProfileCard
                profile={profile}
                interestLabels={profileInterestLabels(profile.activities)}
                reason={item.reason || undefined}
                onViewProfile={() => router.push(`/user/${profile.username}`)}
                followLabel={following ? "Following" : "Follow"}
                onFollow={() => toggleFollow(profile.id)}
                followLoading={
                  followMutation.isPending && followMutation.variables?.targetUserId === profile.id
                }
              />
            );
          }}
        />
      ) : null}

      {tab === "groups" ? (
        <FlatList
          ref={groupsListRef}
          style={[tabScreenScrollSurface, webHeightStyle]}
          data={groups}
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyExtractor={(g) => g.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={groupsRefetching}
              onRefresh={() => void onRefreshGroups()}
              {...frennixRefreshControlProps}
            />
          }
          ListHeaderComponent={
            <Pressable onPress={() => router.push("/create-group")}>
              <Text style={styles.createLink}>+ Create a group</Text>
            </Pressable>
          }
          ListEmptyComponent={
            groupsLoading ? (
              <DiscoverListSkeleton />
            ) : (
              <EmptyState
                title="No groups found"
                description="Start a group for your marathon crew, pickup league, or gym community."
                actionLabel="Create group"
                onAction={() => router.push("/create-group")}
              />
            )
          }
          renderItem={({ item }) => (
            <GroupCard group={item} onPress={() => router.push(`/group/${item.id}`)} />
          )}
        />
      ) : null}

      {tab === "challenges" ? (
        <FlatList
          ref={challengesListRef}
          style={[tabScreenScrollSurface, webHeightStyle]}
          data={challenges}
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={challengesRefetching}
              onRefresh={() => void onRefreshChallenges()}
              {...frennixRefreshControlProps}
            />
          }
          ListHeaderComponent={
            <Pressable onPress={() => router.push("/create-challenge")}>
              <Text style={styles.createLink}>+ Create a challenge</Text>
            </Pressable>
          }
          ListEmptyComponent={
            challengesLoading ? (
              <DiscoverListSkeleton />
            ) : (
              <EmptyState
                title="No active challenges"
                description="Join or create a challenge to stay accountable with your community."
                actionLabel="Create challenge"
                onAction={() => router.push("/create-challenge")}
              />
            )
          }
          renderItem={({ item }) => <DiscoverChallengeRow challenge={item} userId={userId} />}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...tabScreenContainer, padding: spacing.md },
  header: { ...typography.heading, marginBottom: spacing.sm },
  matchingSectionTitle: {
    ...typography.bodySmall,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  matchingCards: { gap: spacing.sm, marginBottom: spacing.md },
  matchingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  matchingCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  matchingCardCopy: { flex: 1, gap: 4 },
  matchingCardTitle: { ...typography.body, fontWeight: "700" },
  matchingCardBody: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  searchBlock: { gap: spacing.xs, marginBottom: spacing.xs },
  searchHint: { ...typography.caption, color: colors.textMuted },
  tabRow: { flexDirection: "row", gap: spacing.sm, marginVertical: spacing.md },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  tabActive: { backgroundColor: colors.accentMuted },
  tabText: { color: colors.textMuted, fontWeight: "600" },
  tabTextActive: { color: colors.accent },
  sectionHeader: { gap: 4, marginBottom: spacing.md },
  sectionTitle: { ...typography.body, fontWeight: "700", color: colors.text },
  sectionBody: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  list: { paddingBottom: spacing.xxl },
  createLink: { color: colors.accent, fontWeight: "600", marginBottom: spacing.md },
  loader: { marginVertical: spacing.md },
});
