import { Stack, router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  bootstrapTrainingPartnership,
  completeTrainingPartnershipIntro,
  getTrainingPartnershipJourney,
} from "@frennix/api";
import { FrennixLogo } from "@/components/FrennixLogo";
import { PartnershipLevelBadge } from "@/components/PartnershipLevelBadge";
import { pushScreen } from "@/lib/press-utils";
import { useAuth } from "@/providers/AuthProvider";
import { Avatar, Button, EmptyState, ScreenSpinner, colors, spacing, typography } from "@frennix/ui";

export default function TrainingPartnerJourneyIntroScreen() {
  const { matchId, score } = useLocalSearchParams<{ matchId: string; score?: string }>();
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const matchScore = score ? Number(score) : null;

  const journeyQuery = useQuery({
    queryKey: ["training-partnership-journey", matchId, userId],
    queryFn: async () => {
      if (!matchId || !userId) throw new Error("Missing match");
      await bootstrapTrainingPartnership(
        matchId,
        Number.isFinite(matchScore) ? matchScore : null
      );
      return getTrainingPartnershipJourney(matchId, userId);
    },
    enabled: Boolean(matchId && userId),
  });

  const completeIntro = useMutation({
    mutationFn: () => completeTrainingPartnershipIntro(matchId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["training-partnership-journey", matchId, userId],
      });
      router.replace(`/matching/journey/${matchId}`);
    },
  });

  if (!matchId) {
    return (
      <>
        <Stack.Screen options={{ title: "Your Training Partner Journey Begins" }} />
        <View style={styles.centered}>
          <EmptyState title="Journey unavailable" description="This training match could not be found." />
        </View>
      </>
    );
  }

  if (journeyQuery.isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: "Your Training Partner Journey Begins" }} />
        <View style={styles.centered}>
          <ScreenSpinner />
        </View>
      </>
    );
  }

  if (journeyQuery.isError || !journeyQuery.data) {
    return (
      <>
        <Stack.Screen options={{ title: "Your Training Partner Journey Begins" }} />
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
  if (journey.introCompleted) {
    router.replace(`/matching/journey/${matchId}`);
    return null;
  }

  return (
    <>
      <Stack.Screen options={{ title: "Your Training Partner Journey" }} />
      <ScrollView contentContainerStyle={styles.content}>
        <FrennixLogo variant="icon" height={36} style={styles.logo} />

        <View style={styles.hero}>
          <Avatar uri={journey.partner.avatar_url} name={journey.partner.display_name} size={96} />
          <Text style={styles.title}>Your Training Partner Journey Begins</Text>
          <Text style={styles.lead}>🎉 You&apos;re officially Training Partners!</Text>
        </View>

        <PartnershipLevelBadge level={journey.level} />

        <Text style={styles.body}>
          Every workout, challenge, event, and milestone you complete together will strengthen
          your partnership and help your Frennix Match evolve over time.
        </Text>

        <Button
          title="Start Your Journey"
          onPress={() => completeIntro.mutate()}
          loading={completeIntro.isPending}
          style={styles.primaryAction}
        />

        <Button
          title="Keep browsing partners"
          variant="ghost"
          onPress={() => router.replace("/matching")}
        />
      </ScrollView>
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
  logo: { alignSelf: "center" },
  hero: { alignItems: "center", gap: spacing.md },
  title: {
    ...typography.heading,
    fontSize: 26,
    textAlign: "center",
    color: colors.text,
    lineHeight: 32,
  },
  lead: {
    ...typography.body,
    textAlign: "center",
    color: colors.textSecondary,
    lineHeight: 24,
  },
  body: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
  },
  primaryAction: { marginTop: spacing.sm },
});
