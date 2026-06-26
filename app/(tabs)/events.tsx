import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getErrorMessage, getWorkoutEvents } from "@frennix/api";
import type { WorkoutEvent } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { ReportIssueLink } from "@/components/ReportIssueLink";
import { scrollFlatListToTop, handleTabRetap } from "@/lib/tab-scroll-registry";
import { useScrollAtTop } from "@/lib/useScrollAtTop";
import { useTabScrollRegistration } from "@/lib/useTabScrollRegistration";
import { EmptyState, EventCard, colors, spacing, typography } from "@frennix/ui";

export default function EventsTabScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const listRef = useRef<FlatList<WorkoutEvent>>(null);
  const { onScroll, isAtTop } = useScrollAtTop();

  const { data: events = [], isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["workout-events", userId],
    queryFn: () => getWorkoutEvents(userId),
    enabled: !!userId,
    staleTime: 120_000,
    placeholderData: (previousData) => previousData,
  });

  useTabScrollRegistration(
    "events",
    useCallback(
      () =>
        handleTabRetap({
          isAtTop,
          scrollToTop: () => scrollFlatListToTop(listRef.current),
          refresh: () => {
            void refetch();
          },
        }),
      [isAtTop, refetch]
    )
  );

  if (!userId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Sign in to view events.</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (isError) {
    const message = getErrorMessage(error);
    console.error("[events] failed to load workout events", error);
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Could not load events</Text>
        <Text style={styles.errorText}>{message}</Text>
        <Pressable onPress={() => refetch()} style={styles.retryButton}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Upcoming workouts</Text>
        <Pressable onPress={() => router.push("/create-event")} hitSlop={8}>
          <Text style={styles.createLink}>+ Create</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={events}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(event) => event.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          <EmptyState
            title="No upcoming events"
            description="Create a workout event and invite others to train together."
            actionLabel="Create event"
            onAction={() => router.push("/create-event")}
          />
        }
        ListFooterComponent={<ReportIssueLink area="events" from="/(tabs)/events" />}
        renderItem={({ item }) => (
          <EventCard event={item} onPress={() => router.push(`/event/${item.id}`)} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorTitle: { ...typography.heading, fontSize: 20, textAlign: "center" },
  errorText: { ...typography.bodySmall, color: colors.textSecondary, textAlign: "center" },
  retryButton: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.accent,
  },
  retryText: { ...typography.body, color: colors.background, fontWeight: "700" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  header: { ...typography.heading, fontSize: 22 },
  createLink: { ...typography.body, color: colors.accent, fontWeight: "700" },
  list: { padding: spacing.md, flexGrow: 1 },
});
