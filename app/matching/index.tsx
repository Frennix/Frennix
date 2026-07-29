import { AppIcon } from "@/components/AppIcon";
import { Stack, router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { frennixRefreshControlProps } from '@/lib/screen-shell';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  bootstrapTrainingPartnership,
  getErrorMessage,
  getMatchCandidates,
  resolveMatchCandidatesLoadDiagnostic,
  getTechnicalErrorMessage,
  recordMatchSwipe,
} from "@frennix/api";
import type { MatchCandidate } from "@frennix/types";
import { FrennixLogo } from "@/components/FrennixLogo";
import { TrainingPartnerDeckActions } from "@/components/TrainingMatchModal";
import { TrainingPartnerCard } from "@/components/TrainingPartnerCard";
import { FrennixMatchExplainerModal } from "@/components/FrennixMatchExplainerModal";
import { TrainingPartnerReadinessCard } from "@/components/TrainingPartnerReadinessCard";
import { TrainingPartnerDeckSafety } from "@/components/TrainingPartnerDeckSafety";
import { TrainingPartnerLoadDiagnosticPanel } from "@/components/TrainingPartnerLoadDiagnosticPanel";
import { ReportIssueLink } from "@/components/ReportIssueLink";
import { pushScreen } from "@/lib/press-utils";
import { logMatchmakingError } from "@/lib/matchmaking-observability";
import {
  trackMatchConnect,
  trackMatchDeckEmpty,
  trackMatchDeckLoaded,
  trackMatchSkip,
  trackMatchingDeckLoaded,
} from "@/lib/product-analytics";
import { useFeatureFlag } from "@/lib/useFeatureFlag";
import { hapticMatch } from "@/lib/haptics";
import { isTrainingPartnerDiscoveryReady } from "@/lib/training-partner-readiness";
import { isTrainingPartnerDiscoveryEnabled } from "@/lib/training-partner-discovery-toggle";
import { isTrainingPartnerLoadDiagnosticsVisible } from "@/lib/training-partner-load-diagnostics";
import { useAuth } from "@/providers/AuthProvider";
import { Button, EmptyState, ScreenSpinner, prefetchCachedImage, colors, spacing, typography } from "@frennix/ui";

