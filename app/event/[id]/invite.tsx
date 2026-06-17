import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import {
  getErrorMessage,
  getEventAttendees,
  getEventInviteeIds,
  getFollowing,
  getWorkoutEvent,
  inviteToWorkoutEvent,
} from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { showAlert, showSuccess } from "@/lib/alerts";
import { EmptyState, UserRow, colors, spacing, typography } from "@frennix/ui";

export default function EventInviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const [invitingId, setInvitingId] = useState<string | null>(null);

  const { data: event } = useQuery({
    queryKey: ["workout-event", id, userId],
    queryFn: () => getWorkoutEvent(id!, userId),
    enabled: !!id && !!userId,
  });

  const { data: following = [], isLoading } = useQuery({
    queryKey: ["following", userId],
    queryFn: () => getFollowing(userId),
    enabled: !!userId,
  });

  const { data: invitedIds = [] } = useQuery({
    queryKey: ["event-invites", id, userId],
    queryFn: () => getEventInviteeIds(id!, userId),
    enabled: !!id && !!userId,
  });

  const { data: attendees = [] } = useQuery({
    queryKey: ["event-attendees", id],
    queryFn: () => getEventAttendees(id!),
    enabled: !!id,
  });

  const inviteMutation = useMutation({
    mutationFn: (inviteeId: string) => inviteToWorkoutEvent(id!, userId, inviteeId),
    onMutate: (inviteeId) => {
      setInvitingId(inviteeId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-invites", id, userId] });
      showSuccess("Invitation sent");
    },
    onError: (error) => showAlert("Invite failed", getErrorMessage(error)),
    onSettled: () => {
      setInvitingId(null);
    },
  });

  const invitedSet = new Set(invitedIds);
  const joinedSet = new Set(attendees.map((profile) => profile.id));

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>
        Invite athletes you follow to {event?.title ? `"${event.title}"` : "this workout event"}. They
        will receive a push notification instantly.
      </Text>

      <FlatList
        data={following}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title="No one to invite yet"
              description="Follow other athletes first, then come back to invite them to your event."
            />
          ) : null
        }
        renderItem={({ item }) => {
          const alreadyInvited = invitedSet.has(item.id);
          const alreadyJoined = joinedSet.has(item.id);

          return (
            <UserRow
              profile={item}
              subtitle={
                alreadyJoined ? "Already joined" : alreadyInvited ? "Invited" : undefined
              }
              actionLabel={alreadyInvited || alreadyJoined ? undefined : "Invite"}
              onAction={() => inviteMutation.mutate(item.id)}
              actionLoading={invitingId === item.id}
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  intro: {
    ...typography.bodySmall,
    color: colors.textMuted,
    lineHeight: 20,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  list: { flexGrow: 1, padding: spacing.md },
});
