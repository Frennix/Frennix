import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Switch } from "react-native";
import {
  getUserNotificationPreferences,
  isCategoryEnabled,
  updateUserNotificationCategory,
  updateUserNotificationPreference,
  USER_NOTIFICATION_CATEGORIES,
} from "@frennix/api";
import type { UserNotificationPreferenceKey } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import {
  getPushPermissionStatus,
  openSystemNotificationSettings,
  registerForPushNotifications,
  requestPushPermission,
  type PushPermissionStatus,
} from "@/lib/notifications";
import { getWebPushPermissionStatus, hasActiveWebPushSubscription } from "@/lib/web-push";
import { showAlert } from "@/lib/alerts";
import { FrennixLogo } from "@/components/FrennixLogo";
import { IosPwaInstallGuide } from "@/components/IosPwaInstallGuide";
import { WebPushEnableCard } from "@/components/WebPushEnableCard";
import { isWebStandalone, shouldShowIosPwaInstallGuide } from "@/lib/pwa";
import { Button, Input, colors, spacing, typography } from "@frennix/ui";

function SettingRow({
  title,
  description,
  value,
  onChange,
  disabled,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.accentMuted }}
        thumbColor={value ? colors.accent : colors.textMuted}
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}

function PushPermissionBanner({
  status,
  enabling,
  onEnable,
}: {
  status: PushPermissionStatus;
  enabling: boolean;
  onEnable: () => void;
}) {
  if (status === "granted" || status === "unavailable") return null;

  const isDenied = status === "denied";

  return (
    <View style={[styles.permissionBanner, isDenied && styles.permissionBannerDenied]}>
      <Text style={styles.permissionTitle}>
        {isDenied ? "Push notifications are off" : "Enable push notifications"}
      </Text>
      <Text style={styles.permissionBody}>
        {isDenied
          ? "Alerts need permission in your device settings. In-app notifications always appear in your Notification Center."
          : "Allow alerts so you know instantly when you connect with a training partner or receive a message."}
      </Text>
      <Button
        title={isDenied ? "Open device settings" : "Enable notifications"}
        onPress={onEnable}
        loading={enabling}
        variant="secondary"
        style={styles.permissionButton}
      />
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const [permissionStatus, setPermissionStatus] = useState<PushPermissionStatus>("undetermined");
  const [enablingPush, setEnablingPush] = useState(false);
  const [webPushGranted, setWebPushGranted] = useState(false);
  const [webPushSubscribed, setWebPushSubscribed] = useState(false);

  const refreshPermissionStatus = useCallback(async () => {
    if (Platform.OS === "web") {
      const status = await getWebPushPermissionStatus();
      const granted = status === "granted";
      setWebPushGranted(granted);
      setWebPushSubscribed(granted ? await hasActiveWebPushSubscription() : false);
      setPermissionStatus(granted ? "granted" : status === "denied" ? "denied" : "undetermined");
      return;
    }

    const status = await getPushPermissionStatus();
    setPermissionStatus(status);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshPermissionStatus();
    }, [refreshPermissionStatus])
  );

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["user-notification-preferences", userId],
    queryFn: () => getUserNotificationPreferences(userId),
    enabled: !!userId,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      key,
      value,
    }: {
      key: UserNotificationPreferenceKey;
      value: boolean | string;
    }) => updateUserNotificationPreference(userId, key, value),
    onSuccess: (next) => {
      queryClient.setQueryData(["user-notification-preferences", userId], next);
      queryClient.invalidateQueries({ queryKey: ["notification-preferences", userId] });
    },
  });

  const categoryMutation = useMutation({
    mutationFn: ({ categoryId, enabled }: { categoryId: string; enabled: boolean }) =>
      updateUserNotificationCategory(userId, categoryId, enabled),
    onSuccess: (next) => {
      queryClient.setQueryData(["user-notification-preferences", userId], next);
      queryClient.invalidateQueries({ queryKey: ["notification-preferences", userId] });
    },
  });

  function handleToggle(key: UserNotificationPreferenceKey, enabled: boolean) {
    updateMutation.mutate({ key, value: enabled });
  }

  function handleCategoryToggle(categoryId: string, enabled: boolean) {
    categoryMutation.mutate({ categoryId, enabled });
  }

  async function handleEnablePush() {
    if (permissionStatus === "denied") {
      const opened = await openSystemNotificationSettings();
      if (!opened) {
        showAlert(
          "Could not open settings",
          "Open your device settings manually and enable notifications for Frennix."
        );
      }
      return;
    }

    setEnablingPush(true);
    try {
      const nextStatus = await requestPushPermission();
      setPermissionStatus(nextStatus);

      if (nextStatus === "granted" && userId) {
        await registerForPushNotifications(userId);
        handleToggle("push_enabled", true);
      } else if (nextStatus === "denied") {
        showAlert(
          "Notifications blocked",
          "Enable notifications for Frennix in your device settings to receive alerts."
        );
      }
    } finally {
      setEnablingPush(false);
    }
  }

  const pushControlsDisabled =
    isLoading ||
    updateMutation.isPending ||
    (Platform.OS === "web"
      ? !webPushGranted || !webPushSubscribed
      : permissionStatus !== "granted");

  const masterPushSwitchValue =
    Platform.OS === "web"
      ? webPushGranted && webPushSubscribed && (preferences?.push_enabled ?? false)
      : (preferences?.push_enabled ?? true);

  function handleMasterPushToggle(enabled: boolean) {
    if (Platform.OS === "web" && enabled && (!webPushGranted || !webPushSubscribed)) {
      showAlert(
        "Turn on notifications",
        "Tap Turn on notifications above and allow the iOS dialog. Frennix will enable push automatically."
      );
      return;
    }
    handleToggle("push_enabled", enabled);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <FrennixLogo variant="icon" height={28} style={styles.brandMark} />

      <Text style={styles.intro}>
        Control which alerts Frennix sends to your device. Notifications always remain in your
        Notification Center — even when push is off or during quiet hours.
      </Text>

      {Platform.OS === "web" ? (
        shouldShowIosPwaInstallGuide() ? (
          <IosPwaInstallGuide />
        ) : (
          <WebPushEnableCard
            readyForPush={isWebStandalone()}
            onSetupChange={() => void refreshPermissionStatus()}
          />
        )
      ) : (
        <PushPermissionBanner
          status={permissionStatus}
          enabling={enablingPush}
          onEnable={() => void handleEnablePush()}
        />
      )}

      <SettingRow
        title="Push notifications"
        description={
          Platform.OS === "web" && webPushGranted && webPushSubscribed
            ? "Device alerts are enabled on this iPhone."
            : Platform.OS === "web"
              ? "Allow notifications on this device to receive alerts."
              : "Master switch for device alerts. In-app history is always kept."
        }
        value={masterPushSwitchValue}
        onChange={handleMasterPushToggle}
        disabled={isLoading || updateMutation.isPending}
      />

      <Text style={styles.sectionTitle}>Notification categories</Text>
      <Text style={styles.sectionHint}>
        Control which types of alerts Frennix sends. In-app history is always kept in your
        Notification Center.
      </Text>

      {isLoading && !preferences ? (
        <ActivityIndicator color={colors.accent} style={styles.loader} />
      ) : (
        USER_NOTIFICATION_CATEGORIES.map((category) => (
          <SettingRow
            key={category.id}
            title={category.title}
            description={category.description}
            value={preferences ? isCategoryEnabled(preferences, category.id) : true}
            onChange={(enabled) => handleCategoryToggle(category.id, enabled)}
            disabled={
              pushControlsDisabled ||
              !preferences?.push_enabled ||
              categoryMutation.isPending ||
              updateMutation.isPending
            }
          />
        ))
      )}

      <Text style={styles.sectionTitle}>Quiet hours</Text>
      <Text style={styles.sectionHint}>
        Off by default. During quiet hours, push is suppressed but notifications still appear in
        your Notification Center.
      </Text>

      <SettingRow
        title="Enable quiet hours"
        description="Pause push notifications during your chosen window"
        value={preferences?.quiet_hours_enabled ?? false}
        onChange={(enabled) => handleToggle("quiet_hours_enabled", enabled)}
        disabled={isLoading || updateMutation.isPending}
      />

      {preferences?.quiet_hours_enabled ? (
        <View style={styles.quietHoursFields}>
          <Input
            label="Start (HH:MM)"
            value={preferences.quiet_hours_start}
            onChangeText={(value) => updateMutation.mutate({ key: "quiet_hours_start", value })}
            autoCapitalize="none"
            placeholder="22:00"
          />
          <Input
            label="End (HH:MM)"
            value={preferences.quiet_hours_end}
            onChangeText={(value) => updateMutation.mutate({ key: "quiet_hours_end", value })}
            autoCapitalize="none"
            placeholder="07:00"
          />
          <Input
            label="Timezone (IANA)"
            value={preferences.timezone}
            onChangeText={(value) => updateMutation.mutate({ key: "timezone", value })}
            autoCapitalize="none"
            placeholder="America/Los_Angeles"
          />
        </View>
      ) : null}

      {Platform.OS !== "web" && permissionStatus !== "granted" ? (
        <Text style={styles.toggleHint}>
          Enable push notifications above to control alert types on this device.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  brandMark: {
    marginBottom: spacing.xs,
  },
  intro: {
    ...typography.bodySmall,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  permissionBanner: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  permissionBannerDenied: {
    borderColor: colors.border,
  },
  permissionTitle: {
    ...typography.body,
    fontWeight: "700",
    color: colors.text,
  },
  permissionBody: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  permissionButton: {
    alignSelf: "flex-start",
  },
  webNotice: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  webNoticeTitle: {
    ...typography.body,
    fontWeight: "700",
    color: colors.text,
  },
  webNoticeText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    lineHeight: 20,
  },
  sectionTitle: {
    ...typography.bodySmall,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionHint: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowText: { flex: 1, gap: 4 },
  rowTitle: { ...typography.body, fontWeight: "600", color: colors.text },
  rowDescription: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  quietHoursFields: {
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  toggleHint: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  loader: {
    marginVertical: spacing.lg,
  },
});