function MatchingHeaderActions() {
  return (
    <View style={styles.headerActions}>
      <Pressable
        onPress={() => pushScreen("/matching/matches")}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="View training matches"
      >
        <AppIcon name="users" color={colors.text} size={22} />
      </Pressable>
      <Pressable
        onPress={() => pushScreen("/matching-settings")}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Training partner preferences"
      >
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
  const [matchExplainerVisible, setMatchExplainerVisible] = useState(false);

  const { enabled: matchmakingEnabled, isLoading: flagLoading } = useFeatureFlag(
    "training_matchmaking",
    true
  );
  const loadStartedAt = useRef(Date.now());
  const insets = useSafeAreaInsets();

  const discoveryEnabled = isTrainingPartnerDiscoveryEnabled(profile);
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
    if (!discoveryEnabled || isLoading || !deckInitialized) return;
    const durationMs = Date.now() - loadStartedAt.current;
    trackMatchingDeckLoaded(durationMs, deck.length);
    if (deck.length > 0) {
      trackMatchDeckLoaded(deck.length);
    }
  }, [deckInitialized, deck.length, discoveryEnabled, isLoading]);

  useEffect(() => {
    if (isError && error) {
      logMatchmakingError("match_candidates", error, {
        technical: getTechnicalErrorMessage(error),
        userId: userId.slice(0, 8),
      });
    }
  }, [isError, error, userId]);

  useEffect(() => {
    if (deckInitialized && !isLoading && discoveryEnabled && deck.length === 0 && !isError) {
      trackMatchDeckEmpty();
    }
  }, [deckInitialized, deck.length, discoveryEnabled, isError, isLoading]);

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

      if (direction === "left") {
        trackMatchSkip(currentCandidate.id, Math.max(deck.length - 1, 0));
      } else {
        trackMatchConnect(
          currentCandidate.id,
          Boolean(result.is_mutual && result.match),
          currentCandidate.match_score
        );
      }

      if (direction === "right" && result.is_mutual && result.match) {
        hapticMatch();
        await bootstrapTrainingPartnership(
          result.match.id,
          currentCandidate.match_score ?? null
        ).catch(() => undefined);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["training-matches", userId] }),
          queryClient.invalidateQueries({ queryKey: ["notifications", userId] }),
          queryClient.invalidateQueries({ queryKey: ["unread-notifications", userId] }),
          queryClient.invalidateQueries({
            queryKey: ["training-partnership-journey", result.match.id, userId],
          }),
        ]);
        const score =
          currentCandidate.match_score != null ? String(currentCandidate.match_score) : undefined;
        router.push({
          pathname: "/matching/journey/[matchId]/intro",
          params: { matchId: result.match.id, ...(score ? { score } : {}) },
        });
      }

      await advanceDeck();
    } catch (e) {
      logMatchmakingError("match_swipe", e, { partnerId: currentCandidate.id, direction });
      setActionError(e instanceof Error ? e.message : "Could not record your choice");
    } finally {
      setActing(false);
    }
  }

  if (!authReady || !profile || flagLoading) {
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

  if (!matchmakingEnabled) {
    return (
      <>
        <Stack.Screen options={{ headerRight: () => <MatchingHeaderActions /> }} />
        <View style={styles.gated}>
          <FrennixLogo variant="full" height={34} style={styles.logo} />
          <EmptyState
            title="Training partners temporarily unavailable"
            description="We are making improvements to training partner discovery. Please check back soon."
          />
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
    const diagnosticsEnabled = isTrainingPartnerLoadDiagnosticsVisible(profile, !!userId);
    const loadDiagnostic = diagnosticsEnabled
      ? resolveMatchCandidatesLoadDiagnostic(error)
      : null;
    const showLoadDiagnostic = diagnosticsEnabled && loadDiagnostic != null;

    return (
      <>
        <Stack.Screen options={{ headerRight: () => <MatchingHeaderActions /> }} />
        <ScrollView contentContainerStyle={styles.gated}>
          <FrennixLogo variant="full" height={34} style={styles.logo} />
          <EmptyState
            title="Could not load partners"
            description={getErrorMessage(error)}
            actionLabel="Try again"
            onAction={() => void handleRefresh()}
          />
          {showLoadDiagnostic ? (
            <TrainingPartnerLoadDiagnosticPanel diagnostic={loadDiagnostic} />
          ) : null}
        </ScrollView>
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
              onRefresh={() => void handleRefresh()} {...frennixRefreshControlProps}
            />
          }
        >
          <FrennixLogo variant="full" height={34} style={styles.logo} />
          <EmptyState
            title="No athletes match your filters yet"
            description="Try updating your training partner preferences, or check back as more athletes enable discovery."
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
            <TrainingPartnerCard
              candidate={currentCandidate}
              viewer={profile}
              onLearnMoreMatch={() => setMatchExplainerVisible(true)}
              accessibilityLabel={`Training partner ${currentCandidate.display_name}`}
            />
          </View>
        </View>

        <View
          style={[
            styles.deckFooter,
            { paddingBottom: Math.max(insets.bottom, spacing.md) },
          ]}
          testID="training-partner-deck-footer"
        >
          {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

          <TrainingPartnerDeckSafety
            userId={userId}
            partnerId={currentCandidate.id}
            partnerName={currentCandidate.display_name}
            onPartnerRemoved={() => void advanceDeck()}
          />

          <TrainingPartnerDeckActions
            onSkip={() => void handleDecision("left")}
            onConnect={() => void handleDecision("right")}
            disabled={acting}
            loading={acting}
          />

          {acting ? (
            <Text style={styles.actingHint}>Saving your choice…</Text>
          ) : (
            <Text style={styles.actingHint}>
              Connect to train together · Skip to see the next athlete
            </Text>
          )}

          <ReportIssueLink area="training_partners" from="/matching" />
        </View>
      </View>

      <FrennixMatchExplainerModal
        visible={matchExplainerVisible}
        onClose={() => setMatchExplainerVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
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
    minHeight: 0,
    position: "relative",
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
    minHeight: 0,
  },
  deckFooter: {
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: spacing.xs,
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
    lineHeight: 18,
  },
});
