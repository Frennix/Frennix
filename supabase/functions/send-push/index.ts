// Edge Function entry — unified notification dispatch for all types.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dispatchNotificationRecord } from "./dispatch.ts";

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const record = body.record ?? body;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const result = await dispatchNotificationRecord(supabase, record);
    return new Response(JSON.stringify(result), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
