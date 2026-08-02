import { StyleSheet, Text, View } from "react-native";
import type { SuggestedAthlete } from "@frennix/types";
import { BottomActionSheet } from "@/components/BottomActionSheet";
import { FrennixMatchDisplay } from "@/components/FrennixMatchDisplay";
import {
  getDiscoverAvailability,
  getDiscoverDistanceLabel,
  getDiscoverFirstName,
  getDiscoverFitnessGoal,
  getDiscoverPartnerStatusInfo,
  getDiscoverRecentActivityLabel,
  getDiscoverStreakLabel,
  getDiscoverWorkoutStyle,
} from "@/lib/discover-profile-display";
import { DiscoverProfileCard } from "@frennix/ui";

type DiscoverProfilePreviewSheetProps = {
  visible: boolean;
  athlete: SuggestedAthlete | null;
  workoutStreak?: number;
  onClose: () => void;
  onViewFullProfile: () => void;
  onFollow?: () => void;
  followLabel?: string;
  followLoading?: boolean;
  onLearnMatch?: () => void;
};

export function DiscoverProfilePreviewSheet({
  visible,
  athlete,
  workoutStreak = 0,
  onClose,
  onViewFullProfile,
  onFollow,
  followLabel,
  followLoading,
  onLearnMatch,
}: DiscoverProfilePreviewSheetProps) {
  if (!athlete) return null;

  const profile = athlete.profile;
  const partnerStatus = getDiscoverPartnerStatusInfo(profile);

  return (
    <BottomActionSheet visible={visible} onClose={onClose} fitToContent scrollEnabled>
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>Training partner preview</Text>
        <DiscoverProfileCard
          profile={profile}
          firstName={getDiscoverFirstName(profile)}
          distanceLabel={getDiscoverDistanceLabel(profile)}
          workoutStyleLabel={getDiscoverWorkoutStyle(profile)}
          fitnessGoalLabel={getDiscoverFitnessGoal(profile)}
          availabilityLabel={getDiscoverAvailability(profile)}
          partnerStatusLabel={partnerStatus.label}
          partnerStatusTone={partnerStatus.tone}
          activityLabel={getDiscoverRecentActivityLabel(profile)}
          streakLabel={getDiscoverStreakLabel(workoutStreak)}
          variant="detail"
          matchDisplay={
            athlete.compatibility_score > 0 ? (
              <FrennixMatchDisplay
                score={athlete.compatibility_score}
                variant="compact"
                onLearnMore={onLearnMatch}
              />
            ) : null
          }
          reason={athlete.reason || undefined}
          onViewProfile={onViewFullProfile}
          followLabel={followLabel}
          onFollow={onFollow}
          followLoading={followLoading}
        />
      </View>
    </BottomActionSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: 4, paddingBottom: 8 },
  sheetTitle: { fontSize: 17, fontWeight: "700", marginBottom: 8, textAlign: "center" },
});
