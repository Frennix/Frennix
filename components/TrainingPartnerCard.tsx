import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MatchCandidate, MatchableProfile } from "@frennix/types";
import { MatchReasonsList } from "@/components/MatchReasonsList";
import { pushScreen } from "@/lib/press-utils";
import {
  formatCandidateActivities,
  formatCandidateGoals,
  formatSharedActivityLabels,
  formatSharedGoalLabels,
  sharesCity,
} from "@/lib/training-partner-utils";
import {
  Avatar,
  Chip,
  colors,
  formatPresenceStatus,
  formatStreakBadgeLabel,
  isProfileOnline,
  radius,
  spacing,
  typography,
} from "@frennix/ui";

type TrainingPartnerCardProps = {
  candidate: MatchCandidate | MatchableProfile;
  viewer: MatchableProfile;
  onPressProfile?: () => void;
};

function isScoredCandidate(
  candidate: MatchCandidate | MatchableProfile
): candidate is MatchCandidate {
  return "match_reasons" in candidate && Array.isArray(candidate.match_reasons);
}

export function TrainingPartnerCard({ candidate, viewer, onPressProfile }: TrainingPartnerCardProps) {
  const sharedGoals = formatSharedGoalLabels(viewer, candidate);
  const sharedActivities = formatSharedActivityLabels(viewer, candidate);
  const goals = formatCandidateGoals(candidate);
  const activities = formatCandidateActivities(candidate);
  const sameCity = sharesCity(viewer, candidate);
  const reasons = isScoredCandidate(candidate) ? candidate.match_reasons : [];
  const streak = isScoredCandidate(candidate) ? candidate.workout_streak : 0;
  const presenceOnline = isProfileOnline(candidate);
  const presenceLabel = formatPresenceStatus(candidate);

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
        <View style={styles.avatarWrap}>
          <Avatar uri={candidate.avatar_url} name={candidate.display_name} size={112} />
          {presenceOnline ? <View style={styles.onlineDot} /> : null}
        </View>
        <View style={styles.identity}>
          <Text style={styles.name}>{candidate.display_name}</Text>
          {candidate.username ? (
            <Text style={styles.username}>@{candidate.username}</Text>
          ) : null}
          {presenceLabel ? (
            <Text style={[styles.presence, presenceOnline && styles.presenceOnline]}>
              {presenceLabel}
            </Text>
          ) : null}
          {candidate.city ? (
            <Text style={[styles.location, sameCity && styles.locationMatch]}>
              {sameCity ? "📍 Same city · " : "📍 "}
              {candidate.city}
            </Text>
          ) : null}
          {streak > 0 ? (
            <Text style={styles.streak}>{formatStreakBadgeLabel(streak)}</Text>
          ) : null}
        </View>
      </View>

      {reasons.length ? <MatchReasonsList reasons={reasons} /> : null}

      {sharedGoals.length || sharedActivities.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mutual workout interests</Text>
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
              <Chip key={label} label={label} selected={sharedGoals.includes(label)} />
            ))}
          </View>
        </View>
      ) : null}

      {activities.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workout styles</Text>
          <View style={styles.chipRow}>
            {activities.map((label) => (
              <Chip key={label} label={label} selected={sharedActivities.includes(label)} />
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
    alignItems: "flex-start",
    gap: spacing.md,
  },
  avatarWrap: { position: "relative" },
  onlineDot: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accent,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  identity: { flex: 1, gap: spacing.xxs },
  name: { ...typography.screenTitle, fontSize: 22 },
  username: { ...typography.bodySmall, color: colors.textMuted },
  presence: { ...typography.caption, color: colors.textMuted },
  presenceOnline: { color: colors.accent, fontWeight: "600" },
  location: { ...typography.bodySmall, color: colors.textSecondary },
  locationMatch: { color: colors.accent, fontWeight: "600" },
  streak: { ...typography.caption, color: colors.warning, fontWeight: "700" },
  section: { gap: spacing.sm },
  sectionTitle: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  bio: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },
  profileLink: { ...typography.bodySmall, color: colors.accent, fontWeight: "600" },
});
