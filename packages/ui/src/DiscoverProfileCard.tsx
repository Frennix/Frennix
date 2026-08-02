import { memo, useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View, type ReactNode } from "react-native";
import type { Profile } from "@frennix/types";
import { ProgressiveImage } from "./ProgressiveImage";
import { Button } from "./Button";
import { formatPresenceStatus, isProfileOnline } from "./presence";
import { applyShadow, colors, overlays, radius, spacing, typography } from "./theme";

export type DiscoverProfileCardVariant = "grid" | "detail";

export type DiscoverPartnerStatusTone = "partner" | "available" | "training" | "trainer";

const GRID_PHOTO_HEIGHT = 116;
const DETAIL_PHOTO_HEIGHT = 165;

interface DiscoverProfileCardProps {
  profile: Profile;
  firstName: string;
  distanceLabel?: string | null;
  workoutStyleLabel?: string | null;
  fitnessGoalLabel?: string | null;
  availabilityLabel?: string | null;
  partnerStatusLabel: string;
  partnerStatusTone?: DiscoverPartnerStatusTone;
  activityLabel?: string | null;
  streakLabel?: string | null;
  matchPercent?: number | null;
  matchDisplay?: ReactNode;
  reason?: string;
  variant?: DiscoverProfileCardVariant;
  onPress?: () => void;
  onViewProfile: () => void;
  followLabel?: string;
  onFollow?: () => void;
  followLoading?: boolean;
}

type FieldGlyph = "location" | "workout" | "goal" | "availability";

function FieldGlyphIcon({ kind, accent = false }: { kind: FieldGlyph; accent?: boolean }) {
  const color = accent ? GLYPH_ACCENT : GLYPH_COLOR;

  switch (kind) {
    case "location":
      return (
        <View style={styles.glyphPin}>
          <View style={[styles.glyphPinHead, { borderColor: color }]} />
          <View style={[styles.glyphPinTail, { borderTopColor: color }]} />
        </View>
      );
    case "workout":
      return (
        <View style={styles.glyphWorkout}>
          <View style={[styles.glyphWorkoutWeight, { backgroundColor: color }]} />
          <View style={[styles.glyphWorkoutBar, { backgroundColor: color }]} />
          <View style={[styles.glyphWorkoutWeight, { backgroundColor: color }]} />
        </View>
      );
    case "goal":
      return (
        <View style={styles.glyphGoal}>
          <View style={[styles.glyphGoalOuter, { borderColor: color }]} />
          <View style={[styles.glyphGoalInner, { backgroundColor: color }]} />
        </View>
      );
    case "availability":
      return (
        <View style={styles.glyphClock}>
          <View style={[styles.glyphClockFace, { borderColor: color }]} />
          <View style={[styles.glyphClockHand, { backgroundColor: color }]} />
        </View>
      );
  }
}

