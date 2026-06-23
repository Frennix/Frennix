import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Profile } from "@frennix/types";
import { pushScreen } from "@/lib/press-utils";
import {
  formatCandidateActivities,
  formatCandidateGoals,
  formatSharedActivityLabels,
  formatSharedGoalLabels,
  sharesCity,
} from "@/lib/training-partner-utils";
import { Avatar, Chip, colors, radius, spacing, typography } from "@frennix/ui";

type TrainingPartnerCardProps = {
  candidate: Profile;
  viewer: Profile;
  onPressProfile?: () => void;
};

export function TrainingPartnerCard({ candidate, viewer, onPressProfile }: TrainingPartnerCardProps) {
  const sharedGoals = formatSharedGoalLabels(viewer, candidate);
  const sharedActivities = formatSharedActivityLabels(viewer, candidate);
  const goals = formatCandidateGoals(candidate);
  const activities = formatCandidateActivities(candidate);
  const sameCity = sharesCity(viewer, candidate);

  function openProfile() {
    if (onPressProfile) {
      onPressProfile();
      return;
    }
    if (candidate.username) {
      pushScreen(`/user/${candidate.username}`);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.hero}>
        <Avatar uri={candidate.avatar_url} name={candidate.display_name} size={96} />
        <View style={styles.identity}>
          <Text style={styles.name}>{candidate.display_name}</Text>
          {candidate.username ? (
            <Text style={styles.username}>@{candidate.username}</Text>
          ) : null}
          {candidate.city ? (
            <Text style={[styles.location, sameCity && styles.locationMatch]}>
              {sameCity ? "📍 Same city · " : "📍 "}
              {candidate.city}
            </Text>
          ) : null}
        </View>
      </View>

      {sharedGoals.length || sharedActivities.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shared fitness interests</Text>
          <View style={styles.chipRow}>
            {[...sharedGoals, ...sharedActivities].map((label) => (
              <Chip key={label} label={label} selected />
            ))}
          </View>
        </View>
      ) : null}

      {goals.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Training goals</Text>
          <View style={styles.chipRow}>
            {goals.map((label) => (
              <Chip
                key={label}
                label={label}
                selected={sharedGoals.includes(label)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {activities.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workout styles</Text>
          <View style={styles.chipRow}>
            {activities.map((label) => (
              <Chip
                key={label}
                label={label}
                selected={sharedActivities.includes(label)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {candidate.bio?.trim() ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.bio} numberOfLines={3}>
            {candidate.bio.trim()}
          </Text>
        </View>
      ) : null}

      {candidate.username ? (
        <Pressable onPress={openProfile} hitSlop={8}>
          <Text style={styles.profileLink}>View full profile →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  identity: { flex: 1, gap: 4 },
  name: { ...typography.heading, fontSize: 22, color: colors.text },
  username: { ...typography.bodySmall, color: colors.textMuted },
  location: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  locationMatch: { color: colors.accent, fontWeight: "600" },
  section: { gap: spacing.sm },
  sectionTitle: {
    ...typography.bodySmall,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontSize: 11,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  bio: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },
  profileLink: { ...typography.bodySmall, color: colors.accent, fontWeight: "600" },
});
