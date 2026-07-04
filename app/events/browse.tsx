import { useQuery } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useCallback, useRef } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { getErrorMessage, getWorkoutEvents } from "@frennix/api";
import type { WorkoutEvent } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { stackBackOptions } from "@/lib/stack-navigation";
import { useGuardedRefresh } from "@/lib/useGuardedRefresh";
import { frennixRefreshControlProps } from "@/lib/screen-shell";
import { EventListSkeleton } from "@/components/EventListSkeleton";
import { EmptyState, EventCard, QueryErrorState, colors, spacing, typography } from "@frennix/ui";

export default function EventsBrowseScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const listRef = useRef<FlatList<WorkoutEvent>>(null);

  const { data: events = [], isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["workout-events", userId],
    queryFn: () => getWorkoutEvents(userId),
    enabled: !!userId,
    staleTime: 120_000,
  });

  const onRefresh = useGuardedRefresh(
    useCallback(() => refetch(), [refetch]),
    { errorTitle: "Could not refresh events", haptic: true }
  );

  return (
    <>
      <Stack.Screen options={stackBackOptions("Community Events")} />
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.header}>Upcoming community events</Text>
          <Pressable onPress={() => router.push("/create-event")} hitSlop={8}>
            <Text style={styles.createLink}>+ Create</Text>
          </Pressable>
        </View>

        {isLoading && events.length === 0 ? (
          <EventListSkeleton />
        ) : isError && events.length === 0 ? (
          <QueryErrorState
            title="Could not load events"
            message={getErrorMessage(error)}
            onRetry={() => void refetch()}
          />
        ) : (
          <FlatList
            ref={listRef}
            data={events}
            keyExtractor={(event) => event.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={() => void onRefresh()}
                {...frennixRefreshControlProps}
              />
            }
            ListEmptyComponent={
              <EmptyState
                title="No upcoming events"
                description="Create a workout event and invite others to train together."
                actionLabel="Create event"
                onAction={() => router.push("/create-event")}
              />
            }
            renderItem={({ item }) => (
              <EventCard event={item} onPress={() => router.push(`/event/${item.id}`)} />
            )}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  header: { ...typography.section },
  createLink: { ...typography.body, color: colors.accent, fontWeight: "700" },
  list: { padding: spacing.md, flexGrow: 1 },
});
