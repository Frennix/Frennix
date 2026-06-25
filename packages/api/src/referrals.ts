import type { Profile, ReferralStats } from "@frennix/types";
import { formatSupabaseError } from "./profile-utils";
import { getSupabase } from "./supabase";

export async function claimReferral(referralCode: string): Promise<boolean> {
  const normalized = referralCode.trim().toLowerCase();
  if (!normalized) return false;

  const { data, error } = await getSupabase().rpc("claim_referral", {
    referral_code_input: normalized,
  });

  if (error) throw formatSupabaseError(error, "Failed to claim referral");
  return Boolean(data);
}

export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const { count, error } = await getSupabase()
    .from("referrals")
    .select("*", { count: "exact", head: true })
    .eq("referrer_id", userId);

  if (error) throw error;
  return { friendsJoined: count ?? 0 };
}

export async function getReferredFriends(userId: string): Promise<Profile[]> {
  const { data, error } = await getSupabase()
    .from("referrals")
    .select(`referred:profiles!referrals_referred_id_fkey(*)`)
    .eq("referrer_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const entry = row as { referred: Profile | Profile[] | null };
      return Array.isArray(entry.referred) ? entry.referred[0] : entry.referred;
    })
    .filter((profile): profile is Profile => Boolean(profile));
}

export function buildReferralLink(appUrl: string, referralCode: string) {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/join/${encodeURIComponent(referralCode)}`;
}

export function buildInviteMessage(displayName: string, link: string) {
  return `Join me on Frennix — train together, share workouts, and stay accountable. ${link}`;
}
