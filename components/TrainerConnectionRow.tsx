import { Pressable, StyleSheet, Text, View } from "react-native";
import type { TrainerConnection, TrainerVerificationLevel } from "@frennix/types";
import { TrainerBadge } from "@/components/TrainerBadge";
import { Avatar, Button, colors, spacing, typography } from "@frennix/ui";

type TrainerConnectionRowProps = {
  connection: TrainerConnection & { trainer_verification_level?: string | null };
  viewerId: string;
  onAccept?: () => void;
  onDecline?: () => void;
  onMessage?: () => void;
  onRemove?: () => void;
  onViewProfile?: () => void;
  loading?: boolean;
};

export function TrainerConnectionRow({
  connection,
  viewerId,
  onAccept,
  onDecline,
  onMessage,
  onRemove,
  onViewProfile,
  loading,
}: TrainerConnectionRowProps) {
  const isTrainer = viewerId === connection.trainer_id;
  const other = isTrainer ? connection.client : connection.trainer;
  const otherName = other?.display_name ?? "Athlete";
  const verification = (connection.trainer_verification_level ??
    "trainer") as TrainerVerificationLevel;

  return (
    <View style={styles.row}>
      <Pressable style={styles.main} onPress={onViewProfile}>
        <Avatar uri={other?.avatar_url} name={otherName} size={52} />
        <View style={styles.content}>
          <Text style={styles.name}>{otherName}</Text>
          {!isTrainer ? <TrainerBadge level={verification} compact /> : null}
          <Text style={styles.status}>
            {connection.status === "pending"
              ? isTrainer
                ? "Coaching request"
                : "Request sent"
              : "Connected"}
          </Text>
          {connection.intro_message ? (
            <Text style={styles.intro} numberOfLines={2}>
              {connection.intro_message}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.actions}>
        {connection.status === "pending" && isTrainer ? (
          <>
            <Button title="Accept" onPress={onAccept} loading={loading} />
            <Button title="Decline" variant="secondary" onPress={onDecline} disabled={loading} />
          </>
        ) : null}
        {connection.status === "connected" ? (
          <Button title="Message" onPress={onMessage} loading={loading} />
        ) : null}
        {onRemove ? (
          <Pressable onPress={onRemove} disabled={loading}>
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  main: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  content: {
    flex: 1,
    gap: 4,
  },
  name: {
    ...typography.body,
    fontWeight: "700",
  },
  status: {
    ...typography.caption,
    color: colors.textMuted,
  },
  intro: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontStyle: "italic",
  },
  actions: {
    gap: spacing.xs,
  },
  remove: {
    ...typography.caption,
    color: colors.danger,
    textAlign: "center",
    paddingVertical: spacing.xs,
  },
});
