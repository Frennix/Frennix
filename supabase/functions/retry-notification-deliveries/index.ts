// Retry failed notification deliveries (web_push + expo).
// Invoke via Supabase cron or manual POST with service role.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dispatchNotificationRecord } from "../send-push/dispatch.ts";

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!authHeader.includes(serviceKey)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceKey
    );

    const { data: pending, error } = await supabase
      .from("notification_deliveries")
      .select("notification_id")
      .eq("status", "failed")
      .lte("next_retry_at", new Date().toISOString())
      .lt("retry_count", 5)
      .order("next_retry_at", { ascending: true })
      .limit(50);

    if (error) throw error;

    const uniqueIds = [...new Set((pending ?? []).map((row) => row.notification_id as string))];
    let retried = 0;

    for (const notificationId of uniqueIds) {
      const { data: notification } = await supabase
        .from("notifications")
        .select("*")
        .eq("id", notificationId)
        .maybeSingle();

      if (notification) {
        await dispatchNotificationRecord(supabase, notification);
        retried += 1;
      }
    }

    return new Response(JSON.stringify({ ok: true, retried, queued: uniqueIds.length }), {
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
