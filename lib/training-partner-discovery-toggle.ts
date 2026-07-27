import { Alert, Platform } from "react-native";
import { setMatchingEnabledWithOptOut } from "@frennix/api";
import type { Profile } from "@frennix/types";

/** Canonical read — both Privacy & Discovery and Training partner preferences use matching_enabled. */
export function isTrainingPartnerDiscoveryEnabled(profile: Profile | null | undefined): boolean {
  return profile?.matching_enabled ?? true;
}

export async function setTrainingPartnerDiscoveryEnabled(
  userId: string,
  enabled: boolean
): Promise<Profile> {
  return setMatchingEnabledWithOptOut(userId, enabled);
}

export function confirmDisableTrainingPartnerDiscovery(onConfirm: () => void): void {
  const title = "Hide from training partner discovery?";
  const message =
    "You will not appear in the discovery deck and will not see new training partners. Existing training matches stay.";

  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: "Turn off", style: "destructive", onPress: onConfirm },
  ]);
}
