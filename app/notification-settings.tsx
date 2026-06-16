import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Switch, StyleSheet, Text, View } from "react-native";
import {
  getNotificationPreferences,
  NOTIFICATION_SETTING_ITEMS,
  updateNotificationPreference,
} from "@frennix/api";
import type { NotificationPreferenceKey } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { colors, spacing, typography } from "@frennix/ui";

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

export default function NotificationSettingsScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();

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

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>
        Choose which activities send push notifications to your device. In-app notifications always
        appear in your notification list.
      </Text>

      {NOTIFICATION_SETTING_ITEMS.map((item) => (
        <SettingRow
          key={item.key}
          title={item.title}
          description={item.description}
          value={preferences?.[item.key] ?? true}
          onChange={(enabled) => handleToggle(item.key, enabled)}
          disabled={isLoading || updateMutation.isPending}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
    gap: spacing.sm,
  },
  intro: {
    ...typography.bodySmall,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.sm,
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
});
