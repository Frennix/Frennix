import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Post, Profile, SuggestedAthlete } from "@frennix/types";
import { Button } from "@frennix/ui";
import { DiscoverProfilePreviewSheet } from "@/components/DiscoverProfilePreviewSheet";
import { LocationOnboardingStep } from "@/components/LocationOnboardingStep";
import { ManualLocationSheet } from "@/components/ManualLocationSheet";
import { PostInteractionSheet } from "@/components/PostInteractionSheet";

const profile = {
  id: "u1",
  username: "ada",
  display_name: "Ada Lovelace",
  avatar_url: null,
  bio: null,
  fitness_goals: ["strength"],
  activities: ["running"],
  city: "Austin",
  visibility: "public",
  matching_enabled: true,
  gender: null,
  match_preference: null,
  is_premium: false,
  onboarding_complete: true,
  created_at: "2026-01-01T00:00:00.000Z",
} as Profile;

const athlete = {
  profile,
  score: 80,
  reason: "You both run",
  mutual_count: 1,
  shared_activities: ["running"],
  shared_goals: ["strength"],
  compatibility_score: 80,
} as SuggestedAthlete & { compatibility_score: number };

const post = {
  id: "p1",
  author_id: "u1",
  post_type: "text",
  content: "Morning run",
  media_urls: [],
  created_at: "2026-01-01T00:00:00.000Z",
  author: profile,
} as unknown as Post & { author?: Profile };

/** Dev-only render target for the manual-location sheet regression. Not an app route. */
export function ManualLocationSheetHarness() {
  const [manualVisible, setManualVisible] = useState(false);
  const [manualOpens, setManualOpens] = useState(0);
  const [savedCity, setSavedCity] = useState("No city saved");
  const [onboardingResolved, setOnboardingResolved] = useState("pending");
  const [postVisible, setPostVisible] = useState(false);
  const [discoverVisible, setDiscoverVisible] = useState(false);
  const [postPanel, setPostPanel] = useState<"primary" | "more">("primary");

  return (
    <SafeAreaProvider>
      <View nativeID="manual-location-harness" style={styles.root}>
        <Text nativeID="saved-city">{savedCity}</Text>
        <Text nativeID="manual-open-count">{String(manualOpens)}</Text>
        <Text nativeID="onboarding-resolved">{onboardingResolved}</Text>
        <Button
          title="Open manual sheet"
          onPress={() => {
            setManualOpens((count) => count + 1);
            setManualVisible(true);
          }}
        />
        <ManualLocationSheet
          visible={manualVisible}
          onClose={() => setManualVisible(false)}
          onSave={async (place) => {
            setSavedCity(`${place.city}, ${place.state ?? ""}`);
          }}
        />

        <Button title="Open post sheet" onPress={() => setPostVisible(true)} />
        <PostInteractionSheet
          visible={postVisible}
          post={post}
          panel={postPanel}
          lastReactionId={null}
          onPanelChange={setPostPanel}
          liked={false}
          myReaction={null}
          saved={false}
          onAction={() => undefined}
          onClose={() => {
            setPostPanel("primary");
            setPostVisible(false);
          }}
        />

        <Button title="Open discover sheet" onPress={() => setDiscoverVisible(true)} />
        <DiscoverProfilePreviewSheet
          visible={discoverVisible}
          athlete={athlete}
          onClose={() => setDiscoverVisible(false)}
          onViewFullProfile={() => undefined}
        />

        <Text nativeID="onboarding-marker">Onboarding location</Text>
        <LocationOnboardingStep
          onLocationResolved={(place) => {
            setOnboardingResolved(place ? `${place.city}, ${place.state ?? ""}` : "skipped");
          }}
          onDevicePermissionDeniedChange={() => undefined}
        />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, gap: 12, backgroundColor: "#0A0A0B" },
});
