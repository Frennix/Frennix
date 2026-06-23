import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { Profile } from "@frennix/types";
import { FrennixLogo } from "@/components/FrennixLogo";
import { Avatar, Button, colors, spacing, typography } from "@frennix/ui";

type TrainingMatchModalProps = {
  visible: boolean;
  partner: Profile | null;
  messaging?: boolean;
  onSendMessage: () => void;
  onKeepBrowsing: () => void;
};

export function TrainingMatchModal({
  visible,
  partner,
  messaging,
  onSendMessage,
  onKeepBrowsing,
}: TrainingMatchModalProps) {
  if (!partner) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeepBrowsing}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <FrennixLogo variant="icon" height={32} style={styles.logo} />

          <View style={styles.avatars}>
            <Avatar uri={partner.avatar_url} name={partner.display_name} size={88} />
          </View>

          <Text style={styles.title}>New Training Match</Text>
          <Text style={styles.subtitle}>
            You and {partner.display_name} are ready to train together. Send a message to plan your
            next workout.
          </Text>

          <Button
            title="Send a message"
            onPress={onSendMessage}
            loading={messaging}
            style={styles.primaryAction}
          />
          <Pressable onPress={onKeepBrowsing} style={styles.secondaryAction} hitSlop={8}>
            <Text style={styles.secondaryLabel}>Keep browsing partners</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

type TrainingPartnerDeckActionsProps = {
  onSkip: () => void;
  onConnect: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export function TrainingPartnerDeckActions({
  onSkip,
  onConnect,
  disabled,
  loading,
}: TrainingPartnerDeckActionsProps) {
  return (
    <View style={styles.actionsRow}>
      <Pressable
        style={[styles.actionButton, styles.skipButton, disabled && styles.actionDisabled]}
        onPress={onSkip}
        disabled={disabled || loading}
        accessibilityLabel="Skip training partner"
      >
        <Ionicons name="close" size={28} color={colors.textSecondary} />
        <Text style={styles.skipLabel}>Skip</Text>
      </Pressable>

      <Pressable
        style={[styles.actionButton, styles.connectButton, disabled && styles.actionDisabled]}
        onPress={onConnect}
        disabled={disabled || loading}
        accessibilityLabel="Connect with training partner"
      >
        <Ionicons name="people" size={28} color={colors.background} />
        <Text style={styles.connectLabel}>Connect</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  sheet: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },
  logo: { marginBottom: spacing.xs },
  avatars: { marginVertical: spacing.sm },
  title: { ...typography.heading, fontSize: 24, textAlign: "center", color: colors.text },
  subtitle: {
    ...typography.bodySmall,
    textAlign: "center",
    color: colors.textMuted,
    lineHeight: 22,
  },
  primaryAction: { alignSelf: "stretch", marginTop: spacing.sm },
  secondaryAction: { paddingVertical: spacing.sm },
  secondaryLabel: { ...typography.bodySmall, color: colors.accent, fontWeight: "600" },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
    paddingTop: spacing.md,
  },
  actionButton: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    minWidth: 96,
  },
  skipButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  connectButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accent,
  },
  skipLabel: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  connectLabel: { ...typography.caption, color: colors.accent, fontWeight: "700" },
  actionDisabled: { opacity: 0.45 },
});
