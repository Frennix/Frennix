import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { getChallenge, joinChallenge, isChallengeParticipant } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { Button, colors, spacing, typography } from "@frennix/ui";

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();

  const { data: challenge } = useQuery({
    queryKey: ["challenge", id],
    queryFn: () => getChallenge(id!),
    enabled: !!id,
  });

  const { data: joined } = useQuery({
    queryKey: ["challenge-joined", id, userId],
    queryFn: () => isChallengeParticipant(id!, userId),
    enabled: !!id && !!userId,
  });

  const joinMutation = useMutation({
    mutationFn: () => joinChallenge(id!, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["challenge-joined"] }),
  });

  if (!challenge) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{challenge.title}</Text>
      {challenge.description ? <Text style={styles.desc}>{challenge.description}</Text> : null}
      <Text style={styles.dates}>
        {new Date(challenge.start_date).toLocaleDateString()} – {new Date(challenge.end_date).toLocaleDateString()}
      </Text>
      <Text style={styles.participants}>{challenge.participant_count} participants</Text>

      {!joined ? (
        <Button title="Join challenge" onPress={() => joinMutation.mutate()} loading={joinMutation.isPending} />
      ) : (
        <Text style={styles.joined}>You're in! Stay accountable and check in daily.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, gap: spacing.md },
  title: { ...typography.title },
  desc: { ...typography.body, lineHeight: 24 },
  dates: { color: colors.accent, fontWeight: "600" },
  participants: { ...typography.caption },
  joined: { ...typography.body, color: colors.accent },
});
