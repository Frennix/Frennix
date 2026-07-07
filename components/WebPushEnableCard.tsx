import { useCallback, useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import type { MouseEvent } from "react";
import { useFocusEffect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { colors, spacing, typography } from "@frennix/ui";
import { useAuth } from "@/providers/AuthProvider";
import { showAlert } from "@/lib/alerts";
import { isWebStandalone } from "@/lib/pwa";
import {
  applyWebPushPreferenceOnSuccess,
  completeWebPushSubscription,
  getWebPushPermissionStatus,
  hasActiveWebPushSubscription,
  isWebPushFullyEnabled,
  logWebPushEnvironment,
  prewarmWebPushRegistration,
  requestWebPushPermissionFromUserGesture,
  sendTestWebPushAfterSubscribe,
  webPushFailureMessage,
} from "@/lib/web-push";
import { WebPushDiagnosticsPanel } from "@/components/WebPushDiagnosticsPanel";
import { WebPushNativeButton } from "@/components/WebPushNativeButton";
import { pushLog } from "@/lib/web-push-diagnostics";

type Props = {
  readyForPush?: boolean;
  onSetupChange?: () => void;
};

/**
 * iOS PWA push enable UI.
 * Uses a native HTML <button> so Notification.requestPermission() runs inside a real user gesture.
 */
export function WebPushEnableCard({ readyForPush = isWebStandalone(), onSetupChange }: Props) {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [subscribed, setSubscribed] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    if (Platform.OS !== "web") return;
    const nextPermission = await getWebPushPermissionStatus();
    setPermission(nextPermission);
    const active = nextPermission === "granted" ? await hasActiveWebPushSubscription() : false;
    setSubscribed(active);
    onSetupChange?.();
  }, [onSetupChange]);

  const handleSubscriptionResult = useCallback(
    async (subscriptionResult: Awaited<ReturnType<typeof completeWebPushSubscription>>) => {
      await refreshStatus();

      if (subscriptionResult.ok) {
        setLastError(null);
        try {
          await applyWebPushPreferenceOnSuccess(userId, queryClient);
        } catch (error) {
          const message = `Subscription saved but push_enabled preference failed: ${String(error)}`;
          setLastError(message);
          showAlert("Push subscription saved", message);
          return;
        }
        await sendTestWebPushAfterSubscribe(userId);
        showAlert(
          "Push enabled",
          "Push subscription saved. A test notification was queued — check your lock screen."
        );
        return;
      }

      const message = webPushFailureMessage(subscriptionResult);
      setLastError(message);
      if (message) showAlert("Could not complete push setup", message);
    },
    [queryClient, refreshStatus, userId]
  );

  const finishSubscriptionOnly = useCallback(async () => {
    if (!userId) return;
    setEnabling(true);
    try {
      const subscriptionResult = await completeWebPushSubscription(userId);
      await handleSubscriptionResult(subscriptionResult);
    } finally {
      setEnabling(false);
    }
  }, [handleSubscriptionResult, userId]);

  useEffect(() => {
    logWebPushEnvironment();
    void prewarmWebPushRegistration();
    void refreshStatus();
  }, [refreshStatus]);

  useFocusEffect(
    useCallback(() => {
      void refreshStatus();
    }, [refreshStatus])
  );

  function handleNativeButtonClick(_event: MouseEvent<HTMLButtonElement>) {
    pushLog("subscribe.button_click", "Complete Push Setup tapped");

    if (!userId) {
      showAlert("Sign in required", "Log in to enable push notifications.");
      return;
    }
    if (!readyForPush) {
      showAlert(
        "Install Frennix first",
        "On iPhone: Safari → Share → Add to Home Screen. Open Frennix from the home screen icon."
      );
      return;
    }

    if (Notification.permission === "granted") {
      void finishSubscriptionOnly();
      return;
    }

    void requestWebPushPermissionFromUserGesture().then((result) => {
      void finishAfterPermission(result);
    });
  }

  async function finishAfterPermission(result: NotificationPermission | "unsupported") {
    setPermission(result === "unsupported" ? "default" : result);

    if (result !== "granted") {
      const message =
        result === "default"
          ? "iOS did not show the permission dialog. Ensure you tapped the button (not the switch) and are using the Home Screen app."
          : result === "denied"
            ? "Notifications were blocked. Open iPhone Settings → Notifications → Frennix."
            : "Push is not supported in this browser context.";
      setLastError(message);
      setSubscribed(false);
      showAlert("Permission not granted", message);
      return;
    }

    await finishSubscriptionOnly();
  }

  if (Platform.OS !== "web") return null;

  if (!readyForPush) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Enable Push Notifications</Text>
        <Text style={styles.body}>
          Install Frennix to your Home Screen first. Open it from the home screen icon (not Safari),
          then tap Enable Push Notifications here.
        </Text>
        <WebPushDiagnosticsPanel />
      </View>
    );
  }

  if (isWebPushFullyEnabled(permission, subscribed)) {
    return (
      <View style={[styles.container, styles.containerSuccess]}>
        <Text style={styles.title}>Push notifications enabled</Text>
        <Text style={styles.body}>
          iOS permission: granted. Push subscription is active. Manage alerts in Settings →
          Notifications → Frennix.
        </Text>
        <WebPushDiagnosticsPanel />
      </View>
    );
  }

  const isDenied = permission === "denied";
  const permissionGranted = permission === "granted";
  const buttonLabel = permissionGranted
    ? enabling
      ? "Saving push subscription…"
      : "Complete Push Setup"
    : "Enable Push Notifications";

  return (
    <View style={[styles.container, isDenied && styles.containerDenied]}>
      <Text style={styles.title}>Enable Push Notifications</Text>
      <Text style={styles.body}>
        Current iOS permission: <Text style={styles.mono}>{permission}</Text>
        {subscribed ? " · subscription present" : " · no subscription"}
      </Text>
      <Text style={styles.body}>
        {isDenied
          ? "Notifications were blocked. Open iPhone Settings → Notifications → Frennix, allow alerts, then tap the button below again."
          : permissionGranted
            ? "iOS permission is granted. Tap below to create the push subscription and save it to Frennix. The master switch turns on only after the subscription is saved."
            : "Tap the button below. iOS must show the system Allow / Don’t Allow dialog. Frennix will only show as enabled after you tap Allow."}
      </Text>
      <WebPushNativeButton onClick={handleNativeButtonClick} loading={enabling} disabled={enabling}>
        {buttonLabel}
      </WebPushNativeButton>
      {lastError ? <Text style={styles.error}>{lastError}</Text> : null}
      <WebPushDiagnosticsPanel />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  containerSuccess: {
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  containerDenied: {
    borderColor: colors.border,
  },
  title: {
    ...typography.body,
    fontWeight: "800",
    color: colors.text,
  },
  body: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  mono: {
    fontFamily: Platform.OS === "web" ? "monospace" : undefined,
    fontWeight: "700",
    color: colors.text,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    lineHeight: 18,
  },
});
