import { LayoutAnimation, Platform, UIManager } from "react-native";

let androidEnabled = false;

function ensureAndroidLayoutAnimation() {
  if (androidEnabled || Platform.OS !== "android") return;
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
    androidEnabled = true;
  }
}

/** Smooth cross-fade when calendar month/week changes. */
export function animateCalendarPeriodChange() {
  ensureAndroidLayoutAnimation();
  LayoutAnimation.configureNext({
    duration: 220,
    create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  });
}
