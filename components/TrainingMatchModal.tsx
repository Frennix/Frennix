import { AppIcon } from "@/components/AppIcon";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { Profile } from "@frennix/types";
import { FrennixLogo } from "@/components/FrennixLogo";
import { useCenterOverlaySafeArea } from "@/components/BottomOverlayShell";
import { hapticLight, hapticMedium } from "@/lib/haptics";
import { Avatar, Button, applyShadow, colors, ScalePressable, spacing, typography } from "@frennix/ui";

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
  const { backdropStyle } = useCenterOverlaySafeArea(visible);
  if (!partner) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onKeepBrowsing}
      accessibilityViewIsModal
    >
      <View style={[styles.backdrop, ...backdropStyle]}>
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
          <Pressable
            onPress={onKeepBrowsing}
            style={styles.secondaryAction}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Keep browsing training partners"
          >
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
  const actionDisabled = disabled || loading;

  function handleSkip() {
    if (actionDisabled) return;
    hapticLight();
    onSkip();
  }

  function handleConnect() {
    if (actionDisabled) return;
    hapticMedium();
    onConnect();
  }

  return (
    <View style={styles.actionsRow}>
      <View style={styles.actionItem}>
        <ScalePressable
          containerStyle={[styles.circleButton, styles.skipButton, actionDisabled && styles.actionDisabled]}
          onPress={handleSkip}
          disabled={actionDisabled}
          accessibilityLabel="Skip training partner"
          pressedScale={0.94}
        >
          <AppIcon name="close" color={colors.textSecondary} size={28} />
        </ScalePressable>
        <Text style={styles.skipLabel}>Skip</Text>
      </View>

      <View style={styles.actionItem}>
        <ScalePressable
          containerStyle={[styles.circleButton, styles.connectButton, actionDisabled && styles.actionDisabled]}
          onPress={handleConnect}
          disabled={actionDisabled}
          accessibilityLabel="Connect with training partner"
          pressedScale={0.92}
        >
          <AppIcon name="users" color={colors.background} size={32} />
        </ScalePressable>
        <Text style={styles.connectLabel}>Connect</Text>
      </View>
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
    alignItems: "flex-start",
    justifyContent: "center",
    gap: spacing.xxl,
    paddingVertical: spacing.xs,
  },
  actionItem: {
    alignItems: "center",
    gap: spacing.xs,
    minWidth: 100,
  },
  circleButton: {
    alignItems: "center",
    justifyContent: "center",
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
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.accent,
    ...applyShadow("accent"),
  },
  skipLabel: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  connectLabel: { ...typography.caption, color: colors.text, fontWeight: "700" },
  actionDisabled: { opacity: 0.45 },
});
