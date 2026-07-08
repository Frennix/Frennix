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
  getWebPushPermissionStatus,
  hasActiveWebPushSubscription,
  isWebPushFeatureEnabled,
  isWebPushFullyEnabled,
  requestWebPushPermissionFromUserGesture,
  webPushFailureMessage,
} from "@/lib/web-push";
import { runAutoWebPushRegistration } from "@/lib/web-push-auto-register";
import { showWebPushSuccessToast } from "@/components/WebPushSuccessToast";
import { WebPushNativeButton } from "@/components/WebPushNativeButton";

type Props = {
  readyForPush?: boolean;
  onSetupChange?: () => void;
};

/** Push enable UI for notification settings — always shows a clear next step. */
export function WebPushEnableCard({ readyForPush = isWebStandalone(), onSetupChange }: Props) {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [subscribed, setSubscribed] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [autoRegistering, setAutoRegistering] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (Platform.OS !== "web") return;
    const nextPermission = await getWebPushPermissionStatus();
    setPermission(nextPermission);
    const active =
      nextPermission === "granted"
        ? await hasActiveWebPushSubscription({ logStep: "subscribe.check" })
        : false;
    setSubscribed(active);
    setFeatureEnabled(await isWebPushFeatureEnabled());
    onSetupChange?.();
    return { permission: nextPermission, subscribed: active };
  }, [onSetupChange]);

  const finishRegistration = useCallback(
    async (source: "permission" | "resume") => {
      if (!userId) return;
      setEnabling(true);
      try {
        const outcome = await runAutoWebPushRegistration(userId, queryClient, { source });
        await refreshStatus();
        if (outcome.status === "success") {
          showWebPushSuccessToast();
          return;
        }
        if (outcome.status === "failed") {
          const message = webPushFailureMessage(outcome.result);
          if (message) showAlert("Could not enable notifications", message);
        }
      } finally {
        setEnabling(false);
        setAutoRegistering(false);
      }
    },
    [queryClient, refreshStatus, userId]
  );

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const status = await refreshStatus();
        if (
          !userId ||
          !readyForPush ||
          status?.permission !== "granted" ||
          status?.subscribed
        ) {
          return;
        }
        setAutoRegistering(true);
        await finishRegistration("resume");
      })();
    }, [finishRegistration, readyForPush, refreshStatus, userId])
  );

  async function handleEnableClick(_event: MouseEvent<HTMLButtonElement>) {
    if (!userId) {
      showAlert("Sign in required", "Log in to enable push notifications.");
      return;
    }

    if (!readyForPush) {
      showAlert(
        "Open Frennix from your Home Screen",
        "On iPhone, add Frennix to your Home Screen and open it from the home screen icon — not Safari — to enable notifications."
      );
      return;
    }

    if (!featureEnabled) {
      showAlert(
        "Notifications unavailable",
        "Push notifications are not enabled for your account yet. Try again later."
      );
      return;
    }

    setEnabling(true);
    try {
      if (Notification.permission !== "granted") {
        const result = await requestWebPushPermissionFromUserGesture();
        if (result === "denied") {
          showAlert(
            "Notifications blocked",
            "Open iPhone Settings → Notifications → Frennix and allow notifications. Frennix will finish setup automatically when you reopen the app."
          );
          await refreshStatus();
          return;
        }
        if (result !== "granted") return;
      }
      await finishRegistration("permission");
    } finally {
      setEnabling(false);
    }
  }

  if (Platform.OS !== "web") return null;

  if (isWebPushFullyEnabled(permission, subscribed)) {
    return (
      <View style={[styles.container, styles.containerSuccess]}>
        <Text style={styles.enabledText}>Push Notifications: Enabled ✅</Text>
      </View>
    );
  }

  if (permission === "denied") {
    return (
      <View style={[styles.container, styles.containerDenied]}>
        <Text style={styles.title}>Push notifications are off</Text>
        <Text style={styles.body}>
          To receive alerts, open iPhone Settings → Notifications → Frennix and allow notifications.
          Frennix will register your device automatically the next time you open the app.
        </Text>
      </View>
    );
  }

  if (!readyForPush) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Open Frennix from your Home Screen</Text>
        <Text style={styles.body}>
          Push notifications only work when Frennix is installed to your Home Screen. Open Frennix
          from the home screen icon, then return here and tap Enable Notifications.
        </Text>
      </View>
    );
  }

  if (!featureEnabled) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Push notifications unavailable</Text>
        <Text style={styles.body}>
          Push alerts are not enabled for your account yet. In-app notifications still appear in
          your Notification Center.
        </Text>
      </View>
    );
  }

  const permissionGranted = permission === "granted";
  const buttonLabel = permissionGranted
    ? autoRegistering || enabling
      ? "Finishing setup…"
      : "Complete notification setup"
    : "Enable Notifications";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Turn on notifications</Text>
      <Text style={styles.body}>
        {permissionGranted
          ? "iOS permission is granted. Tap below to finish registering this device for push alerts."
          : "Tap below and allow notifications on the iOS dialog. Frennix will set everything up automatically."}
      </Text>
      <WebPushNativeButton
        onClick={handleEnableClick}
        loading={enabling || autoRegistering}
        disabled={enabling || autoRegistering}
      >
        {buttonLabel}
      </WebPushNativeButton>
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
  enabledText: {
    ...typography.body,
    fontWeight: "700",
    color: colors.text,
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
});
