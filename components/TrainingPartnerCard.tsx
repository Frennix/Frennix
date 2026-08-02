import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { MatchCandidate, MatchableProfile } from "@frennix/types";
import { FrennixLogo } from "@/components/FrennixLogo";
import { MatchReasonsList } from "@/components/MatchReasonsList";
import { TrainingPartnerMatchBadge } from "@/components/TrainingPartnerMatchBadge";
import { pushScreen } from "@/lib/press-utils";
import {
  getDiscoverAvailability,
  getDiscoverCompactDistanceLabel,
  getDiscoverCompactStreakLabel,
  getDiscoverPartnerStatusInfo,
  getDiscoverRecentActivityLabel,
  getDiscoverWorkoutStyle,
  type DiscoverPartnerStatusTone,
} from "@/lib/discover-profile-display";
import { formatSharedGoalLabels, sharesCity } from "@/lib/training-partner-utils";
import { getTrainingPartnerPurposeLine } from "@/lib/training-partner-purpose-line";
import {
  Chip,
  colors,
  formatPresenceStatus,
  isProfileOnline,
  MenuIconButton,
  overlays,
  ProgressiveImage,
  radius,
  spacing,
  typography,
} from "@frennix/ui";

const PHOTO_HEIGHT = 172;
const PHOTO_FALLBACK_LOGO_SIZE = 56;

type TrainingPartnerCardProps = {
  candidate: MatchCandidate | MatchableProfile;
  viewer: MatchableProfile;
  onPressProfile?: () => void;
  onLearnMoreMatch?: () => void;
  onReportOrBlock?: () => void;
  accessibilityLabel?: string;
};

type FieldGlyph = "location" | "workout" | "availability" | "streak";

function isScoredCandidate(
  candidate: MatchCandidate | MatchableProfile
): candidate is MatchCandidate {
  return "match_reasons" in candidate && Array.isArray(candidate.match_reasons);
}

