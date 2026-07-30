import * as SplashScreen from "expo-splash-screen";
import { Platform } from "react-native";

let configured = false;
let hidePromise: Promise<void> | null = null;

/** Keep the native launch splash visible until the first screen is ready. */
export function configureNativeSplashScreen(): void {
  if (Platform.OS === "web" || configured) return;
  configured = true;

  SplashScreen.setOptions({
    fade: true,
    duration: 320,
  });

  void SplashScreen.preventAutoHideAsync().catch(() => {});
}

export async function hideNativeSplashScreen(): Promise<void> {
  if (Platform.OS === "web") return;
  if (hidePromise) return hidePromise;

  hidePromise = SplashScreen.hideAsync().catch(() => {});
  return hidePromise;
}
