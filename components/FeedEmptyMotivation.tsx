import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { STORY_DAILY_MOTIVATIONS } from "@frennix/types";
import type { SuggestedAthlete } from "@frennix/types";
import { applyShadow, Avatar, colors, overlays, radius, spacing, typography } from "@frennix/ui";
import { openCreatePost, pushScreen, switchTab } from "@/lib/press-utils";

interface FeedEmptyMotivationProps {
  suggestions?: SuggestedAthlete[];
  onShareWorkout?: () => void;
}

export const FeedEmptyMotivation = memo(function FeedEmptyMotivation({
  suggestions = [],
  onShareWorkout,
}: FeedEmptyMotivationProps) {
  const motivation = useMemo(() => {
    const day = new Date().toISOString().slice(0, 10);
    let hash = 0;
    for (let i = 0; i < day.length; i += 1) {
      hash = (hash + day.charCodeAt(i) * (i + 1)) % STORY_DAILY_MOTIVATIONS.length;
    }
    return STORY_DAILY_MOTIVATIONS[hash] ?? STORY_DAILY_MOTIVATIONS[0];
  }, []);

  const topSuggestions = suggestions.slice(0, 3);

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.emoji}>💪</Text>
        <Text style={styles.title}>Your feed is warming up</Text>
        <Text style={styles.body}>{motivation}</Text>
        <Pressable style={styles.cta} onPress={onShareWorkout ?? openCreatePost}>
          <Text style={styles.ctaText}>Share a workout</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>FIND ATHLETES NEAR YOU</Text>
        <Text style={styles.cardTitle}>Build your training circle</Text>
        <Text style={styles.cardBody}>
          Follow athletes, join groups, and discover partners who train like you.
        </Text>
        <Pressable style={styles.linkButton} onPress={() => switchTab("/(tabs)/discover")}>
          <Text style={styles.linkButtonText}>Find athletes near you →</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>CHALLENGE OF THE DAY</Text>
        <Text style={styles.cardTitle}>Show up and log today&apos;s session</Text>
        <Text style={styles.cardBody}>
          Complete a workout and share it to keep your streak alive.
        </Text>
        <Pressable style={styles.linkButton} onPress={() => pushScreen("/events/browse")}>
          <Text style={styles.linkButtonText}>Browse upcoming events →</Text>
        </Pressable>
      </View>

      {topSuggestions.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>SUGGESTED TRAINING PARTNERS</Text>
          <View style={styles.suggestionList}>
            {topSuggestions.map((item) => (
              <Pressable
                key={item.profile.id}
                style={styles.suggestionRow}
                onPress={() => pushScreen(`/user/${item.profile.username}`)}
              >
                <Avatar uri={item.profile.avatar_url} name={item.profile.display_name} size={40} />
                <View style={styles.suggestionText}>
                  <Text style={styles.suggestionName} numberOfLines={1}>
                    {item.profile.display_name}
                  </Text>
                  <Text style={styles.suggestionMeta} numberOfLines={1}>
                    @{item.profile.username}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.sm,
    ...applyShadow("md"),
  },
  emoji: {
    fontSize: 40,
    lineHeight: 44,
    textAlign: "center",
  },
  title: {
    ...typography.section,
    textAlign: "center",
    fontWeight: "800",
  },
  body: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  cta: {
    alignSelf: "center",
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  ctaText: {
    ...typography.button,
    color: colors.black,
    fontWeight: "800",
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  cardTitle: {
    ...typography.body,
    fontWeight: "800",
    color: colors.text,
  },
  cardBody: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  linkButton: {
    alignSelf: "flex-start",
    paddingVertical: spacing.xs,
  },
  linkButtonText: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: "700",
  },
  suggestionList: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: overlays.accentTintSoft,
    borderWidth: 1,
    borderColor: overlays.glassBorder,
  },
  suggestionText: {
    flex: 1,
    gap: 2,
  },
  suggestionName: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "700",
  },
  suggestionMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
