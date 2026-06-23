import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import {
  getTrainerProfileByUsername,
  requestTrainerConnection,
  startTrainerConversation,
} from "@frennix/api";
import { TrainerProfileView } from "@/components/TrainerProfileView";
import { TrainerBadge } from "@/components/TrainerBadge";
import { DetailLoading } from "@/components/DetailLoading";
import { showAlert } from "@/lib/alerts";
import { pushScreen } from "@/lib/press-utils";
import { useAuth } from "@/providers/AuthProvider";
import { Button, EmptyState, Input, colors, spacing, typography } from "@frennix/ui";

export default function TrainerPublicProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { session, profile: viewerProfile } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const [introMessage, setIntroMessage] = useState("");
  const [showIntro, setShowIntro] = useState(false);

  const { data: bundle, isLoading } = useQuery({
    queryKey: ["trainer-profile", username, userId],
    queryFn: () => getTrainerProfileByUsername(username!),
    enabled: !!username,
  });

  const isSelf = bundle?.profile.id === userId;
  const connection = bundle?.connection ?? null;
  const isConnected = connection?.status === "connected";
  const isPending = connection?.status === "pending";

  const connectMutation = useMutation({
    mutationFn: () => requestTrainerConnection(bundle!.profile.id, introMessage.trim() || undefined),
    onSuccess: async () => {
      setShowIntro(false);
      await queryClient.invalidateQueries({ queryKey: ["trainer-profile", username, userId] });
      await queryClient.invalidateQueries({ queryKey: ["trainer-connections", userId] });
      showAlert("Request sent", "The trainer will review your coaching request.");
    },
    onError: (e) => showAlert("Request failed", e instanceof Error ? e.message : "Could not connect"),
  });

  const messageMutation = useMutation({
    mutationFn: () => startTrainerConversation(bundle!.profile.id),
    onSuccess: (conversationId) => pushScreen(`/chat/${conversationId}`),
    onError: (e) => showAlert("Message failed", e instanceof Error ? e.message : "Could not open chat"),
  });

  if (isLoading) return <DetailLoading />;
  if (!bundle) {
    return (
      <EmptyState
        title="Trainer not found"
        description="This coach profile may be private or no longer available."
      />
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: bundle.profile.display_name,
          headerRight: () => (
            <View style={styles.headerBadge}>
              <TrainerBadge level={bundle.trainer.verification_level} compact />
            </View>
          ),
        }}
      />

      <View style={styles.body}>
        <TrainerProfileView bundle={bundle} />
      </View>

      {!isSelf ? (
        <View style={styles.footer}>
          {isConnected ? (
            <Button
              title="Message coach"
              onPress={() => messageMutation.mutate()}
              loading={messageMutation.isPending}
            />
          ) : isPending ? (
            <Text style={styles.pending}>Coaching request pending</Text>
          ) : showIntro ? (
            <View style={styles.introBlock}>
              <Input
                label="Intro message (optional)"
                value={introMessage}
                onChangeText={setIntroMessage}
                multiline
                placeholder="Share your goals and what you're looking for"
              />
              <Button
                title="Send coaching request"
                onPress={() => connectMutation.mutate()}
                loading={connectMutation.isPending}
              />
              <Button title="Cancel" variant="secondary" onPress={() => setShowIntro(false)} />
            </View>
          ) : (
            <Button title="Request to connect" onPress={() => setShowIntro(true)} />
          )}
          {!viewerProfile?.is_trainer ? null : (
            <Text style={styles.dualRoleHint}>You can be both an athlete and a trainer on Frennix.</Text>
          )}
        </View>
      ) : (
        <View style={styles.footer}>
          <Button title="Edit trainer profile" onPress={() => pushScreen("/trainer-profile/edit")} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1 },
  headerBadge: { marginRight: spacing.md },
  footer: {
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  introBlock: { gap: spacing.sm },
  pending: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: spacing.sm,
  },
  dualRoleHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
  },
});
