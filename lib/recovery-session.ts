import { getSupabase } from "@frennix/api";

function parseHashParams(url: string): Record<string, string> {
  const hashIndex = url.indexOf("#");
  if (hashIndex === -1) return {};
  return Object.fromEntries(new URLSearchParams(url.slice(hashIndex + 1)));
}

/** Establish a Supabase session from a recovery deep link (native). */
export async function establishSessionFromUrl(url: string): Promise<boolean> {
  const hashParams = parseHashParams(url);
  const accessToken = hashParams.access_token;
  const refreshToken = hashParams.refresh_token;

  if (!accessToken || !refreshToken) return false;

  const { error } = await getSupabase().auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;

  return hashParams.type === "recovery";
}

export function urlLooksLikePasswordRecovery(url: string) {
  return url.includes("reset-password") || url.includes("type=recovery");
}
