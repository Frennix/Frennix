import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getMyTrainerProfile } from "@frennix/api";
import { TrainerProfileEditor } from "@/components/TrainerProfileEditor";
import { useAuth } from "@/providers/AuthProvider";
import { colors, spacing, typography } from "@frennix/ui";

export default function TrainerSetupScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";

  const { data: existing } = useQuery({
    queryKey: ["my-trainer-profile", userId],
    queryFn: getMyTrainerProfile,
    enabled: !!userId,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.lead}>
        Set up your trainer profile to appear in Find Trainer. This is separate from Training Partners.
      </Text>
      <TrainerProfileEditor
        userId={userId}
        initial={existing}
        showDiscoveryToggle
        onSaved={() => router.replace("/trainer-profile/edit")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  lead: {
    ...typography.bodySmall,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
