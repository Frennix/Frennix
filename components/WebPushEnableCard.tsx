import { useCallback, useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import type { MouseEvent } from "react";
import { useFocusEffect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { colors, spacing, typography } from "@frennix/ui";
import { useAuth } from "@/providers/AuthProvider";
import { isWebStandalone } from "@/lib/pwa";
import {
  getWebPushPermissionStatus,
  hasActiveWebPushSubscription,
  isWebPushFullyEnabled,
  requestWebPushPermissionFromUserGesture,
} from "@/lib/web-push";
import { runAutoWebPushRegistration } from "@/lib/web-push-auto-register";
import { showWebPushSuccessToast } from "@/components/WebPushSuccessToast";
import { WebPushNativeButton } from "@/components/WebPushNativeButton";

type Props = {
  readyForPush?: boolean;
  onSetupChange?: () => void;
};

/** Minimal push status for notification settings — no manual setup steps when enabled. */
export function WebPushEnableCard({ readyForPush = isWebStandalone(), onSetupChange }: Props) {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [subscribed, setSubscribed] = useState(false);
  const [enabling, setEnabling] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (Platform.OS !== "web") return;
    const nextPermission = await getWebPushPermissionStatus();
    setPermission(nextPermission);
    const active =
      nextPermission === "granted"
        ? await hasActiveWebPushSubscription({ logStep: "subscribe.check" })
        : false;
    setSubscribed(active);
    onSetupChange?.();
  }, [onSetupChange]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useFocusEffect(
    useCallback(() => {
      void refreshStatus();
    }, [refreshStatus])
  );

  async function handleEnableClick(_event: MouseEvent<HTMLButtonElement>) {
    if (!userId || !readyForPush) return;

    setEnabling(true);
    try {
      if (Notification.permission !== "granted") {
        const result = await requestWebPushPermissionFromUserGesture();
        if (result !== "granted") return;
      }
      const outcome = await runAutoWebPushRegistration(userId, queryClient, { source: "permission" });
      await refreshStatus();
      if (outcome.status === "success") {
        showWebPushSuccessToast();
      }
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

  if (!readyForPush) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Turn on notifications</Text>
      <Text style={styles.body}>
        Tap below and allow notifications on the iOS dialog. Frennix will set everything up
        automatically.
      </Text>
      <WebPushNativeButton onClick={handleEnableClick} loading={enabling} disabled={enabling}>
        Turn on notifications
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
