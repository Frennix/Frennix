import AsyncStorage from "@react-native-async-storage/async-storage";

const FEED_BANNER_DISMISSED_KEY = "frennix:location-feed-banner-dismissed";

export async function isLocationFeedBannerDismissed(): Promise<boolean> {
  return (await AsyncStorage.getItem(FEED_BANNER_DISMISSED_KEY)) === "1";
}

export async function dismissLocationFeedBanner(): Promise<void> {
  await AsyncStorage.setItem(FEED_BANNER_DISMISSED_KEY, "1");
}

export async function resetLocationFeedBannerDismissed(): Promise<void> {
  await AsyncStorage.removeItem(FEED_BANNER_DISMISSED_KEY);
}
