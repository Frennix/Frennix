import { useCallback, useEffect, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { MouseEvent } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useCenterOverlaySafeArea } from "@/components/BottomOverlayShell";
import { showAlert } from "@/lib/alerts";
import { canPromptForWebPush, isWebStandalone } from "@/lib/pwa";
import {
  completeWebPushSubscription,
  getWebPushPermissionStatus,
  hasActiveWebPushSubscription,
  isWebPushFeatureEnabled,
  logWebPushEnvironment,
  requestWebPushPermissionFromUserGesture,
  webPushFailureMessage,
} from "@/lib/web-push";
import { markWebPushPromptDismissed, wasWebPushPromptDismissed } from "@/lib/web-push-prompt";
import { pushScreen } from "@/lib/press-utils";
import { WebPushNativeButton } from "@/components/WebPushNativeButton";
import { colors, spacing, typography } from "@frennix/ui";

export function WebPushPermissionPrompt() {
  const { session, authReady } = useAuth();
  const userId = session?.user.id ?? "";
  const [visible, setVisible] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    if (!authReady || !userId || Platform.OS !== "web") return;

    let cancelled = false;
    void (async () => {
      if (!isWebStandalone() || !canPromptForWebPush()) return;
      if (await wasWebPushPromptDismissed()) return;
      if (!(await isWebPushFeatureEnabled())) return;

      const permission = await getWebPushPermissionStatus();
      if (permission === "granted" && (await hasActiveWebPushSubscription())) return;
      if (permission === "denied") return;

      if (!cancelled) setVisible(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, userId]);

  const dismiss = useCallback(async () => {
    setVisible(false);
    await markWebPushPromptDismissed();
  }, []);

  const { backdropStyle } = useCenterOverlaySafeArea(visible);

  function handleNativeClick(_event: MouseEvent<HTMLButtonElement>) {
    if (!userId) return;
    logWebPushEnvironment();
    void requestWebPushPermissionFromUserGesture().then((result) => {
      void finishAfterPermission(result);
    });
  }

  async function finishAfterPermission(result: NotificationPermission | "unsupported") {
    if (result !== "granted") {
      await markWebPushPromptDismissed();
      setVisible(false);
      showAlert(
        "Permission required",
        "Tap Allow on the iOS dialog to enable push notifications."
      );
      pushScreen("/notification-settings");
      return;
    }

    setEnabling(true);
    try {
      const subscriptionResult = await completeWebPushSubscription(userId);
      await markWebPushPromptDismissed();
      setVisible(false);
      if (subscriptionResult.ok) {
        showAlert("Push enabled", "Frennix should appear under Settings → Notifications.");
        return;
      }
      const message = webPushFailureMessage(subscriptionResult);
      if (message) showAlert("Could not enable push", message);
      pushScreen("/notification-settings");
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
          <Text style={styles.title}>Enable Push Notifications</Text>
          <Text style={styles.body}>
            Tap below, then tap Allow on the iOS system dialog. Frennix will appear in Settings →
            Notifications only after you allow.
          </Text>
          <View style={styles.actions}>
            <WebPushNativeButton onClick={handleNativeClick} loading={enabling} disabled={enabling}>
              Enable Push Notifications
            </WebPushNativeButton>
            <Pressable onPress={() => void dismiss()} style={styles.laterButton}>
              <Text style={styles.laterText}>Not now</Text>
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
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    gap: spacing.sm,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    fontWeight: "800",
  },
  body: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  actions: { gap: spacing.sm, paddingTop: spacing.sm },
  laterButton: { alignItems: "center", paddingVertical: spacing.sm },
  laterText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontWeight: "600",
  },
});
