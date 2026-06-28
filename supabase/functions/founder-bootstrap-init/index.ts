// One-time platform bootstrap token setup.
// Deploy: supabase functions deploy founder-bootstrap-init
// Set secret: supabase secrets set FOUNDER_BOOTSTRAP_SECRET=your-long-random-secret
// Invoke once: curl -X POST https://<project>.supabase.co/functions/v1/founder-bootstrap-init \
//   -H "Authorization: Bearer <service-role-key>"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST required" }), { status: 405 });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!authHeader.includes(serviceKey)) {
    return new Response(JSON.stringify({ error: "Service role required" }), { status: 401 });
  }

  const secret = Deno.env.get("FOUNDER_BOOTSTRAP_SECRET");
  if (!secret || secret.length < 16) {
    return new Response(
      JSON.stringify({ error: "FOUNDER_BOOTSTRAP_SECRET must be set (min 16 chars)" }),
      { status: 500 }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey
  );

  const tokenHash = await sha256Hex(secret);
  const { error } = await supabase.rpc("set_platform_bootstrap_token", {
    p_token_hash: tokenHash,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      message: "Bootstrap token configured. Share FOUNDER_BOOTSTRAP_SECRET with the platform owner for one-time claim at /founder/bootstrap.",
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