function CompactFieldRow({
  kind,
  value,
  emphasize = false,
}: {
  kind: FieldGlyph;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <View style={styles.fieldRow}>
      <View style={[styles.fieldIcon, emphasize && styles.fieldIconEmphasis]}>
        <FieldGlyphIcon kind={kind} accent={emphasize} />
      </View>
      <Text
        style={[styles.fieldValue, emphasize && styles.fieldValueEmphasis]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function PhotoBottomGradient() {
  return (
    <View style={styles.photoGradient} pointerEvents="none">
      <View style={styles.photoGradientFadeLight} />
      <View style={styles.photoGradientFadeMid} />
      <View style={styles.photoGradientFadeStrong} />
    </View>
  );
}

function partnerStatusStyles(tone: DiscoverPartnerStatusTone) {
  switch (tone) {
    case "partner":
      return { badge: styles.photoStatusBadgePartner, text: styles.photoStatusTextPartner };
    case "training":
      return { badge: styles.photoStatusBadgeTraining, text: styles.photoStatusTextTraining };
    case "trainer":
      return { badge: styles.photoStatusBadgeTrainer, text: styles.photoStatusTextTrainer };
    case "available":
    default:
      return { badge: styles.photoStatusBadgeAvailable, text: styles.photoStatusTextAvailable };
  }
}

function ProfilePhotoBanner({
  profile,
  height,
  partnerStatusLabel,
  partnerStatusTone = "available",
  showActivityIndicator,
  activityLabel,
}: {
  profile: Profile;
  height: number;
  partnerStatusLabel: string;
  partnerStatusTone?: DiscoverPartnerStatusTone;
  showActivityIndicator: boolean;
  activityLabel?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const uri = profile.avatar_url?.trim() || null;
  const statusStyles = partnerStatusStyles(partnerStatusTone);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  const initials = profile.display_name
    ?.split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <View
      style={[styles.photoBanner, { height }]}
      accessibilityLabel={profile.display_name ? `${profile.display_name} photo` : "Profile photo"}
    >
      {uri && !failed ? (
        <ProgressiveImage
          uri={uri}
          style={styles.photoImage}
          contentFit="cover"
          accessibilityLabel={profile.display_name ? `${profile.display_name} profile photo` : "Profile photo"}
          onError={() => setFailed(true)}
          recyclingKey={`discover-photo-${uri}`}
          showPlaceholder={false}
        />
      ) : (
        <View style={styles.photoFallback}>
          <Text style={styles.photoInitials}>{initials ?? "?"}</Text>
        </View>
      )}

      <PhotoBottomGradient />

      <View style={[styles.photoStatusBadge, statusStyles.badge]}>
        <Text style={[styles.photoStatusText, statusStyles.text]} numberOfLines={1}>
          {partnerStatusLabel}
        </Text>
      </View>

      <View style={styles.photoRoleBadgeSlot} accessibilityElementsHidden importantForAccessibility="no" />

      {showActivityIndicator ? (
        <View style={styles.photoActivityDot} accessibilityLabel={activityLabel ?? "Recently active"} />
      ) : null}
    </View>
  );
}

function MatchPercentPill({ percent }: { percent: number }) {
  return (
    <View style={styles.matchPill}>
      <Text style={styles.matchPillText}>{Math.round(percent)}% Match</Text>
    </View>
  );
}

export const DiscoverProfileCard = memo(function DiscoverProfileCard({
  profile,
  firstName,
  distanceLabel,
  workoutStyleLabel,
  fitnessGoalLabel,
  availabilityLabel,
  partnerStatusLabel,
  partnerStatusTone = "available",
  activityLabel,
  streakLabel,
  matchPercent,
  matchDisplay,
  reason,
  variant = "grid",
  onPress,
  onViewProfile,
  followLabel,
  onFollow,
  followLoading,
}: DiscoverProfileCardProps) {
  const online = isProfileOnline(profile);
  const presenceLabel = formatPresenceStatus(profile);
  const isGrid = variant === "grid";
  const photoHeight = isGrid ? GRID_PHOTO_HEIGHT : DETAIL_PHOTO_HEIGHT;
  const showActivityIndicator = Boolean(activityLabel);
  const showCompactMatch = isGrid && matchPercent != null && matchPercent > 0;

  const cardBody = (
    <>
      <ProfilePhotoBanner
        profile={profile}
        height={photoHeight}
        partnerStatusLabel={partnerStatusLabel}
        partnerStatusTone={partnerStatusTone}
        showActivityIndicator={showActivityIndicator}
        activityLabel={activityLabel}
      />

      <View style={styles.content}>
        <View style={styles.identityBlock}>
          <Text style={styles.firstName} numberOfLines={1}>
            {firstName}
          </Text>
          {activityLabel ? (
            <View style={styles.activityRow}>
              <View style={styles.activityDotInline} />
              <Text style={styles.activityLabel}>{activityLabel}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.trainingBlock}>
          <CompactFieldRow kind="workout" value={workoutStyleLabel ?? "Any workout"} emphasize />
          <CompactFieldRow kind="goal" value={fitnessGoalLabel ?? "Goal not set"} />
          <CompactFieldRow kind="availability" value={availabilityLabel ?? "Flexible"} />
          {distanceLabel ? <CompactFieldRow kind="location" value={distanceLabel} /> : null}
        </View>

        {streakLabel || showCompactMatch || (!isGrid && matchDisplay) ? (
          <View style={styles.statsRow}>
            {streakLabel ? (
              <Text style={styles.streakLabel} numberOfLines={1}>
                {streakLabel}
              </Text>
            ) : (
              <View style={styles.statsSpacer} />
            )}
            {showCompactMatch ? (
              <MatchPercentPill percent={matchPercent ?? 0} />
            ) : !isGrid && matchDisplay ? (
              <View style={styles.matchDisplay}>{matchDisplay}</View>
            ) : null}
          </View>
        ) : null}

        {!isGrid && reason ? <Text style={styles.reason}>{reason}</Text> : null}
        {!isGrid && presenceLabel ? (
          <Text style={[styles.presence, online && styles.presenceOnline]}>{presenceLabel}</Text>
        ) : null}

        {!isGrid ? (
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
            <Button title="View profile" variant="secondary" onPress={onViewProfile} style={styles.actionButton} />
          </View>
        ) : null}
      </View>
    </>
  );

  if (isGrid) {
    return (
      <Pressable
        style={({ pressed }) => [styles.cardGrid, pressed && styles.cardPressed]}
        onPress={onPress ?? onViewProfile}
        accessibilityRole="button"
        accessibilityLabel={`${firstName}, ${workoutStyleLabel ?? "workout not set"}, ${fitnessGoalLabel ?? "goal not set"}`}
      >
        {cardBody}
      </Pressable>
    );
  }

  return <View style={styles.cardDetail}>{cardBody}</View>;
});

const GLYPH_COLOR = colors.textMuted;
const GLYPH_ACCENT = colors.accent;

const styles = StyleSheet.create({
  cardGrid: {
    flex: 1,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
    ...applyShadow("sm"),
  },
  cardDetail: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: "hidden",
    ...applyShadow("md"),
  },
  cardPressed: {
    opacity: 0.98,
    transform: [{ scale: 0.985 }],
    ...Platform.select({
      web: { boxShadow: "0 4px 14px rgba(0,0,0,0.28)" },
      default: {
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 8,
        elevation: 5,
      },
    }),
  },
  photoBanner: {
    width: "100%",
    backgroundColor: colors.surfaceElevated,
    position: "relative",
    overflow: "hidden",
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  photoFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
  },
  photoInitials: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.accent,
    letterSpacing: 0.5,
  },
  photoGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "52%",
    justifyContent: "flex-end",
  },
  photoGradientFadeLight: {
    height: 18,
    backgroundColor: "rgba(10, 10, 11, 0.08)",
  },
  photoGradientFadeMid: {
    height: 22,
    backgroundColor: "rgba(10, 10, 11, 0.28)",
  },
  photoGradientFadeStrong: {
    height: 26,
    backgroundColor: "rgba(10, 10, 11, 0.52)",
  },
  photoStatusBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    maxWidth: "62%",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  photoStatusBadgePartner: {
    backgroundColor: overlays.glassStrong,
    borderColor: overlays.accentBorder,
  },
  photoStatusBadgeAvailable: {
    backgroundColor: overlays.glassMedium,
    borderColor: overlays.glassBorder,
  },
  photoStatusBadgeTraining: {
    backgroundColor: overlays.warningTintSoft,
    borderColor: overlays.warningBorderSoft,
  },
  photoStatusBadgeTrainer: {
    backgroundColor: overlays.accentTintStrong,
    borderColor: overlays.accentBorder,
  },
  photoStatusText: {
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
    letterSpacing: 0.2,
  },
  photoStatusTextPartner: {
    color: colors.accent,
  },
  photoStatusTextAvailable: {
    color: colors.textSecondary,
  },
  photoStatusTextTraining: {
    color: colors.warning,
  },
  photoStatusTextTrainer: {
    color: colors.accent,
  },
  photoRoleBadgeSlot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 20,
  },
  photoActivityDot: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.surfaceCard,
  },
  content: {
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 9,
    gap: 2,
  },
  identityBlock: {
    gap: 2,
    marginBottom: 1,
  },
  firstName: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  activityDotInline: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  activityLabel: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: "600",
    lineHeight: 14,
  },
  trainingBlock: {
    gap: 1,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 18,
  },
  fieldIcon: {
    width: 22,
    height: 22,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  fieldIconEmphasis: {
    backgroundColor: overlays.accentTintSoft,
    borderColor: overlays.accentBorder,
  },
  fieldValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    color: colors.textSecondary,
    lineHeight: 16,
  },
  fieldValueEmphasis: {
    fontSize: 14,
    color: colors.text,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
    marginTop: 3,
    minHeight: 20,
  },
  statsSpacer: {
    flex: 1,
  },
  streakLabel: {
    flex: 1,
    fontSize: 12,
    color: colors.warning,
    fontWeight: "700",
    lineHeight: 16,
  },
  matchPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: overlays.accentTintSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: overlays.accentBorder,
  },
  matchPillText: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: "700",
    lineHeight: 14,
  },
  matchDisplay: {
    alignItems: "flex-end",
  },
  reason: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  presence: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
  },
  presenceOnline: {
    color: colors.accent,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionButton: {
    flex: 1,
    minHeight: 40,
  },
  glyphPin: {
    width: 10,
    height: 12,
    alignItems: "center",
  },
  glyphPinHead: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1.5,
    backgroundColor: "transparent",
  },
  glyphPinTail: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 3.5,
    borderRightWidth: 3.5,
    borderTopWidth: 4.5,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  glyphWorkout: {
    width: 12,
    height: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  glyphWorkoutWeight: {
    width: 3,
    height: 7,
    borderRadius: 1,
  },
  glyphWorkoutBar: {
    width: 5,
    height: 2,
    borderRadius: 1,
  },
  glyphGoal: {
    width: 10,
    height: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  glyphGoalOuter: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  glyphGoalInner: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  glyphClock: {
    width: 10,
    height: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  glyphClockFace: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  glyphClockHand: {
    width: 1.5,
    height: 3.5,
    borderRadius: 1,
    transform: [{ translateY: -1 }, { rotate: "45deg" }],
  },
});
