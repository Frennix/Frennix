import { AppIcon } from "@/components/AppIcon";
import { Stack, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getErrorMessage,
  getMatchCandidates,
  getOrCreateConversation,
  recordMatchSwipe,
} from "@frennix/api";
import type { MatchCandidate } from "@frennix/types";
import { FrennixLogo } from "@/components/FrennixLogo";
import {
  TrainingMatchModal,
  TrainingPartnerDeckActions,
} from "@/components/TrainingMatchModal";
import { TrainingPartnerCard } from "@/components/TrainingPartnerCard";
import { TrainingPartnerReadinessCard } from "@/components/TrainingPartnerReadinessCard";
import { ReportIssueLink } from "@/components/ReportIssueLink";
import { pushScreen } from "@/lib/press-utils";
import { logMatchmakingError } from "@/lib/matchmaking-observability";
import { hapticMatch } from "@/lib/haptics";
import { isTrainingPartnerDiscoveryReady } from "@/lib/training-partner-readiness";
import { useAuth } from "@/providers/AuthProvider";
import { Button, EmptyState, ScreenSpinner, prefetchCachedImage, colors, spacing, typography } from "@frennix/ui";

function MatchingHeaderActions() {
  return (
    <View style={styles.headerActions}>
      <Pressable onPress={() => pushScreen("/matching/matches")} hitSlop={8}>
        <AppIcon name="users" color={colors.text} size={22} />
      </Pressable>
      <Pressable onPress={() => pushScreen("/matching-settings")} hitSlop={8}>
        <AppIcon name="sliders" color={colors.text} size={22} />
      </Pressable>
    </View>
  );
}

