import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

function canUseHaptics() {
  return Platform.OS === "ios" || Platform.OS === "android";
}

/** Light tap — likes, follows, refresh start. */
export function hapticLight(): void {
  if (!canUseHaptics()) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Stronger pulse — mutual match, major confirmations. */
export function hapticSuccess(): void {
  if (!canUseHaptics()) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export function hapticLike(): void {
  hapticLight();
}

export function hapticFollow(): void {
  hapticLight();
}

export function hapticMatch(): void {
  hapticSuccess();
}

export function hapticRefresh(): void {
  hapticLight();
}
