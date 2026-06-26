import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  getErrorMessage,
  getEventAttendees,
  getEventPosts,
  getWorkoutEvent,
  joinWorkoutEvent,
  leaveWorkoutEvent,
} from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { usePostActions } from "@/lib/usePostActions";
import { useEventActions } from "@/lib/useEventActions";
import { useSharePost } from "@/lib/useSharePost";
import { useSavePost } from "@/lib/useSavePost";
import { DetailLoading } from "@/components/DetailLoading";
import { showAlert, showSuccess } from "@/lib/alerts";
import { refetchQueryKeys } from "@/lib/refreshQueries";
import { formatActivity } from "@/lib/labels";
import {
  Avatar,
  Button,
  EmptyState,
  PostCard,
  getSharedPostTargetId,
  UserRow,
  colors,
  radius,
  spacing,
  typography,
} from "@frennix/ui";
import { formatWorkoutTypeLabel, workoutTypeEmoji } from "@frennix/ui";

function formatEventDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ["workout-event", id, userId],
    queryFn: () => getWorkoutEvent(id!, userId),
    enabled: !!id && !!userId,
  });

  const { openShare, shareSheet } = useSharePost(userId);
  const { openPostActions, postActionSheets } = usePostActions({
    userId,
    onShareInApp: (post) => openShare(post.shared_post ?? post),
  });
  const { toggleSavePost } = useSavePost(userId);

  const { openEventActions, eventActionSheets } = useEventActions({
    userId,
    event,
    onCancelled: () => router.back(),
  });

  const { data: attendees = [] } = useQuery({
    queryKey: ["event-attendees", id],
    queryFn: () => getEventAttendees(id!),
    enabled: !!id,
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["event-posts", id],
    queryFn: () => getEventPosts(id!, userId),
    enabled: !!id,
  });

  const joinMutation = useMutation({
    mutationFn: () => joinWorkoutEvent(id!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-event", id] });
      queryClient.invalidateQueries({ queryKey: ["workout-events"] });
      queryClient.invalidateQueries({ queryKey: ["event-attendees", id] });
      queryClient.invalidateQueries({ queryKey: ["profile-stats"] });
      showSuccess("You joined this event");
    },
    onError: (e) => showAlert("Could not join", getErrorMessage(e)),
  });

  const leaveMutation = useMutation({
    mutationFn: () => leaveWorkoutEvent(id!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-event", id] });
      queryClient.invalidateQueries({ queryKey: ["workout-events"] });
      queryClient.invalidateQueries({ queryKey: ["event-attendees", id] });
      queryClient.invalidateQueries({ queryKey: ["profile-stats"] });
    },
    onError: (e) => showAlert("Could not leave", getErrorMessage(e)),
  });

  const onRefresh = useCallback(async () => {
    if (!id) return;
    setRefreshing(true);
    try {
      await refetchQueryKeys(queryClient, [
        ["workout-event", id, userId],
        ["event-attendees", id],
        ["event-posts", id],
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [id, userId, queryClient]);

  if (eventLoading) return <DetailLoading />;
  if (!event) {
    return (
      <View style={styles.notFound}>
        <EmptyState
          title="Event not found"
          description="This event may have been cancelled or removed."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const isCreator = event.created_by === userId;
  const isCancelled = event.status === "cancelled";
  const attendeeCount = event.attendee_count ?? 0;
  const maxLabel =
    event.max_attendees != null
      ? `${attendeeCount}/${event.max_attendees} attendees`
      : `${attendeeCount} attendee${attendeeCount === 1 ? "" : "s"}`;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
    >
      {postActionSheets}
      {eventActionSheets}
      {shareSheet}

      {isCancelled ? (
        <View style={styles.cancelledBanner}>
          <Text style={styles.cancelledText}>This event was cancelled</Text>
        </View>
      ) : null}

      <View style={styles.hero}>
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.emoji}>
              {event.workout_type ? workoutTypeEmoji(event.workout_type) : "🏅"}
            </Text>
            <Text style={styles.title}>{event.title}</Text>
          </View>
          {userId ? (
            <Pressable
              style={styles.menuButton}
              onPress={openEventActions}
              hitSlop={8}
              accessibilityLabel="Event options"
            >
              <Text style={styles.menuIcon}>⋯</Text>
            </Pressable>
          ) : null}
        </View>
        {event.workout_type ? (
          <Text style={styles.workoutType}>{formatWorkoutTypeLabel(event.workout_type)}</Text>
        ) : null}
      </View>

      <View style={styles.metaCard}>
        <Text style={styles.metaLabel}>When</Text>
        <Text style={styles.metaValue}>{formatEventDateTime(event.starts_at)}</Text>
        {event.location ? (
          <>
            <Text style={[styles.metaLabel, styles.metaSpacing]}>Location</Text>
            <Text style={styles.metaValue}>{event.location}</Text>
          </>
        ) : null}
        <Text style={[styles.metaLabel, styles.metaSpacing]}>Attendees</Text>
        <Text style={styles.metaValue}>{maxLabel}</Text>
      </View>

      {event.description ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.description}>{event.description}</Text>
        </View>
      ) : null}

      {event.creator ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hosted by</Text>
          <View style={styles.hostRow}>
            <Avatar uri={event.creator.avatar_url} name={event.creator.display_name} size={44} />
            <View>
              <Text style={styles.hostName}>{event.creator.display_name}</Text>
              <Text style={styles.hostUsername}>@{event.creator.username}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {!isCancelled && !isCreator ? (
        <Button
          title={event.joined_by_me ? "Leave event" : event.is_full ? "Event full" : "Join event"}
          variant={event.joined_by_me ? "secondary" : "primary"}
          onPress={() =>
            event.joined_by_me ? leaveMutation.mutate() : joinMutation.mutate()
          }
          loading={joinMutation.isPending || leaveMutation.isPending}
          disabled={!event.joined_by_me && !!event.is_full}
        />
      ) : null}

      {!isCancelled && (event.joined_by_me || isCreator) ? (
        <Button
          title="Share post"
          variant="secondary"
          onPress={() =>
            router.push({ pathname: "/create-post", params: { eventId: id! } })
          }
        />
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Event feed</Text>
        {posts.length ? (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              isOwn={post.author_id === userId}
              onPress={() => router.push(`/post/${getSharedPostTargetId(post)}`)}
              onOwnerActionsPress={() => openPostActions(post)}
              onShare={() => openShare(post.shared_post ?? post)}
              onSave={() => toggleSavePost(post.id, !!post.saved_by_me)}
              onModerationPress={() => openPostActions(post)}
            />
          ))
        ) : (
          <EmptyState
            title="No posts yet"
            description="Share a workout photo or update with other attendees."
            actionLabel={
              !isCancelled && (event.joined_by_me || isCreator) ? "Share post" : undefined
            }
            onAction={
              !isCancelled && (event.joined_by_me || isCreator)
                ? () => router.push({ pathname: "/create-post", params: { eventId: id! } })
                : undefined
            }
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Attendees</Text>
        {attendees.length ? (
          attendees.map((profile) => (
            <UserRow
              key={profile.id}
              profile={profile}
              subtitle={
                profile.activities?.length
                  ? profile.activities.slice(0, 2).map(formatActivity).join(" · ")
                  : undefined
              }
              onPress={() => router.push(`/user/${profile.username}`)}
            />
          ))
        ) : (
          <EmptyState
            title="No attendees yet"
            description="Be the first to join and train together."
            actionLabel={!isCancelled && !isCreator && !event.is_full ? "Join event" : undefined}
            onAction={
              !isCancelled && !isCreator && !event.is_full
                ? () => joinMutation.mutate()
                : undefined
            }
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  cancelledBanner: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  cancelledText: { ...typography.body, color: colors.textMuted, textAlign: "center" },
  hero: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.sm },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    width: "100%",
    gap: spacing.sm,
  },
  titleBlock: { flex: 1, alignItems: "center", gap: spacing.xs },
  emoji: { fontSize: 40 },
  title: { ...typography.title, fontSize: 26, textAlign: "center", color: colors.text },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuIcon: { fontSize: 22, lineHeight: 24, color: colors.textSecondary, fontWeight: "700" },
  workoutType: { ...typography.body, color: colors.accent, fontWeight: "600" },
  metaCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  metaLabel: { ...typography.caption, color: colors.textMuted },
  metaSpacing: { marginTop: spacing.sm },
  metaValue: { ...typography.body, color: colors.text, marginTop: 2 },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: { ...typography.body, fontWeight: "700", color: colors.text },
  description: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  hostRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  hostName: { ...typography.body, fontWeight: "600", color: colors.text },
  hostUsername: { ...typography.caption, color: colors.textMuted },
  notFound: { flex: 1, backgroundColor: colors.background, justifyContent: "center" },
});
