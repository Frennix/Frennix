import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useEffect } from "react";
import { FrennixLogo } from "@/components/FrennixLogo";
import { WhatsNewKnownIssuesSection } from "@/components/whats-new/WhatsNewKnownIssuesSection";
import {
  formatWhatsNewDate,
  getLatestWhatsNewVersion,
  getWhatsNewComingSoon,
  getWhatsNewKnownIssues,
  getWhatsNewReleases,
  isLatestRelease,
  markWhatsNewLaunchPromptSeen,
} from "@/lib/whats-new";
import { colors, spacing, typography } from "@frennix/ui";

type BulletSectionProps = {
  title: string;
  items: string[];
  emptyLabel?: string;
  tone?: "default" | "muted" | "accent";
};

function BulletSection({ title, items, emptyLabel, tone = "default" }: BulletSectionProps) {
  if (!items.length && !emptyLabel) return null;

  return (
    <View style={styles.section}>
      <Text
        style={[
          styles.sectionTitle,
          tone === "accent" && styles.sectionTitleAccent,
          tone === "muted" && styles.sectionTitleMuted,
        ]}
      >
        {title}
      </Text>
      {items.length ? (
        <View style={styles.bulletList}>
          {items.map((item) => (
            <View key={item} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>{emptyLabel}</Text>
      )}
    </View>
  );
}

function ReleaseCard({
  version,
  date,
  title,
  summary,
  features,
  fixes,
  performance,
  knownIssues,
}: ReturnType<typeof getWhatsNewReleases>[number]) {
  const latest = isLatestRelease(version);

  return (
    <View style={[styles.card, latest && styles.cardLatest]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitles}>
          <Text style={styles.cardVersion}>{version}</Text>
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        {latest ? (
          <View style={styles.latestBadge}>
            <Text style={styles.latestBadgeText}>Latest</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.cardDate}>{formatWhatsNewDate(date)}</Text>
      <Text style={styles.cardSummary}>{summary}</Text>

      <BulletSection title="New features" items={features} tone="accent" />
      <BulletSection title="Bug fixes" items={fixes} />
      <BulletSection title="Performance improvements" items={performance} emptyLabel="No performance notes this release." />
      <BulletSection title="Known issues" items={knownIssues} tone="muted" emptyLabel="No known issues." />
    </View>
  );
}

export default function WhatsNewScreen() {
  const releases = getWhatsNewReleases();
  const comingSoon = getWhatsNewComingSoon();
  const knownIssues = getWhatsNewKnownIssues();
  const latestVersion = getLatestWhatsNewVersion();

  useEffect(() => {
    void markWhatsNewLaunchPromptSeen();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <FrennixLogo variant="icon" height={28} style={styles.logo} />
      <Text style={styles.headline}>What&apos;s New</Text>
      <Text style={styles.intro}>
        See what changed in Frennix — new features, fixes, and what we&apos;re building next.
        Current version: {latestVersion}.
      </Text>

      <WhatsNewKnownIssuesSection issues={knownIssues} />

      <Text style={styles.sectionDividerLabel}>Release history</Text>

      {releases.map((release) => (
        <ReleaseCard key={release.version} {...release} />
      ))}

      <View style={styles.comingSoonCard}>
        <Text style={styles.comingSoonTitle}>Coming Soon</Text>
        <Text style={styles.comingSoonIntro}>
          A preview of what we&apos;re working on after the current release. Timing may change.
        </Text>
        <View style={styles.bulletList}>
          {comingSoon.map((item) => (
            <View key={item} style={styles.bulletRow}>
              <Text style={styles.comingSoonBullet}>✦</Text>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl * 2,
    gap: spacing.lg,
  },
  logo: { marginBottom: spacing.xs },
  headline: {
    ...typography.heading,
    color: colors.text,
    fontWeight: "800",
  },
  intro: {
    ...typography.bodySmall,
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  sectionDividerLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingTop: spacing.sm,
  },
  card: {
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardLatest: {
    borderColor: colors.accent,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  cardTitles: { flex: 1, gap: 2 },
  cardVersion: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  cardTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: "800",
  },
  latestBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  latestBadgeText: {
    ...typography.caption,
    color: colors.black,
    fontWeight: "800",
  },
  cardDate: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "600",
  },
  cardSummary: {
    ...typography.bodySmall,
    color: colors.text,
    lineHeight: 21,
  },
  section: { gap: spacing.xs, paddingTop: spacing.xs },
  sectionTitle: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionTitleAccent: { color: colors.accent },
  sectionTitleMuted: { color: colors.textMuted },
  bulletList: { gap: 6 },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  bullet: {
    ...typography.bodySmall,
    color: colors.textMuted,
    lineHeight: 20,
    width: 12,
  },
  bulletText: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
    lineHeight: 20,
  },
  empty: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: "italic",
  },
  comingSoonCard: {
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    gap: spacing.sm,
  },
  comingSoonTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: "800",
  },
  comingSoonIntro: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
  comingSoonBullet: {
    ...typography.bodySmall,
    color: colors.accent,
    lineHeight: 20,
    width: 14,
  },
});
