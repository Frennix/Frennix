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
  getNotificationPreferences,
  NOTIFICATION_SETTING_ITEMS,
  updateNotificationPreference,
} from "@frennix/api";
import type { NotificationPreferenceKey } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import {
  getPushPermissionStatus,
  openSystemNotificationSettings,
  registerForPushNotifications,
  requestPushPermission,
  type PushPermissionStatus,
} from "@/lib/notifications";
import { showAlert } from "@/lib/alerts";
import { FrennixLogo } from "@/components/FrennixLogo";
import { Button, colors, spacing, typography } from "@frennix/ui";

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
          ? "Training match and message alerts need permission in your device settings. In-app toggles below only apply once push is enabled."
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

  const refreshPermissionStatus = useCallback(async () => {
    const status = await getPushPermissionStatus();
    setPermissionStatus(status);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshPermissionStatus();
    }, [refreshPermissionStatus])
  );

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["notification-preferences", userId],
    queryFn: () => getNotificationPreferences(userId),
    enabled: !!userId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, enabled }: { key: NotificationPreferenceKey; enabled: boolean }) =>
      updateNotificationPreference(userId, key, enabled),
    onSuccess: (next) => {
      queryClient.setQueryData(["notification-preferences", userId], next);
    },
  });

  function handleToggle(key: NotificationPreferenceKey, enabled: boolean) {
    updateMutation.mutate({ key, enabled });
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
      } else if (nextStatus === "denied") {
        showAlert(
          "Notifications blocked",
          "Enable notifications for Frennix in your device settings to receive training match alerts."
        );
      }
    } finally {
      setEnablingPush(false);
    }
  }

  const togglesDisabled =
    isLoading || updateMutation.isPending || permissionStatus !== "granted";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <FrennixLogo variant="icon" height={28} style={styles.brandMark} />

      <Text style={styles.intro}>
        Choose which alerts Frennix sends to your device. Training match alerts fire when you and
        another athlete connect. Partner messages use the Messages toggle below.
      </Text>

      {Platform.OS !== "web" ? (
        <PushPermissionBanner
          status={permissionStatus}
          enabling={enablingPush}
          onEnable={() => void handleEnablePush()}
        />
      ) : (
        <View style={styles.webNotice}>
          <Text style={styles.webNoticeText}>
            Push notifications are available on the iOS and Android apps only.
          </Text>
        </View>
      )}

      {permissionStatus === "granted" ? (
        <View style={styles.enabledBadge}>
          <View style={styles.enabledDot} />
          <Text style={styles.enabledText}>Push notifications enabled on this device</Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Alert types</Text>

      {isLoading && !preferences ? (
        <ActivityIndicator color={colors.accent} style={styles.loader} />
      ) : (
        NOTIFICATION_SETTING_ITEMS.map((item) => (
          <SettingRow
            key={item.key}
            title={item.title}
            description={item.description}
            value={preferences?.[item.key] ?? true}
            onChange={(enabled) => handleToggle(item.key, enabled)}
            disabled={togglesDisabled}
          />
        ))
      )}

      {permissionStatus !== "granted" && Platform.OS !== "web" ? (
        <Text style={styles.toggleHint}>
          Turn on push notifications above to control these alert types.
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
  enabledBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  enabledDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  enabledText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "600",
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
  webNotice: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  webNoticeText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    lineHeight: 20,
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
