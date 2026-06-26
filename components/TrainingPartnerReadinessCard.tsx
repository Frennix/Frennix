import { Pressable, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import type { Profile } from "@frennix/types";
import { AppIcon } from "@/components/AppIcon";
import {
  getTrainingPartnerReadinessItems,
  isTrainingPartnerDiscoveryReady,
} from "@/lib/training-partner-readiness";
import { colors, spacing, typography } from "@frennix/ui";

type TrainingPartnerReadinessCardProps = {
  profile: Profile;
  compact?: boolean;
};

export function TrainingPartnerReadinessCard({
  profile,
  compact = false,
}: TrainingPartnerReadinessCardProps) {
  const items = getTrainingPartnerReadinessItems(profile);
  const ready = isTrainingPartnerDiscoveryReady(profile);

  if (ready && compact) return null;

  return (
    <View style={[styles.card, ready && styles.cardReady]}>
      <Text style={styles.title}>
        {ready ? "Profile ready for discovery" : "Complete your training profile"}
      </Text>
      {!compact ? (
        <Text style={styles.hint}>
          {ready
            ? "Athletes see your goals, workout styles, and city on discovery cards."
            : "Finish these items before you appear in the training partner discovery deck."}
        </Text>
      ) : null}

      <View style={styles.list}>
        {items.map((item) => (
          <View key={item.key} style={styles.row}>
            <AppIcon
              name={item.complete ? "check-circle" : "circle"}
              size={18}
              color={item.complete ? colors.accent : colors.textMuted}
            />
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, item.complete && styles.rowLabelComplete]}>
                {item.label}
              </Text>
              {!compact ? (
                <Text style={styles.rowDescription}>{item.description}</Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      {!ready ? (
        <Link href="/edit-profile" asChild>
          <Pressable style={styles.editButton}>
            <Text style={styles.editButtonText}>Edit training profile</Text>
          </Pressable>
        </Link>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardReady: {
    borderColor: colors.accent,
  },
  title: { ...typography.body, fontWeight: "700", color: colors.text },
  hint: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  list: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: "600" },
  rowLabelComplete: { color: colors.text },
  rowDescription: { ...typography.caption, color: colors.textMuted, lineHeight: 17 },
  editButton: { alignSelf: "flex-start", marginTop: spacing.xs },
  editButtonText: { ...typography.bodySmall, color: colors.accent, fontWeight: "700" },
});
