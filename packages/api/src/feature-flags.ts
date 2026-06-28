import { getSupabase } from "./supabase";

export async function evaluateFeatureFlag(key: string): Promise<boolean> {
  const { data, error } = await getSupabase().rpc("evaluate_feature_flag", { p_key: key });
  if (error) {
    console.warn("[feature-flags] evaluate_feature_flag failed", key, error.message);
    return true;
  }
  return data === true;
}