export default function TrainingPartnerDiscoveryScreen() {
  const { profile, session, authReady, refreshProfile } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();

  const [deck, setDeck] = useState<MatchCandidate[]>([]);
  const [deckInitialized, setDeckInitialized] = useState(false);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState("");
  const [matchPartner, setMatchPartner] = useState<MatchCandidate | null>(null);
  const [matchModalVisible, setMatchModalVisible] = useState(false);
  const [openingMessage, setOpeningMessage] = useState(false);

  const discoveryEnabled = profile?.matching_enabled ?? false;
  const profileReady = profile ? isTrainingPartnerDiscoveryReady(profile) : false;

  const {
    data: candidates = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["training-partner-candidates", userId],
    queryFn: () => getMatchCandidates(userId, 20),
    enabled: !!userId && discoveryEnabled,
  });

  const syncDeck = useCallback((incoming: MatchCandidate[]) => {
    setDeck(Array.isArray(incoming) ? incoming : []);
    setDeckInitialized(true);
  }, []);

  useEffect(() => {
    if (!discoveryEnabled || isLoading || deckInitialized) return;
    syncDeck(Array.isArray(candidates) ? candidates : []);
  }, [candidates, deckInitialized, discoveryEnabled, isLoading, syncDeck]);

  useEffect(() => {
    if (isError && error) {
      logMatchmakingError("match_candidates", error);
    }
  }, [isError, error]);

  const currentCandidate = deck[0] ?? null;
  const nextCandidate = deck[1] ?? null;
  const remainingCount = Math.max(deck.length - 1, 0);

  useEffect(() => {
    if (nextCandidate?.avatar_url) {
      void prefetchCachedImage(nextCandidate.avatar_url);
    }
  }, [nextCandidate?.avatar_url]);

  async function handleRefresh() {
    setDeckInitialized(false);
    setActionError("");
    const result = await refetch();
    if (result.data) {
      syncDeck(result.data);
    }
  }

  async function advanceDeck() {
    setDeck((prev) => prev.slice(1));
    await queryClient.invalidateQueries({ queryKey: ["training-partner-candidates", userId] });
  }

  async function handleDecision(direction: "left" | "right") {
    if (!currentCandidate || acting) return;

    setActing(true);
    setActionError("");

    try {
      const result = await recordMatchSwipe(currentCandidate.id, direction);

      if (direction === "right" && result.is_mutual && result.match) {
        hapticMatch();
        setMatchPartner(currentCandidate);
        setMatchModalVisible(true);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["training-matches", userId] }),
          queryClient.invalidateQueries({ queryKey: ["notifications", userId] }),
          queryClient.invalidateQueries({ queryKey: ["unread-notifications", userId] }),
        ]);
      }

      await advanceDeck();
    } catch (e) {
      logMatchmakingError("match_swipe", e, { partnerId: currentCandidate.id, direction });
      setActionError(e instanceof Error ? e.message : "Could not record your choice");
    } finally {
      setActing(false);
    }
  }

  async function handleSendMessage() {
    if (!matchPartner || !userId) return;

    setOpeningMessage(true);
    try {
      const conversationId = await getOrCreateConversation(userId, matchPartner.id);
      setMatchModalVisible(false);
      setMatchPartner(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["training-matches", userId] }),
        queryClient.invalidateQueries({ queryKey: ["conversations", userId] }),
        queryClient.invalidateQueries({ queryKey: ["unread-messages", userId] }),
      ]);
      router.push(`/chat/${conversationId}`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not open chat");
    } finally {
      setOpeningMessage(false);
    }
  }

  function handleKeepBrowsing() {
    setMatchModalVisible(false);
    setMatchPartner(null);
  }

  if (!authReady || !profile) {
    return (
      <>
        <Stack.Screen options={{ headerRight: () => <MatchingHeaderActions /> }} />
        <View style={styles.centered}>
          {!authReady || session ? (
            <ScreenSpinner />
          ) : (
            <EmptyState
              title="Could not load your profile"
              description="We could not load your training profile. Try again before browsing partners."
              actionLabel="Try again"
              onAction={() => void refreshProfile()}
            />
          )}
        </View>
      </>
    );
  }

  if (!discoveryEnabled) {
    return (
      <>
        <Stack.Screen options={{ headerRight: () => <MatchingHeaderActions /> }} />
        <View style={styles.gated}>
          <FrennixLogo variant="full" height={34} style={styles.logo} />
          <EmptyState
            title="Training partner discovery is off"
            description="Turn on discovery in your training partner preferences to browse athletes who share your goals and workout style."
            actionLabel="Training partner preferences"
            onAction={() => pushScreen("/matching-settings")}
          />
        </View>
      </>
    );
  }

  if (!profileReady) {
    return (
      <>
        <Stack.Screen options={{ headerRight: () => <MatchingHeaderActions /> }} />
        <ScrollView contentContainerStyle={styles.gated}>
          <FrennixLogo variant="full" height={34} style={styles.logo} />
          <EmptyState
            title="Complete your training profile"
            description="Add your goals, workout styles, city, and gender before browsing training partners."
            actionLabel="Training partner preferences"
            onAction={() => pushScreen("/matching-settings")}
          />
          <TrainingPartnerReadinessCard profile={profile} compact />
        </ScrollView>
      </>
    );
  }

  if (isLoading && !deckInitialized) {
    return (
      <>
        <Stack.Screen options={{ headerRight: () => <MatchingHeaderActions /> }} />
        <View style={styles.centered}>
          <ScreenSpinner />
          <Text style={styles.loadingText}>Finding training partners…</Text>
        </View>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <Stack.Screen options={{ headerRight: () => <MatchingHeaderActions /> }} />
        <View style={styles.gated}>
          <FrennixLogo variant="full" height={34} style={styles.logo} />
          <EmptyState
            title="Could not load partners"
            description={getErrorMessage(error)}
            actionLabel="Try again"
            onAction={() => void handleRefresh()}
          />
        </View>
      </>
    );
  }

  if (!currentCandidate) {
    return (
      <>
        <Stack.Screen options={{ headerRight: () => <MatchingHeaderActions /> }} />
        <ScrollView
          contentContainerStyle={styles.gated}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void handleRefresh()}
              tintColor={colors.accent}
            />
          }
        >
          <FrennixLogo variant="full" height={34} style={styles.logo} />
          <EmptyState
            title="No training partners right now"
            description="Check back later as more athletes enable discovery, or update your training partner filters."
            actionLabel="Update preferences"
            onAction={() => pushScreen("/matching-settings")}
          />
          <Button
            title="View training matches"
            variant="secondary"
            onPress={() => pushScreen("/matching/matches")}
          />
          <Button
            title="Refresh deck"
            variant="ghost"
            onPress={() => void handleRefresh()}
            loading={isRefetching}
          />
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <MatchingHeaderActions /> }} />

      <View style={styles.screen}>
        <View style={styles.header}>
          <FrennixLogo variant="full" height={34} />
          <Text style={styles.headerHint}>
            {remainingCount > 0
              ? `${remainingCount + 1} athletes in your deck`
              : "Last athlete in your deck"}
          </Text>
        </View>

        <View style={styles.deckArea}>
          {deck[1] ? (
            <View style={styles.backCard} pointerEvents="none">
              <View style={styles.backCardInner} />
            </View>
          ) : null}

          <View style={styles.frontCard}>
            <TrainingPartnerCard candidate={currentCandidate} viewer={profile} />
          </View>
        </View>

        {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

        <TrainingPartnerDeckActions
          onSkip={() => void handleDecision("left")}
          onConnect={() => void handleDecision("right")}
          disabled={acting}
          loading={acting}
        />

        {acting ? (
          <Text style={styles.actingHint}>Saving your choice…</Text>
        ) : (
          <Text style={styles.actingHint}>Connect to train together · Skip to see the next athlete</Text>
        )}

        <ReportIssueLink area="training_partners" from="/matching" />
      </View>

      <TrainingMatchModal
        visible={matchModalVisible}
        partner={matchPartner}
        messaging={openingMessage}
        onSendMessage={() => void handleSendMessage()}
        onKeepBrowsing={handleKeepBrowsing}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  headerHint: { ...typography.caption, color: colors.textMuted },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginRight: 16,
  },
  logo: { alignSelf: "center", marginBottom: spacing.md },
  gated: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
    justifyContent: "center",
    gap: spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  loadingText: { ...typography.bodySmall, color: colors.textMuted },
  deckArea: {
    flex: 1,
    position: "relative",
    marginBottom: spacing.sm,
  },
  backCard: {
    ...StyleSheet.absoluteFillObject,
    top: 10,
    left: 8,
    right: 8,
    bottom: 0,
  },
  backCardInner: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    opacity: 0.55,
  },
  frontCard: {
    flex: 1,
  },
  error: {
    color: colors.danger,
    textAlign: "center",
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  actingHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 18,
  },
});
