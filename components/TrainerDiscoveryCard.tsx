import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { TrainerSearchResult } from "@frennix/types";
import { TrainerBadge } from "@/components/TrainerBadge";
import {
  formatCoachingFormat,
  formatTrainerAvailability,
  formatTrainerCategory,
  formatTrainerSpecialty,
} from "@/lib/trainer-labels";
import { formatTrainerBudgetRange, formatYearsExperience } from "@/lib/trainer-utils";
import { pushScreen } from "@/lib/press-utils";
import { Avatar, Chip, colors, radius, spacing, typography } from "@frennix/ui";

type TrainerDiscoveryCardProps = {
  result: TrainerSearchResult;
  onPress?: () => void;
};

export function TrainerDiscoveryCard({ result, onPress }: TrainerDiscoveryCardProps) {
  const { profile, trainer, connection_status: connectionStatus, portfolio_preview: preview } = result;
  const budget = formatTrainerBudgetRange(trainer);
  const experience = formatYearsExperience(trainer.years_experience);
  const categories = (trainer.categories ?? []).slice(0, 2).map(formatTrainerCategory);
  const specialties = trainer.specialties.slice(0, 3).map(formatTrainerSpecialty);
  const formats = trainer.coaching_formats.map(formatCoachingFormat);

  function openProfile() {
    if (onPress) {
      onPress();
      return;
    }
    if (profile.username) pushScreen(`/trainer/${profile.username}`);
  }

  return (
    <Pressable style={styles.card} onPress={openProfile}>
      <View style={styles.header}>
        <Avatar uri={profile.avatar_url} name={profile.display_name} size={64} />
        <View style={styles.identity}>
          <Text style={styles.name}>{profile.display_name}</Text>
          {profile.username ? <Text style={styles.username}>@{profile.username}</Text> : null}
          <TrainerBadge level={trainer.verification_level} compact />
        </View>
      </View>

      {experience ? <Text style={styles.meta}>{experience}</Text> : null}
      {profile.city ? <Text style={styles.meta}>{profile.city}</Text> : null}

      <Text style={styles.availability}>{formatTrainerAvailability(trainer.availability_status)}</Text>

      {categories.length ? (
        <View style={styles.chipRow}>
          {categories.map((label) => (
            <Chip key={label} label={label} selected />
          ))}
        </View>
      ) : null}

      {specialties.length ? (
        <View style={styles.chipRow}>
          {specialties.map((label) => (
            <Chip key={label} label={label} selected />
          ))}
        </View>
      ) : null}

      {formats.length ? <Text style={styles.formats}>{formats.join(" · ")}</Text> : null}
      {budget ? <Text style={styles.budget}>{budget}</Text> : null}

      {preview.length ? (
        <View style={styles.previewRow}>
          {preview.slice(0, 3).map((photo) => (
            <Image key={photo.id} source={{ uri: photo.image_url }} style={styles.previewThumb} />
          ))}
        </View>
      ) : null}

      {connectionStatus === "pending" ? (
        <Text style={styles.statusPending}>Request pending</Text>
      ) : connectionStatus === "connected" ? (
        <Text style={styles.statusConnected}>Connected</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  identity: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typography.heading,
    fontSize: 17,
  },
  username: {
    ...typography.caption,
    color: colors.textMuted,
  },
  meta: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  availability: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: "600",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  formats: {
    ...typography.caption,
    color: colors.textMuted,
  },
  budget: {
    ...typography.bodySmall,
    fontWeight: "600",
  },
  previewRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  previewThumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
  },
  statusPending: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: "italic",
  },
  statusConnected: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "600",
  },
});
