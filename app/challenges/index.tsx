import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getChallengeHub, getChallengesPage } from "@frennix/api";
import { ChallengeHubSkeleton } from "@/components/ChallengeHubSkeleton";
import { ChallengeHubSection } from "@/components/ChallengeHubSection";
import { useAuth } from "@/providers/AuthProvider";
import { frennixRefreshControlProps } from "@/lib/screen-shell";
import { challengeTypeEmoji, challengeTypeLabel } from "@/lib/challenge-types";
import { refetchQueryKeys } from "@/lib/refreshQueries";
import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  ChallengeCard,
  EmptyState,
  colors,
  spacing,
  typography,
} from "@frennix/ui";

export default function ChallengeHubScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [browseAll, setBrowseAll] = useState(false);

  const { data: hub, isLoading: hubLoading } = useQuery({
    queryKey: ["challenge-hub", userId],
    queryFn: () => getChallengeHub(userId),
    enabled: !!userId,
  });

  const {
    data: allPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: allLoading,
  } = useInfiniteQuery({
    queryKey: ["challenges-all"],
    queryFn: ({ pageParam }) => getChallengesPage({ cursor: pageParam ?? null }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: browseAll,
  });

  const allChallenges = allPages?.pages.flatMap((p) => p.items) ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchQueryKeys(queryClient, [
        ["challenge-hub", userId],
        ["challenges-all"],
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, userId]);

  const openChallenge = useCallback((id: string) => {
    router.push(`/challenge/${id}`);
  }, []);

  if (!userId) {
    return (
      <View style={styles.center}>
        <EmptyState
          title="Sign in to explore challenges"
          description="Join public challenges, compete on leaderboards, and stay accountable with friends."
          actionLabel="Go to Discover"
          onAction={() => router.push("/(tabs)/discover")}
        />
      </View>
    );
  }

  if (browseAll) {
    return (
      <View style={styles.container}>
        <View style={styles.browseHeader}>
          <Pressable onPress={() => setBrowseAll(false)}>
            <Text style={styles.backLink}>← Challenge Hub</Text>
          </Pressable>
          <Text style={styles.browseTitle}>All public challenges</Text>
        </View>
        <FlatList
          data={allChallenges}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} {...frennixRefreshControlProps} />
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator color={colors.accent} style={styles.footerLoader} />
            ) : null
          }
          ListEmptyComponent={
            allLoading ? (
              <ActivityIndicator color={colors.accent} style={styles.footerLoader} />
            ) : (
              <EmptyState
                title="No challenges yet"
                description="Create one and invite your training partners."
                actionLabel="Create challenge"
                onAction={() => router.push("/create-challenge")}
              />
            )
          }
          renderItem={({ item }) => (
            <ChallengeCard
              challenge={item}
              typeLabel={challengeTypeLabel(item.challenge_type)}
              typeEmoji={challengeTypeEmoji(item.challenge_type)}
              onPress={() => openChallenge(item.id)}
            />
          )}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.hubContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} {...frennixRefreshControlProps} />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Challenge Hub</Text>
        <Text style={styles.heroSubtitle}>
          Compete, check in daily, and stay accountable with your community.
        </Text>
        <View style={styles.heroActions}>
          <Button title="Browse all" variant="secondary" onPress={() => setBrowseAll(true)} />
          <Button title="Create challenge" onPress={() => router.push("/create-challenge")} />
        </View>
      </View>

      {hubLoading && !hub ? (
        <ChallengeHubSkeleton />
      ) : (
        <>
          <ChallengeHubSection
            title="Featured"
            challenges={(hub?.featured ?? []).map((c) => ({
              ...c,
              challenge_type: c.challenge_type,
            }))}
            onPressChallenge={(c) => openChallenge(c.id)}
            emptyMessage="No featured challenges right now."
          />
          <ChallengeHubSection
            title="Trending"
            challenges={hub?.trending ?? []}
            onPressChallenge={(c) => openChallenge(c.id)}
            emptyMessage="No trending challenges yet. Create one to get the community moving."
          />
          <ChallengeHubSection
            title="Friends' challenges"
            challenges={hub?.friends ?? []}
            onPressChallenge={(c) => openChallenge(c.id)}
            emptyMessage="When friends join challenges, they'll show up here."
          />
          <ChallengeHubSection
            title="Nearby"
            challenges={hub?.nearby ?? []}
            onPressChallenge={(c) => openChallenge(c.id)}
            emptyMessage="Add your city in profile to discover local challenges."
          />
          {(hub?.mine?.length ?? 0) > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your active challenges</Text>
              {(hub?.mine ?? []).map((challenge) => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={{
                    ...challenge,
                    progress_pct: challenge.my_check_ins
                      ? Math.min(
                          100,
                          Math.round(
                            ((challenge.my_check_ins ?? 0) /
                              Math.max(
                                1,
                                Math.ceil(
                                  (new Date(challenge.end_date).getTime() -
                                    new Date(challenge.start_date).getTime()) /
                                    86400000
                                ) + 1
                              )) *
                              100
                          )
                        )
                      : undefined,
                  }}
                  typeLabel={challengeTypeLabel(challenge.challenge_type)}
                  typeEmoji={challengeTypeEmoji(challenge.challenge_type)}
                  onPress={() => openChallenge(challenge.id)}
                />
              ))}
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, justifyContent: "center" },
  hubContent: { paddingBottom: spacing.xxl },
  hero: {
    padding: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  heroTitle: { ...typography.title },
  heroSubtitle: { ...typography.bodySmall, color: colors.textMuted },
  heroActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  section: { paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.lg },
  sectionTitle: { ...typography.section },
  list: { padding: spacing.md, flexGrow: 1 },
  browseHeader: { padding: spacing.md, gap: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  backLink: { ...typography.bodySmall, color: colors.accent, fontWeight: "600" },
  browseTitle: { ...typography.heading },
  footerLoader: { padding: spacing.lg },
});
