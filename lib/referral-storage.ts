import AsyncStorage from "@react-native-async-storage/async-storage";

const REFERRAL_CODE_KEY = "@frennix/pending_referral_code";

export async function storePendingReferralCode(code: string) {
  const normalized = code.trim().toLowerCase();
  if (!normalized) return;
  await AsyncStorage.setItem(REFERRAL_CODE_KEY, normalized);
}

export async function getPendingReferralCode(): Promise<string | null> {
  const value = await AsyncStorage.getItem(REFERRAL_CODE_KEY);
  return value?.trim() || null;
}

export async function clearPendingReferralCode() {
  await AsyncStorage.removeItem(REFERRAL_CODE_KEY);
}

export async function claimPendingReferral(claimFn: (code: string) => Promise<boolean>) {
  const code = await getPendingReferralCode();
  if (!code) return false;

  const claimed = await claimFn(code);
  if (claimed) {
    await clearPendingReferralCode();
  }
  return claimed;
}
