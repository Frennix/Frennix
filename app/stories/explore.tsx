import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  getProfileHighlights,
  getStoryDiscoveryLanes,
} from "@frennix/api";
import { STORY_HIGHLIGHT_PRESETS, STORY_WORKOUT_TAGS } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { stackBackOptions } from "@/lib/stack-navigation";
import { pushScreen } from "@/lib/press-utils";
import { Avatar, colors, formatRelativeTime, spacing, typography } from "@frennix/ui";
import { Stack } from "expo-router";

export default function StoryExploreScreen() {
  const { session, profile } = useAuth();
  const userId = session?.user.id ?? "";
  const locationHint = profile?.city ?? null;

  const { data: lanes = [], isLoading } = useQuery({
    queryKey: ["story-discovery-lanes", userId, locationHint],
    queryFn: () => getStoryDiscoveryLanes(userId, locationHint),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  const { data: highlights = [] } = useQuery({
    queryKey: ["profile-highlights", userId],
    queryFn: () => getProfileHighlights(userId),
    enabled: Boolean(userId),
  });

  return (
    <>
      <Stack.Screen options={stackBackOptions("Explore Stories")} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.lead}>
          Discover workouts, challenges, and training partners through Stories — separate from your feed.
        </Text>

        {isLoading ? (
          <Text style={styles.loading}>Loading discovery lanes…</Text>
        ) : lanes.length ? (
          lanes.map((lane) => (
            <View key={lane.id} style={styles.section}>
              <Text style={styles.sectionTitle}>{lane.title}</Text>
              <Text style={styles.sectionSubtitle}>{lane.subtitle}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lane}>
                {lane.items.map((item) => (
                  <Pressable
                    key={item.story.id}
                    style={styles.card}
                    onPress={() => router.push(`/user/${item.profile.username}`)}
                  >
                    <Avatar uri={item.profile.avatar_url} name={item.profile.display_name} size={56} />
                    <Text style={styles.cardName} numberOfLines={1}>
                      {item.profile.display_name}
                    </Text>
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      {item.story.workout_tag ?? "Story"} · {formatRelativeTime(item.story.created_at)}
                    </Text>
                    {item.view_count ? (
                      <Text style={styles.cardViews}>{item.view_count} views</Text>
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>No stories to discover yet. Check back after your community posts!</Text>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workout Categories</Text>
          <Text style={styles.sectionSubtitle}>Browse by training type</Text>
          <View style={styles.tagGrid}>
            {STORY_WORKOUT_TAGS.map((tag) => (
              <Pressable
                key={tag}
                style={styles.tagChip}
                onPress={() => pushScreen({ pathname: "/stories/discover", params: { tag } })}
              >
                <Text style={styles.tagChipText}>{tag}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {highlights.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Highlights</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lane}>
              {highlights.map((highlight) => (
                <View key={highlight.id} style={styles.highlightCard}>
                  <Text style={styles.highlightEmoji}>⭐</Text>
                  <Text style={styles.highlightTitle} numberOfLines={1}>
                    {highlight.title}
                  </Text>
                  <Text style={styles.highlightCount}>{highlight.story_ids.length} stories</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Story Highlights</Text>
            <Text style={styles.sectionSubtitle}>
              Pin favorites like {STORY_HIGHLIGHT_PRESETS.slice(0, 3).map((p) => p.title).join(", ")} on your profile.
            </Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  lead: {
    ...typography.body,
    color: colors.textMuted,
  },
  loading: {
    ...typography.body,
    color: colors.textMuted,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    paddingVertical: spacing.lg,
  },
  section: {
    gap: spacing.xs,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.text,
    fontWeight: "800",
  },
  sectionSubtitle: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  lane: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  card: {
    width: 120,
    padding: spacing.sm,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    gap: 4,
  },
  cardName: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "700",
    textAlign: "center",
  },
  cardMeta: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    fontSize: 10,
  },
  cardViews: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "700",
    fontSize: 10,
  },
  tagGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  tagChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagChipText: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "600",
  },
  highlightCard: {
    width: 96,
    alignItems: "center",
    gap: 4,
    padding: spacing.sm,
  },
  highlightEmoji: {
    fontSize: 40,
    lineHeight: 44,
  },
  highlightTitle: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "700",
    textAlign: "center",
  },
  highlightCount: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
});
