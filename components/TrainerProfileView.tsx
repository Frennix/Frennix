import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { TrainerProfileBundle } from "@frennix/types";
import { TrainerBadge } from "@/components/TrainerBadge";
import {
  formatCoachingFormat,
  formatPortfolioCategory,
  formatTrainerAvailability,
  formatTrainerCategory,
  formatTrainerSpecialty,
} from "@/lib/trainer-labels";
import { displaySocialHandle, formatTrainerBudgetRange, formatYearsExperience } from "@/lib/trainer-utils";
import { Avatar, Chip, colors, radius, spacing, typography } from "@frennix/ui";

type TrainerProfileViewProps = {
  bundle: TrainerProfileBundle;
  showSocialLinks?: boolean;
};

const SOCIAL_FIELDS = [
  { key: "instagram_url" as const, label: "Instagram" },
  { key: "tiktok_url" as const, label: "TikTok" },
  { key: "youtube_url" as const, label: "YouTube" },
  { key: "website_url" as const, label: "Website" },
  { key: "linkedin_url" as const, label: "LinkedIn" },
];

export function TrainerProfileView({ bundle, showSocialLinks = true }: TrainerProfileViewProps) {
  const { profile, trainer, certifications, portfolio } = bundle;
  const approvedCerts = certifications.filter((c) => c.review_status === "approved");
  const budget = formatTrainerBudgetRange(trainer);
  const experience = formatYearsExperience(trainer.years_experience);
  const categoryLabels = (trainer.categories ?? []).map(formatTrainerCategory);
  const specialtyLabels = trainer.specialties.map(formatTrainerSpecialty);
  if (trainer.other_specialty) specialtyLabels.push(trainer.other_specialty);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Avatar uri={profile.avatar_url} name={profile.display_name} size={96} />
        <Text style={styles.name}>{profile.display_name}</Text>
        {profile.username ? <Text style={styles.username}>@{profile.username}</Text> : null}
        <TrainerBadge level={trainer.verification_level} />
        {experience ? <Text style={styles.meta}>{experience}</Text> : null}
        {profile.city ? <Text style={styles.meta}>{profile.city}</Text> : null}
        <Text style={styles.availability}>{formatTrainerAvailability(trainer.availability_status)}</Text>
      </View>

      {trainer.coaching_formats.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coaching format</Text>
          <View style={styles.chipRow}>
            {trainer.coaching_formats.map((f) => (
              <Chip key={f} label={formatCoachingFormat(f)} selected />
            ))}
          </View>
        </View>
      ) : null}

      {budget ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly budget</Text>
          <Text style={styles.body}>{budget}</Text>
        </View>
      ) : null}

      {trainer.bio ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.body}>{trainer.bio}</Text>
        </View>
      ) : null}

      {trainer.experience ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Experience</Text>
          <Text style={styles.body}>{trainer.experience}</Text>
        </View>
      ) : null}

      {trainer.training_philosophy ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Training philosophy</Text>
          <Text style={styles.body}>{trainer.training_philosophy}</Text>
        </View>
      ) : null}

      {categoryLabels.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coach type</Text>
          <View style={styles.chipRow}>
            {categoryLabels.map((label) => (
              <Chip key={label} label={label} selected />
            ))}
          </View>
        </View>
      ) : null}

      {specialtyLabels.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Specialties</Text>
          <View style={styles.chipRow}>
            {specialtyLabels.map((label) => (
              <Chip key={label} label={label} selected />
            ))}
          </View>
        </View>
      ) : null}

      {approvedCerts.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Certifications</Text>
          {approvedCerts.map((cert) => (
            <View key={cert.id} style={styles.certRow}>
              <Text style={styles.certName}>{cert.name}</Text>
              {cert.issuer ? <Text style={styles.certMeta}>{cert.issuer}</Text> : null}
              {cert.issued_year ? <Text style={styles.certMeta}>{cert.issued_year}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      {portfolio.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Portfolio</Text>
          <View style={styles.portfolioGrid}>
            {portfolio.map((photo) => (
              <View key={photo.id} style={styles.portfolioItem}>
                <Image source={{ uri: photo.image_url }} style={styles.portfolioImage} />
                <Text style={styles.portfolioCaption}>
                  {photo.caption ?? formatPortfolioCategory(photo.category)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {showSocialLinks ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Links</Text>
          {SOCIAL_FIELDS.map(({ key, label }) => {
            const url = trainer[key];
            if (!url) return null;
            const handle = displaySocialHandle(url);
            return (
              <Pressable key={key} onPress={() => Linking.openURL(url)}>
                <Text style={styles.link}>
                  {label}: {handle}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  hero: {
    alignItems: "center",
    gap: spacing.xs,
  },
  name: {
    ...typography.heading,
    fontSize: 22,
    textAlign: "center",
  },
  username: {
    ...typography.bodySmall,
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
    marginTop: spacing.xs,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.heading,
    fontSize: 16,
  },
  body: {
    ...typography.body,
    color: colors.text,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  certRow: {
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  certName: {
    ...typography.body,
    fontWeight: "600",
  },
  certMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  portfolioGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  portfolioItem: {
    width: "47%",
    gap: spacing.xs,
  },
  portfolioImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.border,
  },
  portfolioCaption: {
    ...typography.caption,
    color: colors.textMuted,
  },
  link: {
    ...typography.body,
    color: colors.accent,
    paddingVertical: 4,
  },
});
