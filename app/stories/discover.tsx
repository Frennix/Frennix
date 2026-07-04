import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { getStoriesByLocation, getStoriesByWorkoutTag } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { stackBackOptions } from "@/lib/stack-navigation";
import { Avatar, colors, formatRelativeTime, spacing, typography } from "@frennix/ui";

function paramValue(value: string | string[] | undefined): string | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default function StoryDiscoverScreen() {
  const params = useLocalSearchParams<{ tag?: string; location?: string }>();
  const tag = paramValue(params.tag);
  const location = paramValue(params.location);
  const { session } = useAuth();
  const userId = session?.user.id ?? "";

  const mode = tag ? "tag" : "location";
  const label = tag ?? location ?? "Stories";

  const { data = [], isLoading } = useQuery({
    queryKey: ["story-discover", mode, label, userId],
    queryFn: () =>
      tag
        ? getStoriesByWorkoutTag(userId, tag)
        : getStoriesByLocation(userId, location ?? ""),
    enabled: !!userId && !!label,
  });

  return (
    <>
      <Stack.Screen options={stackBackOptions(`Stories: ${label}`)} />
      <FlatList
        contentContainerStyle={styles.content}
        data={data}
        keyExtractor={(item) => item.story.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {isLoading ? "Loading stories…" : "No active stories yet"}
            </Text>
            <Text style={styles.emptyBody}>
              Check back soon for more {tag ? `${tag} workouts` : `stories near ${location}`}.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Avatar uri={item.profile.avatar_url} name={item.profile.display_name} size={48} />
            <View style={styles.meta}>
              <Text style={styles.name}>{item.profile.display_name}</Text>
              <Text style={styles.subtitle}>
                @{item.profile.username} · {formatRelativeTime(item.story.created_at)}
              </Text>
              {item.story.workout_tag ? (
                <Text style={styles.tag}>#{item.story.workout_tag}</Text>
              ) : null}
            </View>
          </View>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typography.body,
    color: colors.text,
    fontWeight: "700",
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  tag: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "700",
  },
  empty: {
    padding: spacing.xl,
    gap: spacing.sm,
    alignItems: "center",
  },
  emptyTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: "700",
  },
  emptyBody: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: "center",
  },
});
