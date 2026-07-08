#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
const env = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    env[line.slice(0, idx)] = line.slice(idx + 1).trim();
  }
}

const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await sb
  .from("beta_feedback")
  .select("id,type,message,metadata,created_at,user_id,status")
  .or("type.eq.crash,type.eq.bug,type.eq.critical_bug")
  .order("created_at", { ascending: false })
  .limit(30);

if (error) {
  console.error(error);
  process.exit(1);
}

for (const row of data ?? []) {
  const meta = row.metadata ?? {};
  const screen = meta.screen ?? meta.route ?? "?";
  const source = meta.source ?? row.source ?? "?";
  console.log(`\n--- ${row.created_at} [${row.type}] user=${(row.user_id ?? "?").slice(0, 8)}`);
  console.log(`screen: ${screen} | source: ${source}`);
  console.log(`message: ${(row.message ?? "").slice(0, 200)}`);
  if (meta.startup_trace) console.log(`startup_gap: ${meta.startup_gap ?? "n/a"}`);
  if (meta.error_message) console.log(`error: ${String(meta.error_message).slice(0, 300)}`);
}

console.log(`\nTotal: ${data?.length ?? 0} reports`);
