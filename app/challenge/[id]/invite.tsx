import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import {
  getChallenge,
  getChallengeInviteCandidates,
  getChallengeInvitationsByInviter,
  getChallengeParticipants,
  getErrorMessage,
  inviteToChallenge,
} from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { showAlert, showSuccess } from "@/lib/alerts";
import { isChallengeClosed } from "@/lib/challenge-actions";
import { EmptyState, UserRow, colors, spacing, typography } from "@frennix/ui";

export default function ChallengeInviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const [invitingId, setInvitingId] = useState<string | null>(null);

  const { data: challenge, isLoading: challengeLoading } = useQuery({
    queryKey: ["challenge", id],
    queryFn: () => getChallenge(id!),
    enabled: !!id,
  });

  const closed = challenge ? isChallengeClosed(challenge) : false;

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["challenge-invite-candidates", userId],
    queryFn: () => getChallengeInviteCandidates(userId),
    enabled: !!userId,
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ["challenge-invites", id, userId],
    queryFn: () => getChallengeInvitationsByInviter(id!, userId),
    enabled: !!id && !!userId,
  });

  const { data: participants = [] } = useQuery({
    queryKey: ["challenge-participants", id],
    queryFn: () => getChallengeParticipants(id!),
    enabled: !!id,
  });

  const inviteMutation = useMutation({
    mutationFn: (inviteeId: string) => inviteToChallenge(id!, userId, inviteeId),
    onMutate: (inviteeId) => {
      setInvitingId(inviteeId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["challenge-invites", id, userId] });
      showSuccess("Invitation sent");
    },
    onError: (error) => showAlert("Invite failed", getErrorMessage(error)),
    onSettled: () => {
      setInvitingId(null);
    },
  });

  const invitationByInvitee = useMemo(() => {
    const map = new Map<string, (typeof invitations)[number]>();
    for (const invite of invitations) {
      map.set(invite.invitee_id, invite);
    }
    return map;
  }, [invitations]);

  const joinedSet = useMemo(
    () => new Set(participants.map((entry) => entry.user_id)),
    [participants]
  );

  return (
    <View style={styles.container}>
      {closed ? (
        <EmptyState
          title="Challenge ended"
          description="Invites are only available for active challenges."
        />
      ) : (
        <>
      <Text style={styles.intro}>
        Invite followers, people you follow, and training partners to{" "}
        {challenge?.title ? `"${challenge.title}"` : "this challenge"}. They will get an in-app
        notification and can tap to open the challenge.
      </Text>

      <FlatList
        data={candidates}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !isLoading && !challengeLoading ? (
            <EmptyState
              title="No one to invite yet"
              description="Follow athletes or connect as training partners, then come back to invite them."
            />
          ) : null
        }
        renderItem={({ item }) => {
          const invitation = invitationByInvitee.get(item.id);
          const alreadyJoined = joinedSet.has(item.id);
          const isPending = invitingId === item.id;
          const alreadyInvited = invitation?.status === "pending";

          let subtitle: string | undefined;
          if (alreadyJoined) subtitle = "Joined";
          else if (isPending) subtitle = "Pending";
          else if (alreadyInvited) subtitle = "Invited";

          return (
            <UserRow
              profile={item}
              subtitle={subtitle}
              actionLabel={alreadyInvited || alreadyJoined || isPending ? undefined : "Invite"}
              onAction={() => inviteMutation.mutate(item.id)}
              actionLoading={isPending}
            />
          );
        }}
      />
        </>
      )}
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
