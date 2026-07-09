import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { ChallengeLeaderboardEntry } from "@frennix/types";
import { Avatar, Button, colors, radius, spacing, typography } from "@frennix/ui";

const BADGE_EMOJI: Record<string, string> = {
  completed: "🏁",
  first_place: "🥇",
  top_10: "🔟",
  streak_champion: "🔥",
  consistency: "✅",
};

type Props = {
  entries: ChallengeLeaderboardEntry[];
  viewerRank: number | null;
  viewerId: string;
  loading?: boolean;
  onEncourage?: (entry: ChallengeLeaderboardEntry) => void;
  encouragingUserId?: string | null;
};

export function ChallengeLeaderboard({
  entries,
  viewerRank,
  viewerId,
  loading,
  onEncourage,
  encouragingUserId,
}: Props) {
  if (loading && !entries.length) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!entries.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No rankings yet</Text>
        <Text style={styles.emptyBody}>Be the first to check in and claim the top spot.</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {viewerRank ? (
        <Text style={styles.viewerRank}>Your rank: #{viewerRank}</Text>
      ) : null}
      {entries.map((entry) => {
        const profile = entry.profile;
        const isSelf = entry.user_id === viewerId;
        const score =
          entry.daily_count > 0 && entry.weekly_count === entry.daily_count
            ? entry.daily_count
            : entry.score;
        return (
          <View key={entry.user_id} style={[styles.row, isSelf && styles.rowSelf]}>
            <Text style={styles.rank}>#{entry.rank}</Text>
            <Avatar
              uri={profile?.avatar_url}
              name={profile?.display_name ?? "Athlete"}
              size={40}
            />
            <View style={styles.meta}>
              <Text style={styles.name} numberOfLines={1}>
                {profile?.display_name ?? "Athlete"}
              </Text>
              <Text style={styles.stats}>
                {entry.check_in_count} check-ins · score {score}
              </Text>
              {entry.badges?.length ? (
                <Text style={styles.badges}>
                  {entry.badges.map((b) => BADGE_EMOJI[b] ?? "🏅").join(" ")}
                </Text>
              ) : null}
            </View>
            {!isSelf && onEncourage ? (
              <Button
                title="👏"
                variant="secondary"
                onPress={() => onEncourage(entry)}
                loading={encouragingUserId === entry.user_id}
                style={styles.encourageBtn}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  loading: { padding: spacing.lg, alignItems: "center" },
  empty: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  emptyTitle: { ...typography.heading, fontSize: 16 },
  emptyBody: { ...typography.bodySmall, color: colors.textMuted },
  viewerRank: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowSelf: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceElevated,
  },
  rank: { ...typography.bodySmall, fontWeight: "700", width: 32, color: colors.textSecondary },
  meta: { flex: 1, gap: 2 },
  name: { ...typography.body, fontWeight: "600" },
  stats: { ...typography.caption, color: colors.textMuted },
  badges: { fontSize: 14 },
  encourageBtn: { minWidth: 48, paddingHorizontal: spacing.sm },
});
