import { StyleSheet, Text, View } from "react-native";
import type { DiscoverProfileBadge } from "@frennix/types";
import { colors, radius, spacing, typography } from "@frennix/ui";

const BADGE_LABELS: Record<DiscoverProfileBadge, string> = {
  founder: "Founder",
  ambassador: "Ambassador",
  verified_trainer: "Verified Trainer",
  verified: "Verified",
};

const BADGE_STYLES: Record<DiscoverProfileBadge, { bg: string; border: string; text: string }> = {
  founder: { bg: "rgba(99, 102, 241, 0.14)", border: "rgba(99, 102, 241, 0.35)", text: "#6366F1" },
  ambassador: { bg: "rgba(236, 72, 153, 0.14)", border: "rgba(236, 72, 153, 0.35)", text: "#EC4899" },
  verified_trainer: { bg: "rgba(34, 197, 94, 0.14)", border: "rgba(34, 197, 94, 0.35)", text: colors.accent },
  verified: { bg: "rgba(59, 130, 246, 0.14)", border: "rgba(59, 130, 246, 0.35)", text: "#3B82F6" },
};

type ProfileIdentityBadgesProps = {
  badges: DiscoverProfileBadge[];
  compact?: boolean;
};

export function ProfileIdentityBadges({ badges, compact = false }: ProfileIdentityBadgesProps) {
  if (!badges.length) return null;

  return (
    <View style={styles.row}>
      {badges.map((badge) => {
        const palette = BADGE_STYLES[badge];
        return (
          <View
            key={badge}
            style={[
              styles.badge,
              compact && styles.badgeCompact,
              { backgroundColor: palette.bg, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.text, { color: palette.text }]}>{BADGE_LABELS[badge]}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  badge: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeCompact: { paddingHorizontal: spacing.xs },
  text: { ...typography.caption, fontWeight: "700" },
});
