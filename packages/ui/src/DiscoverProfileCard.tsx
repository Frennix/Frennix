import { StyleSheet, Text, View } from "react-native";
import type { Profile } from "@frennix/types";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { Chip } from "./Chip";
import { formatPresenceStatus, isProfileOnline } from "./presence";
import { colors, radius, spacing, typography } from "./theme";

interface DiscoverProfileCardProps {
  profile: Profile;
  interestLabels: string[];
  reason?: string;
  onViewProfile: () => void;
  followLabel?: string;
  onFollow?: () => void;
  followLoading?: boolean;
}

export function DiscoverProfileCard({
  profile,
  interestLabels,
  reason,
  onViewProfile,
  followLabel,
  onFollow,
  followLoading,
}: DiscoverProfileCardProps) {
  const online = isProfileOnline(profile);
  const presenceLabel = formatPresenceStatus(profile);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Avatar
          uri={profile.avatar_url}
          name={profile.display_name}
          size={56}
          showOnline
          isOnline={online}
        />
        <View style={styles.info}>
          <Text style={styles.name}>{profile.display_name}</Text>
          <Text style={styles.username}>@{profile.username}</Text>
          {presenceLabel ? (
            <Text style={[styles.presence, online && styles.presenceOnline]}>{presenceLabel}</Text>
          ) : null}
          {reason ? <Text style={styles.reason}>{reason}</Text> : null}
        </View>
      </View>

      {interestLabels.length ? (
        <View style={styles.chips}>
          {interestLabels.map((label) => (
            <Chip key={label} label={label} selected />
          ))}
        </View>
      ) : (
        <Text style={styles.noInterests}>No fitness interests listed yet</Text>
      )}

      <View style={styles.actions}>
        {onFollow && followLabel ? (
          <Button
            title={followLabel}
            variant={followLabel === "Following" ? "secondary" : "primary"}
            onPress={onFollow}
            loading={followLoading}
            style={styles.actionButton}
          />
        ) : null}
        <Button
          title="View profile"
          variant="secondary"
          onPress={onViewProfile}
          style={styles.actionButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  info: { flex: 1, gap: 2 },
  name: { ...typography.body, fontWeight: "600", color: colors.text },
  username: { ...typography.caption, color: colors.textMuted },
  presence: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  presenceOnline: { color: colors.accent, fontWeight: "600" },
  reason: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  noInterests: { ...typography.caption, color: colors.textMuted },
  actions: { flexDirection: "row", gap: spacing.sm },
  actionButton: { flex: 1, minHeight: 40 },
});
