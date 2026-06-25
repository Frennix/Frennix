import { formatSupabaseError } from "./profile-utils";
import { getSupabase } from "./supabase";

export type PushPlatform = "ios" | "android" | "web";

export async function savePushToken(userId: string, expoToken: string, platform: PushPlatform) {
  const { error: tokenError } = await getSupabase().from("push_tokens").upsert(
    {
      user_id: userId,
      expo_token: expoToken,
      platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,expo_token" }
  );

  if (tokenError) throw formatSupabaseError(tokenError, "Failed to save push token");

  const { error: profileError } = await getSupabase()
    .from("profiles")
    .update({ push_token: expoToken })
    .eq("id", userId);

  if (profileError) throw formatSupabaseError(profileError, "Failed to update profile push token");
}

export async function removePushTokens(userId: string) {
  const { error: tokenError } = await getSupabase().from("push_tokens").delete().eq("user_id", userId);
  if (tokenError) throw formatSupabaseError(tokenError, "Failed to remove push tokens");

  const { error: profileError } = await getSupabase()
    .from("profiles")
    .update({ push_token: null })
    .eq("id", userId);

  if (profileError) throw formatSupabaseError(profileError, "Failed to clear profile push token");
}