function FieldGlyphIcon({ kind, accent = false }: { kind: FieldGlyph; accent?: boolean }) {
  const color = accent ? colors.accent : colors.textMuted;

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
    case "availability":
      return (
        <View style={styles.glyphClock}>
          <View style={[styles.glyphClockFace, { borderColor: color }]} />
          <View style={[styles.glyphClockHand, { backgroundColor: color }]} />
        </View>
      );
    case "streak":
      return <Text style={[styles.glyphEmoji, { color }]}>🔥</Text>;
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
      <Text style={[styles.fieldValue, emphasize && styles.fieldValueEmphasis]} numberOfLines={1}>
        {value}
      </Text>
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

function PhotoBottomGradient() {
  return (
    <View style={styles.photoGradient} pointerEvents="none">
      <View style={styles.photoGradientFadeLight} />
      <View style={styles.photoGradientFadeMid} />
      <View style={styles.photoGradientFadeStrong} />
      <View style={styles.photoGradientFadeDeep} />
      <View style={styles.photoGradientFadeBottom} />
    </View>
  );
}

function BrandedPhotoFallback() {
  return (
    <View style={styles.photoFallback}>
      <View style={styles.photoFallbackBrand}>
        <FrennixLogo variant="icon" size={PHOTO_FALLBACK_LOGO_SIZE} accessibilityLabel="Frennix profile placeholder" />
      </View>
    </View>
  );
}

function PhotoNameOverlay({
  displayName,
  purposeLine,
}: {
  displayName: string | null | undefined;
  purposeLine: string | null;
}) {
  if (!displayName?.trim()) return null;

  return (
    <View style={styles.photoNameOverlay} pointerEvents="none">
      <Text style={styles.photoName} numberOfLines={1}>
        {displayName.trim()}
      </Text>
      {purposeLine ? (
        <Text style={styles.photoPurpose} numberOfLines={1}>
          {purposeLine}
        </Text>
      ) : null}
    </View>
  );
}

function ProfilePhotoBanner({
  candidate,
  partnerStatusLabel,
  partnerStatusTone,
  showActivityIndicator,
  purposeLine,
  onReportOrBlock,
}: {
  candidate: MatchCandidate | MatchableProfile;
  partnerStatusLabel: string;
  partnerStatusTone: DiscoverPartnerStatusTone;
  showActivityIndicator: boolean;
  purposeLine: string | null;
  onReportOrBlock?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const uri = candidate.avatar_url?.trim() || null;
  const statusStyles = partnerStatusStyles(partnerStatusTone);
  const photoScale = useRef(new Animated.Value(1.02)).current;

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  useEffect(() => {
    photoScale.setValue(1.02);
    Animated.spring(photoScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 18,
      bounciness: 3,
    }).start();
  }, [candidate.id, photoScale]);

  return (
    <View
      style={styles.photoBanner}
      accessibilityLabel={candidate.display_name ? `${candidate.display_name} photo` : "Profile photo"}
    >
      <Animated.View style={[styles.photoMedia, { transform: [{ scale: photoScale }] }]}>
        {uri && !failed ? (
          <ProgressiveImage
            uri={uri}
            style={styles.photoImage}
            contentFit="cover"
            accessibilityLabel={
              candidate.display_name ? `${candidate.display_name} profile photo` : "Profile photo"
            }
            onError={() => setFailed(true)}
            recyclingKey={`training-partner-photo-${uri}`}
            showPlaceholder={false}
          />
        ) : (
          <BrandedPhotoFallback />
        )}
      </Animated.View>

      <PhotoBottomGradient />

      <PhotoNameOverlay displayName={candidate.display_name} purposeLine={purposeLine} />

      <View style={[styles.photoStatusBadge, statusStyles.badge]}>
        <Text style={[styles.photoStatusText, statusStyles.text]} numberOfLines={1}>
          {partnerStatusLabel}
        </Text>
      </View>

      <View
        style={styles.photoVerificationBadgeSlot}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />

      {onReportOrBlock ? (
        <MenuIconButton
          compact
          onPress={onReportOrBlock}
          accessibilityLabel={`Report or block ${candidate.display_name ?? "this athlete"}`}
          style={styles.overflowMenu}
        />
      ) : null}

      {showActivityIndicator ? (
        <View style={styles.photoActivityDot} accessibilityLabel="Recently active" />
      ) : null}
    </View>
  );
}

export function TrainingPartnerCard({
  candidate,
  viewer,
  onPressProfile,
  onLearnMoreMatch,
  onReportOrBlock,
  accessibilityLabel,
}: TrainingPartnerCardProps) {
  const sharedGoals = formatSharedGoalLabels(viewer, candidate);
  const sameCity = sharesCity(viewer, candidate);
  const reasons = isScoredCandidate(candidate) ? candidate.match_reasons : [];
  const streak = isScoredCandidate(candidate) ? candidate.workout_streak : 0;
  const presenceOnline = isProfileOnline(candidate);
  const presenceLabel = formatPresenceStatus(candidate);
  const matchScore = isScoredCandidate(candidate) ? candidate.match_score : null;

  const partnerStatus = getDiscoverPartnerStatusInfo(candidate);
  const activityLabel = getDiscoverRecentActivityLabel(candidate);
  const workoutStyle = getDiscoverWorkoutStyle(candidate);
  const availability = getDiscoverAvailability(candidate);
  const distanceLabel = getDiscoverCompactDistanceLabel(candidate);
  const streakLabel = getDiscoverCompactStreakLabel(streak);
  const purposeLine = getTrainingPartnerPurposeLine(candidate);

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
    <View
      style={styles.card}
      accessibilityLabel={accessibilityLabel}
      accessible={Boolean(accessibilityLabel)}
    >
      <ProfilePhotoBanner
        candidate={candidate}
        partnerStatusLabel={partnerStatus.label}
        partnerStatusTone={partnerStatus.tone}
        showActivityIndicator={Boolean(activityLabel)}
        purposeLine={purposeLine}
        onReportOrBlock={onReportOrBlock}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        testID="training-partner-card-scroll"
      >
        <View style={styles.profileInfoSection}>
          {matchScore != null && matchScore > 0 ? (
            <TrainingPartnerMatchBadge score={matchScore} onLearnMore={onLearnMoreMatch} />
          ) : null}

          <View style={styles.identity}>
            {candidate.username ? (
              <Text style={styles.username} numberOfLines={1}>
                @{candidate.username}
              </Text>
            ) : null}
            {activityLabel ? (
              <View style={styles.activityRow}>
                <View style={styles.activityDotInline} />
                <Text style={styles.activityLabel}>{activityLabel}</Text>
              </View>
            ) : presenceLabel ? (
              <Text style={[styles.presence, presenceOnline && styles.presenceOnline]}>
                {presenceLabel}
              </Text>
            ) : null}
            {candidate.city ? (
              <Text style={[styles.location, sameCity && styles.locationMatch]} numberOfLines={1}>
                {sameCity ? "Same city · " : ""}
                {candidate.city}
              </Text>
            ) : null}
          </View>
        </View>

        {reasons.length ? (
          <View style={styles.sectionBlock}>
            <MatchReasonsList reasons={reasons} variant="deck" />
          </View>
        ) : null}

        {sharedGoals.length ? (
          <View style={[styles.sectionBlock, styles.chipSection]}>
            <Text style={styles.chipSectionTitle}>Mutual goals</Text>
            <View style={styles.chipRow}>
              {sharedGoals.map((label) => (
                <Chip key={`shared-goal-${label}`} label={label} selected />
              ))}
            </View>
          </View>
        ) : null}

        <View style={[styles.sectionBlock, styles.trainingBlock]}>
          {workoutStyle ? (
            <CompactFieldRow kind="workout" value={workoutStyle} emphasize />
          ) : null}
          {availability ? <CompactFieldRow kind="availability" value={availability} /> : null}
          {distanceLabel ? <CompactFieldRow kind="location" value={distanceLabel} /> : null}
          {streakLabel ? <CompactFieldRow kind="streak" value={streakLabel} /> : null}
        </View>

        {candidate.bio?.trim() ? (
          <View style={styles.bioSection}>
            <Text style={styles.bio} numberOfLines={3}>
              {candidate.bio.trim()}
            </Text>
          </View>
        ) : null}

        {candidate.username ? (
          <Pressable
            onPress={openProfile}
            hitSlop={8}
            accessibilityRole="link"
            accessibilityLabel={`View full profile for ${candidate.display_name}`}
          >
            <Text style={styles.profileLink}>View full profile →</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
  },
  photoBanner: {
    width: "100%",
    height: PHOTO_HEIGHT,
    backgroundColor: colors.surfaceElevated,
    position: "relative",
    overflow: "hidden",
  },
  photoMedia: {
    ...StyleSheet.absoluteFillObject,
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
  photoFallbackBrand: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: overlays.accentTintSoft,
    borderWidth: 2,
    borderColor: overlays.accentBorder,
  },
  photoGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "74%",
    justifyContent: "flex-end",
  },
  photoGradientFadeLight: {
    height: 14,
    backgroundColor: "rgba(0, 0, 0, 0.08)",
  },
  photoGradientFadeMid: {
    height: 18,
    backgroundColor: "rgba(0, 0, 0, 0.28)",
  },
  photoGradientFadeStrong: {
    height: 22,
    backgroundColor: "rgba(0, 0, 0, 0.52)",
  },
  photoGradientFadeDeep: {
    height: 26,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
  },
  photoGradientFadeBottom: {
    height: 32,
    backgroundColor: "rgba(0, 0, 0, 0.88)",
  },
  photoNameOverlay: {
    position: "absolute",
    left: 12,
    right: 52,
    bottom: 14,
    gap: 4,
  },
  photoName: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.5,
    lineHeight: 32,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  photoPurpose: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(250, 250, 250, 0.92)",
    lineHeight: 17,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  photoStatusBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    maxWidth: "58%",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  photoStatusBadgePartner: {
    backgroundColor: "rgba(34, 197, 94, 0.22)",
    borderColor: colors.accent,
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
    fontWeight: "800",
    lineHeight: 12,
    letterSpacing: 0.35,
    textTransform: "uppercase",
  },
  photoStatusTextPartner: {
    color: "#4ADE80",
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
  photoVerificationBadgeSlot: {
    position: "absolute",
    top: 42,
    right: 10,
    width: 88,
    height: 18,
  },
  overflowMenu: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: overlays.glassStrong,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: overlays.glassBorder,
  },
  photoActivityDot: {
    position: "absolute",
    right: 10,
    bottom: 14,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.surfaceCard,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  profileInfoSection: {
    gap: spacing.sm,
  },
  sectionBlock: {
    marginTop: spacing.lg,
  },
  identity: {
    gap: 4,
  },
  username: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontWeight: "500",
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  activityDotInline: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  activityLabel: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: "600",
    lineHeight: 16,
  },
  presence: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  presenceOnline: {
    color: colors.accent,
    fontWeight: "600",
  },
  location: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  locationMatch: {
    color: colors.accent,
    fontWeight: "600",
  },
  chipSection: {
    gap: spacing.sm,
  },
  chipSectionTitle: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 10,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  trainingBlock: {
    gap: 4,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 22,
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
  bioSection: {
    paddingTop: 2,
  },
  bio: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  profileLink: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: "600",
    paddingTop: 2,
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
  glyphEmoji: {
    fontSize: 10,
    lineHeight: 12,
  },
});
