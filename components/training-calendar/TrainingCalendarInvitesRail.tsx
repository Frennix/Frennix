import { Pressable, StyleSheet, Text, View } from "react-native";
import type { TrainingSessionInvite } from "@frennix/types";
import { colors, spacing, typography } from "@frennix/ui";

type TrainingCalendarInvitesRailProps = {
  invites: TrainingSessionInvite[];
  loading?: boolean;
  onAccept: (invite: TrainingSessionInvite) => void;
  onDecline: (invite: TrainingSessionInvite) => void;
  onMaybeLater: (invite: TrainingSessionInvite) => void;
  onOpen: (invite: TrainingSessionInvite) => void;
};

export function TrainingCalendarInvitesRail({
  invites,
  loading,
  onAccept,
  onDecline,
  onMaybeLater,
  onOpen,
}: TrainingCalendarInvitesRailProps) {
  if (!invites.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Training invites</Text>
      {invites.map((invite) => {
        const name = invite.inviter?.display_name ?? "A training partner";
        const title = invite.session_title ?? "Workout session";

        return (
          <Pressable key={invite.id} style={styles.card} onPress={() => onOpen(invite)}>
            <View style={styles.meta}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.subtitle} numberOfLines={2}>
                {name} invited you to train
              </Text>
            </View>
            <View style={styles.actions}>
              <Pressable
                style={[styles.actionBtn, styles.acceptBtn]}
                disabled={loading}
                onPress={() => onAccept(invite)}
              >
                <Text style={styles.acceptText}>Accept</Text>
              </Pressable>
              <Pressable
                style={styles.actionBtn}
                disabled={loading}
                onPress={() => onMaybeLater(invite)}
              >
                <Text style={styles.actionText}>Later</Text>
              </Pressable>
              <Pressable
                style={styles.actionBtn}
                disabled={loading}
                onPress={() => onDecline(invite)}
              >
                <Text style={styles.declineText}>Decline</Text>
              </Pressable>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    width: "100%",
    maxWidth: "100%",
  },
  heading: {
    ...typography.body,
    color: colors.text,
    fontWeight: "800",
  },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    width: "100%",
    maxWidth: "100%",
  },
  meta: {
    gap: 2,
    minWidth: 0,
    flex: 1,
  },
  title: {
    ...typography.body,
    color: colors.text,
    fontWeight: "700",
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  actionBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  acceptBtn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  acceptText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "800",
  },
  actionText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "700",
  },
  declineText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "700",
  },
});
