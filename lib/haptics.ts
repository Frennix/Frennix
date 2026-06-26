import { Platform } from "react-native";

type HapticsModule = typeof import("expo-haptics");

let hapticsModule: HapticsModule | null | undefined;

function canUseHaptics() {
  return Platform.OS === "ios" || Platform.OS === "android";
}

function getHaptics(): HapticsModule | null {
  if (!canUseHaptics()) return null;
  if (hapticsModule !== undefined) return hapticsModule;
  try {
    hapticsModule = require("expo-haptics") as HapticsModule;
  } catch {
    hapticsModule = null;
  }
  return hapticsModule;
}

/** Light tap — likes, follows, refresh start. */
export function hapticLight(): void {
  const Haptics = getHaptics();
  if (!Haptics?.impactAsync) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Stronger pulse — mutual match, major confirmations. */
export function hapticSuccess(): void {
  const Haptics = getHaptics();
  if (!Haptics?.notificationAsync) return;
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
