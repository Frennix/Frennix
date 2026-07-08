import { formatSupabaseError } from "./profile-utils";
import { getSupabase } from "./supabase";

export async function submitCrashReport(input: {
  user_id: string;
  message: string;
  screen_path?: string | null;
  app_version?: string | null;
  platform?: string | null;
  os_version?: string | null;
  browser?: string | null;
  build_number?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await getSupabase().from("beta_feedback").insert({
    user_id: input.user_id,
    type: "crash",
    status: "new",
    priority: "critical",
    message: input.message.slice(0, 4000),
    feature_area: "general",
    screen_path: input.screen_path ?? null,
    app_version: input.app_version ?? null,
    platform: input.platform ?? null,
    os_version: input.os_version ?? null,
    browser: input.browser ?? null,
    build_number: input.build_number ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) throw formatSupabaseError(error, "Failed to save crash report");
}
