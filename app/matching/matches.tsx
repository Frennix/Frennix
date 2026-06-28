import { AppIcon } from "@/components/AppIcon";
import { Stack, router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { frennixRefreshControlProps } from '@/lib/screen-shell';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getConversations,
  getErrorMessage,
  getMatches,
  getOrCreateConversation,
  removeTrainingMatch,
} from "@frennix/api";
import { FrennixLogo } from "@/components/FrennixLogo";
import { TrainingMatchRow } from "@/components/TrainingMatchRow";
import { enrichTrainingMatches } from "@/lib/training-match-rows";
import { confirmRemoveTrainingMatch, showAlert, showSuccess } from "@/lib/alerts";
import { logMatchmakingError } from "@/lib/matchmaking-observability";
import { pushScreen } from "@/lib/press-utils";
import { useProfilesPresence } from "@/lib/useProfilesPresence";
import { useAuth } from "@/providers/AuthProvider";
import { Button, EmptyState, colors, spacing, typography } from "@frennix/ui";

function DiscoveryHeaderButton() {
  return (
    <Pressable onPress={() => pushScreen("/matching")} hitSlop={8} style={styles.headerButton}>
      <AppIcon name="compass" color={colors.text} size={22} />
    </Pressable>
  );
}

export default function TrainingMatchesScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const [openingPartnerId, setOpeningPartnerId] = useState<string | null>(null);
  const [removingMatchId, setRemovingMatchId] = useState<string | null>(null);
  const [chatError, setChatError] = useState("");

  const {
    data: matches = [],
    isLoading: matchesLoading,
    isError: matchesError,
    error: matchesLoadError,
    refetch: refetchMatches,
    isRefetching: matchesRefetching,
  } = useQuery({
    queryKey: ["training-matches", userId],
    queryFn: () => getMatches(userId),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const {
    data: conversations = [],
    isLoading: conversationsLoading,
    refetch: refetchConversations,
    isRefetching: conversationsRefetching,
  } = useQuery({
    queryKey: ["conversations", userId],
    queryFn: () => getConversations(userId),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const removeMutation = useMutation({
    mutationFn: (matchId: string) => removeTrainingMatch(matchId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["training-matches", userId] }),
        queryClient.invalidateQueries({ queryKey: ["training-partner-candidates", userId] }),
      ]);
      showSuccess("Training match removed");
    },
    onError: (error) => {
      logMatchmakingError("match_remove", error);
      showAlert("Could not remove match", getErrorMessage(error));
    },
    onSettled: () => setRemovingMatchId(null),
  });

  const rows = useMemo(
    () => enrichTrainingMatches(matches, conversations),
    [matches, conversations]
  );

  const partnerIds = useMemo(
    () => rows.map((row) => row.other_user?.id).filter((id): id is string => Boolean(id)),
    [rows]
  );

  useProfilesPresence(userId, partnerIds);

  const isLoading = matchesLoading || conversationsLoading;
  const isRefetching = matchesRefetching || conversationsRefetching;
  const totalUnread = rows.reduce(
    (sum, row) => sum + (row.conversation?.unread_count ?? 0),
    0
  );

  const handleRefresh = useCallback(async () => {
    setChatError("");
    await Promise.all([refetchMatches(), refetchConversations()]);
  }, [refetchConversations, refetchMatches]);

  const handleOpenChat = useCallback(
    async (partnerId: string) => {
      if (!userId || openingPartnerId) return;

      setOpeningPartnerId(partnerId);
      setChatError("");

      try {
        const conversationId = await getOrCreateConversation(userId, partnerId);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["conversations", userId] }),
          queryClient.invalidateQueries({ queryKey: ["unread-messages", userId] }),
        ]);
        router.push(`/chat/${conversationId}`);
      } catch (e) {
        setChatError(e instanceof Error ? e.message : "Could not open chat");
      } finally {
        setOpeningPartnerId(null);
      }
    },
    [openingPartnerId, queryClient, userId]
  );

  const handleRemove = useCallback(
    (matchId: string, partnerName: string) => {
      if (removingMatchId || removeMutation.isPending) return;

      confirmRemoveTrainingMatch(partnerName, () => {
        setRemovingMatchId(matchId);
        removeMutation.mutate(matchId);
      });
    },
    [removeMutation, removingMatchId]
  );

  const renderItem = useCallback(
    ({ item }: { item: (typeof rows)[number] }) => (
      <TrainingMatchRow
        item={item}
        onOpenChat={handleOpenChat}
        onRemove={handleRemove}
        openingChat={openingPartnerId === item.other_user?.id}
        removing={removingMatchId === item.id}
      />
    ),
    [handleOpenChat, handleRemove, openingPartnerId, removingMatchId]
  );

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerRight: () => <DiscoveryHeaderButton /> }} />
        <View style={styles.centered}>
          <FrennixLogo variant="full" height={34} style={styles.logo} />
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading training matches…</Text>
        </View>
      </>
    );
  }

  if (matchesError) {
    return (
      <>
        <Stack.Screen options={{ headerRight: () => <DiscoveryHeaderButton /> }} />
        <View style={styles.emptyWrap}>
          <FrennixLogo variant="full" height={34} style={styles.logo} />
          <EmptyState
            title="Could not load training matches"
            description={
              matchesLoadError instanceof Error ? matchesLoadError.message : "Something went wrong"
            }
            actionLabel="Try again"
            onAction={() => void handleRefresh()}
          />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <DiscoveryHeaderButton /> }} />

      <View style={styles.container}>
        <View style={styles.brandHeader}>
          <FrennixLogo variant="full" height={34} />
          {totalUnread > 0 ? (
            <Text style={styles.unreadSummary}>
              {totalUnread} unread message{totalUnread === 1 ? "" : "s"}
            </Text>
          ) : (
            <Text style={styles.unreadSummaryMuted}>
              Connect with your training partners to plan workouts together
            </Text>
          )}
        </View>

        {chatError ? <Text style={styles.error}>{chatError}</Text> : null}

        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void handleRefresh()} {...frennixRefreshControlProps}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState
                title="No training matches yet"
                description="When you and another athlete both connect in the discovery deck, they will appear here so you can open chat and plan workouts."
                actionLabel="Find training partners"
                onAction={() => pushScreen("/matching")}
              />
              <Button
                title="Training partner preferences"
                variant="secondary"
                onPress={() => pushScreen("/matching-settings")}
              />
            </View>
          }
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  brandHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  unreadSummary: { ...typography.caption, color: colors.accent, fontWeight: "600" },
  unreadSummaryMuted: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  list: { paddingHorizontal: spacing.lg, flexGrow: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    gap: spacing.md,
    padding: spacing.xl,
  },
  emptyWrap: {
    flexGrow: 1,
    justifyContent: "center",
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  logo: { marginBottom: spacing.sm },
  loadingText: { ...typography.bodySmall, color: colors.textMuted },
  error: {
    color: colors.danger,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    fontSize: 14,
  },
  headerButton: { marginRight: 16 },
});
