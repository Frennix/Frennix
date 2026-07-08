import { useCallback, useEffect, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { MouseEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { useCenterOverlaySafeArea } from "@/components/BottomOverlayShell";
import {
  getWebPushPermissionStatus,
  requestWebPushPermissionFromUserGesture,
} from "@/lib/web-push";
import { runAutoWebPushRegistration } from "@/lib/web-push-auto-register";
import {
  markWebPushPermissionDenied,
} from "@/lib/web-push-prompt";
import {
  clearNotificationOnboardingSnooze,
  markNotificationOnboardingSnoozed,
  NOTIFICATION_ONBOARDING_BENEFITS,
  registerNotificationOnboardingHandler,
} from "@/lib/notification-onboarding";
import { showWebPushSuccessToast } from "@/components/WebPushSuccessToast";
import { WebPushNativeButton } from "@/components/WebPushNativeButton";
import { colors, spacing, typography } from "@frennix/ui";

const SUCCESS_MESSAGE = "✅ Notifications are enabled. You're all set!";

export function NotificationOnboardingPrompt() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const [visible, setVisible] = useState(false);
  const [enabling, setEnabling] = useState(false);

  const openPrompt = useCallback(() => {
    setVisible(true);
  }, []);

  useEffect(() => {
    registerNotificationOnboardingHandler(openPrompt);
    return () => registerNotificationOnboardingHandler(null);
  }, [openPrompt]);

  const dismiss = useCallback(async () => {
    setVisible(false);
    await markNotificationOnboardingSnoozed();
  }, []);

  const { backdropStyle } = useCenterOverlaySafeArea(visible);

  function handleNativeClick(_event: MouseEvent<HTMLButtonElement>) {
    if (!userId) return;

    void (async () => {
      const permission = await getWebPushPermissionStatus();
      if (permission === "granted") {
        setEnabling(true);
        try {
          const outcome = await runAutoWebPushRegistration(userId, queryClient, {
            source: "permission",
          });
          setVisible(false);
          await clearNotificationOnboardingSnooze();
          if (outcome.status === "success") {
            showWebPushSuccessToast(SUCCESS_MESSAGE);
          }
        } finally {
          setEnabling(false);
        }
        return;
      }

      void requestWebPushPermissionFromUserGesture().then((result) => {
        void finishAfterPermission(result);
      });
    })();
  }

  async function finishAfterPermission(result: NotificationPermission | "unsupported") {
    if (result !== "granted") {
      if (result === "denied") await markWebPushPermissionDenied();
      setVisible(false);
      return;
    }

    setEnabling(true);
    try {
      const outcome = await runAutoWebPushRegistration(userId, queryClient, { source: "permission" });
      setVisible(false);
      await clearNotificationOnboardingSnooze();
      if (outcome.status === "success") {
        showWebPushSuccessToast(SUCCESS_MESSAGE);
      }
    } finally {
      setEnabling(false);
    }
  }

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={() => void dismiss()}
      accessibilityViewIsModal
    >
      <View style={[styles.backdrop, ...backdropStyle]}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Notifications</Text>
          <Text style={styles.title}>Stay Connected</Text>
          <Text style={styles.lead}>Never miss what&apos;s happening on Frennix.</Text>
          <Text style={styles.sublead}>
            Enable notifications to instantly know when someone:
          </Text>

          <View style={styles.benefitsPanel}>
            {NOTIFICATION_ONBOARDING_BENEFITS.map((benefit) => (
              <View key={benefit.label} style={styles.benefitRow}>
                <Text style={styles.benefitIcon}>{benefit.icon}</Text>
                <Text style={styles.benefitLabel}>{benefit.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            <WebPushNativeButton onClick={handleNativeClick} loading={enabling} disabled={enabling}>
              Enable Notifications
            </WebPushNativeButton>
            <Pressable onPress={() => void dismiss()} style={styles.laterButton}>
              <Text style={styles.laterText}>Maybe Later</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    padding: spacing.lg,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    gap: spacing.sm,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    fontWeight: "800",
  },
  lead: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  sublead: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "600",
    lineHeight: 22,
  },
  benefitsPanel: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 4,
  },
  benefitIcon: {
    fontSize: 16,
    width: 24,
    textAlign: "center",
  },
  benefitLabel: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
    lineHeight: 20,
  },
  actions: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  laterButton: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  laterText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontWeight: "600",
  },
});
