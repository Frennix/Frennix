import { StyleSheet, Text, View } from "react-native";
import type { SuggestedAthlete } from "@frennix/types";
import { BottomActionSheet } from "@/components/BottomActionSheet";
import { FrennixMatchDisplay } from "@/components/FrennixMatchDisplay";
import { ProfileIdentityBadges } from "@/components/ProfileIdentityBadges";
import { buildMutualConnectionsCopy } from "@/lib/discover-mutual-copy";
import { formatActivity, formatGoal } from "@/lib/labels";
import { getLifestyleBadges } from "@/lib/lifestyle-matching";
import { DiscoverProfileCard } from "@frennix/ui";

type DiscoverProfilePreviewSheetProps = {
  visible: boolean;
  athlete: SuggestedAthlete | null;
  highlightQuery?: string;
  viewerUserId?: string;
  onClose: () => void;
  onViewFullProfile: () => void;
  onFollow?: () => void;
  followLabel?: string;
  followLoading?: boolean;
  onMessage?: () => void;
  messageLoading?: boolean;
  onLearnMatch?: () => void;
};

export function DiscoverProfilePreviewSheet({
  visible,
  athlete,
  highlightQuery,
  viewerUserId,
  onClose,
  onViewFullProfile,
  onFollow,
  followLabel,
  followLoading,
  onMessage,
  messageLoading,
  onLearnMatch,
}: DiscoverProfilePreviewSheetProps) {
  if (!athlete) return null;

  const profile = athlete.profile;
  const locationLabel = profile.city?.trim() || profile.home_gym?.trim() || null;
  const mutualCopy = buildMutualConnectionsCopy({
    mutualFollowers: athlete.mutual_count,
    mutualTrainingPartners: athlete.mutualTrainingPartners ?? 0,
    mutualGroups: athlete.mutualGroups ?? 0,
    mutualChallenges: athlete.mutualChallenges ?? 0,
  });

  return (
    <BottomActionSheet visible={visible} onClose={onClose} fitToContent scrollEnabled>
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>Profile preview</Text>
        <DiscoverProfileCard
          profile={profile}
          interestLabels={(profile.activities ?? []).slice(0, 4).map(formatActivity)}
          goalLabels={(profile.fitness_goals ?? []).slice(0, 3).map(formatGoal)}
          locationLabel={locationLabel}
          lifestyleBadges={getLifestyleBadges(profile)}
          identityBadges={<ProfileIdentityBadges badges={athlete.badges ?? []} compact />}
          mutualConnectionsCopy={mutualCopy}
          highlightQuery={highlightQuery}
          presenceVariant="discover"
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
          onMessage={profile.id !== viewerUserId ? onMessage : undefined}
          messageLoading={messageLoading}
        />
      </View>
    </BottomActionSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: 4, paddingBottom: 8 },
  sheetTitle: { fontSize: 17, fontWeight: "700", marginBottom: 8, textAlign: "center" },
});
