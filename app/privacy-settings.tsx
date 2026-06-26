import { useMutation } from "@tanstack/react-query";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { setPresence, updateProfile } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { setPresenceSharingEnabled } from "@/lib/presence";
import { showAlert } from "@/lib/alerts";
import { FrennixLogo } from "@/components/FrennixLogo";
import { colors, spacing, typography } from "@frennix/ui";

export default function PrivacySettingsScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const userId = session?.user.id ?? "";
  const showOnlineStatus = profile?.show_online_status !== false;

  const updateMutation = useMutation({
    mutationFn: async (next: boolean) => {
      if (!userId) throw new Error("Not signed in");
      const updated = await updateProfile(userId, { show_online_status: next });
      setPresenceSharingEnabled(next);
      if (!next) {
        await setPresence(false, "privacy-show-online-status-off");
      }
      await refreshProfile(updated);
      return updated;
    },
    onError: (error) => {
      showAlert(
        "Could not update privacy setting",
        error instanceof Error ? error.message : "Something went wrong"
      );
    },
  });

  if (!profile) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <FrennixLogo variant="icon" height={24} style={styles.logo} />
      <Text style={styles.intro}>
        Control what other athletes can see about your activity and availability.
      </Text>

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>Show Online Status</Text>
          <Text style={styles.rowDescription}>
            When on, other users can see when you are online or recently active. When off, you
            appear offline to everyone — no green dot, active now, or last seen labels.
          </Text>
        </View>
        <Switch
          value={showOnlineStatus}
          onValueChange={(next) => updateMutation.mutate(next)}
          disabled={updateMutation.isPending}
          trackColor={{ false: colors.border, true: colors.accentMuted }}
          thumbColor={showOnlineStatus ? colors.accent : colors.textMuted}
          ios_backgroundColor={colors.border}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl * 2, gap: spacing.lg },
  logo: { marginBottom: spacing.xs },
  intro: { ...typography.bodySmall, color: colors.textMuted, lineHeight: 20 },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowText: { flex: 1, gap: spacing.xs },
  rowTitle: { ...typography.body, fontWeight: "700", color: colors.text },
  rowDescription: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
});
