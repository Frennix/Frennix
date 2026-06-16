import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { getWorkoutEvents } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { EmptyState, EventCard, colors, spacing, typography } from "@frennix/ui";

export default function EventsTabScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";

  const { data: events = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["workout-events", userId],
    queryFn: () => getWorkoutEvents(userId),
    enabled: !!userId,
  });

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Upcoming workouts</Text>
        <Pressable onPress={() => router.push("/create-event")} hitSlop={8}>
          <Text style={styles.createLink}>+ Create</Text>
        </Pressable>
      </View>

      <FlatList
        data={events}
        keyExtractor={(event) => event.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title="No upcoming events"
              description="Create a workout event and invite others to train together."
              actionLabel="Create event"
              onAction={() => router.push("/create-event")}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <EventCard event={item} onPress={() => router.push(`/event/${item.id}`)} />
        )}
      />
    </View>
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
  header: { ...typography.heading, fontSize: 22 },
  createLink: { ...typography.body, color: colors.accent, fontWeight: "700" },
  list: { padding: spacing.md, flexGrow: 1 },
});
