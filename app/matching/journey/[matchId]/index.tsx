import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { frennixRefreshControlProps } from "@/lib/screen-shell";
import {
  getOrCreateConversation,
  getTrainingPartnershipJourney,
} from "@frennix/api";
import { FrennixMatchExplainerModal } from "@/components/FrennixMatchExplainerModal";
import { PartnershipLevelBadge } from "@/components/PartnershipLevelBadge";
import { PartnershipTimeline } from "@/components/PartnershipTimeline";
import { FrennixMatchDisplay } from "@/components/FrennixMatchDisplay";
import { useDeferNotificationOnboarding } from "@/lib/useDeferNotificationOnboarding";
import { pushScreen } from "@/lib/press-utils";
import { useAuth } from "@/providers/AuthProvider";
import {
  Avatar,
  Button,
  EmptyState,
  ScreenSpinner,
  colors,
  spacing,
  typography,
} from "@frennix/ui";

export default function TrainingPartnerJourneyScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const insets = useSafeAreaInsets();
  const [openingChat, setOpeningChat] = useState(false);
  const [explainerVisible, setExplainerVisible] = useState(false);

  useDeferNotificationOnboarding();

  const openFrennixMatchExplainer = useCallback(() => {
    setExplainerVisible(true);
  }, []);

  const journeyQuery = useQuery({
    queryKey: ["training-partnership-journey", matchId, userId],
    queryFn: () => getTrainingPartnershipJourney(matchId!, userId),
    enabled: Boolean(matchId && userId),
  });

  if (!matchId) {
    return (
      <>
        <Stack.Screen options={{ title: "Training Partner Journey" }} />
        <View style={styles.centered}>
          <EmptyState title="Journey unavailable" description="This training match could not be found." />
        </View>
      </>
    );
  }

  if (journeyQuery.isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: "Training Partner Journey" }} />
        <View style={styles.centered}>
          <ScreenSpinner />
        </View>
      </>
    );
  }

  if (journeyQuery.isError || !journeyQuery.data) {
    return (
      <>
        <Stack.Screen options={{ title: "Training Partner Journey" }} />
        <View style={styles.centered}>
          <EmptyState
            title="Could not load your journey"
            description={
              journeyQuery.error instanceof Error
                ? journeyQuery.error.message
                : "Try again in a moment."
            }
            actionLabel="Back to matches"
            onAction={() => pushScreen("/matching/matches")}
          />
        </View>
      </>
    );
  }

  const journey = journeyQuery.data;

  if (!journey.introCompleted) {
    router.replace(`/matching/journey/${matchId}/intro`);
    return null;
  }

  async function openChat() {
    if (!userId) return;
    setOpeningChat(true);
    try {
      const conversationId = await getOrCreateConversation(userId, journey.partner.id);
      router.push(`/chat/${conversationId}`);
    } finally {
      setOpeningChat(false);
    }
  }

  const score =
    journey.partnership.match_score_current ??
    journey.partnership.match_score_at_start ??
    null;

  const bottomInset = Math.max(insets.bottom, spacing.md);

  return (
    <>
      <Stack.Screen options={{ title: "Training Partner Journey" }} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomInset + spacing.xxl + spacing.lg },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={journeyQuery.isRefetching}
            onRefresh={() => void journeyQuery.refetch()}
            {...frennixRefreshControlProps}
          />
        }
      >
        <View style={styles.hero}>
          <Avatar uri={journey.partner.avatar_url} name={journey.partner.display_name} size={88} />
          <Text style={styles.partnerName}>{journey.partner.display_name}</Text>
          {journey.partner.username ? (
            <Text style={styles.username}>@{journey.partner.username}</Text>
          ) : null}
          {score != null && score > 0 ? (
            <FrennixMatchDisplay
              score={score}
              variant="compact"
              onLearnMore={openFrennixMatchExplainer}
            />
          ) : null}
        </View>

        <PartnershipLevelBadge level={journey.level} />

        {journey.nextLevel ? (
          <Text style={styles.progressHint}>
            {journey.nextLevel.emoji} Next up: {journey.nextLevel.label} — keep training, supporting,
            and showing up together.
          </Text>
        ) : (
          <Text style={styles.progressHint}>
            👑 You&apos;ve reached the highest partnership level. Keep building your story together.
          </Text>
        )}

        <PartnershipTimeline entries={journey.timeline} />

        <Button title="Message partner" onPress={() => void openChat()} loading={openingChat} />
        <Button
          title="Back to training matches"
          variant="secondary"
          onPress={() => pushScreen("/matching/matches")}
        />
      </ScrollView>

      <FrennixMatchExplainerModal
        visible={explainerVisible}
        onClose={() => setExplainerVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  content: {
    flexGrow: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  hero: { alignItems: "center", gap: spacing.sm },
  partnerName: { ...typography.heading, color: colors.text, textAlign: "center" },
  username: { ...typography.bodySmall, color: colors.textMuted },
  progressHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 22,
    textAlign: "center",
  },
});
