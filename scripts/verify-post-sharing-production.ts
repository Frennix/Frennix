#!/usr/bin/env npx tsx
/**
 * Production verification for v1.0.2 workout sharing fix.
 * Requires: linked Supabase project + .env (EXPO_PUBLIC_SUPABASE_*).
 * Optional: TEST_USER_JWT for REST-path smoke (mirrors client createPost).
 *
 * Run: npx tsx scripts/verify-post-sharing-production.ts
 */
import { execSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(import.meta.dirname, "..");
const TMP_SQL = join(ROOT, ".tmp-verify-post-sharing.sql");

function loadEnv() {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1).replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function queryLinked(sql: string): string {
  writeFileSync(TMP_SQL, sql.trim() + "\n", "utf8");
  try {
    return execSync("npx supabase db query --linked --yes -f .tmp-verify-post-sharing.sql", {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024,
    });
  } finally {
    try {
      unlinkSync(TMP_SQL);
    } catch {
      // ignore
    }
  }
}

function parseQueryRows(output: string): Record<string, unknown>[] {
  const start = output.indexOf('"rows":');
  if (start === -1) return [];
  const slice = output.slice(start);
  const arrayStart = slice.indexOf("[");
  const arrayEnd = slice.indexOf("]", arrayStart);
  if (arrayStart === -1 || arrayEnd === -1) return [];
  return JSON.parse(slice.slice(arrayStart, arrayEnd + 1)) as Record<string, unknown>[];
}

function migrationApplied(): void {
  const out = execSync("npx supabase migration list", {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (/20250722000001.*"remote":""/.test(out.replace(/\s/g, ""))) {
    throw new Error("20250722000001 not applied to production — run npx supabase db push");
  }
}

function assertNoEventTypeError(message: string): void {
  const lower = message.toLowerCase();
  if (lower.includes("event_type") || lower.includes("42703")) {
    throw new Error(message);
  }
}

type Check = { name: string; run: () => Promise<void> | void };

async function main() {
  loadEnv();
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const jwt = process.env.TEST_USER_JWT ?? "";

  const checks: Check[] = [
    {
      name: "migration:20250722000001 applied to remote",
      run: migrationApplied,
    },
    {
      name: "schema:legacy workout_post trigger removed",
      run: () => {
        const out = queryLinked(`
          SELECT tgname
          FROM pg_trigger t
          JOIN pg_class c ON t.tgrelid = c.oid
          JOIN pg_namespace n ON c.relnamespace = n.oid
          WHERE n.nspname = 'public' AND c.relname = 'posts' AND NOT t.tgisinternal;
        `);
        const names = parseQueryRows(out).map((row) => String(row.tgname));
        if (names.includes("workout_post_activity_record")) {
          throw new Error("workout_post_activity_record still exists on posts");
        }
        if (!names.includes("feed_post_activity_record")) {
          throw new Error(`feed_post_activity_record missing on posts (found: ${names.join(", ")})`);
        }
      },
    },
    {
      name: "schema:legacy record_activity_workout_post function removed",
      run: () => {
        const out = queryLinked(`
          SELECT COUNT(*)::int AS n
          FROM pg_proc p
          JOIN pg_namespace n ON p.pronamespace = n.oid
          WHERE n.nspname = 'public' AND p.proname = 'record_activity_workout_post';
        `);
        const rows = parseQueryRows(out);
        const n = Number(rows[0]?.n ?? 0);
        if (n > 0) throw new Error("record_activity_workout_post still exists");
      },
    },
    {
      name: "db:workout post insert succeeds (cleaned up)",
      run: () => {
        const out = queryLinked(`
          DO $$
          DECLARE
            v_author UUID;
            v_post_id UUID;
          BEGIN
            SELECT id INTO v_author FROM public.profiles ORDER BY created_at LIMIT 1;
            IF v_author IS NULL THEN
              RAISE EXCEPTION 'no profiles available for smoke insert';
            END IF;

            INSERT INTO public.posts (author_id, post_type, content, workout_types)
            VALUES (v_author, 'workout_update', '[v1.0.2 verify] workout smoke', ARRAY['strength'])
            RETURNING id INTO v_post_id;

            IF NOT EXISTS (
              SELECT 1 FROM public.platform_activity_events
              WHERE source_type = 'posts' AND source_id = v_post_id
                AND activity_type IN ('feed_post_created', 'workout_completed')
            ) THEN
              RAISE EXCEPTION 'activity events not recorded for workout post';
            END IF;

            DELETE FROM public.platform_activity_events
              WHERE source_type = 'posts' AND source_id = v_post_id;
            DELETE FROM public.posts WHERE id = v_post_id;
          END $$;
        `);
        assertNoEventTypeError(out);
        if (/"error"|"FATAL"/i.test(out)) throw new Error(out.trim());
      },
    },
    {
      name: "db:photo post insert succeeds (cleaned up)",
      run: () => {
        const out = queryLinked(`
          DO $$
          DECLARE
            v_author UUID;
            v_post_id UUID;
          BEGIN
            SELECT id INTO v_author FROM public.profiles ORDER BY created_at LIMIT 1;
            INSERT INTO public.posts (author_id, post_type, content, media_urls)
            VALUES (v_author, 'photo', '[v1.0.2 verify] photo smoke', ARRAY['https://example.com/verify-photo.jpg'])
            RETURNING id INTO v_post_id;

            IF NOT EXISTS (
              SELECT 1 FROM public.platform_activity_events
              WHERE source_id = v_post_id AND activity_type = 'workout_completed'
            ) THEN
              RAISE EXCEPTION 'workout_completed not recorded for photo post';
            END IF;

            DELETE FROM public.platform_activity_events
              WHERE source_type = 'posts' AND source_id = v_post_id;
            DELETE FROM public.posts WHERE id = v_post_id;
          END $$;
        `);
        assertNoEventTypeError(out);
        if (/\"error\"|\"FATAL\"/i.test(out)) throw new Error(out.trim());
      },
    },
    {
      name: "db:video post insert succeeds (cleaned up)",
      run: () => {
        const out = queryLinked(`
          DO $$
          DECLARE
            v_author UUID;
            v_post_id UUID;
          BEGIN
            SELECT id INTO v_author FROM public.profiles ORDER BY created_at LIMIT 1;
            INSERT INTO public.posts (author_id, post_type, content, media_urls, thumbnail_url)
            VALUES (
              v_author, 'video', '[v1.0.2 verify] video smoke',
              ARRAY['https://example.com/verify-video.mp4'],
              'https://example.com/verify-thumb.jpg'
            )
            RETURNING id INTO v_post_id;

            IF NOT EXISTS (
              SELECT 1 FROM public.platform_activity_events
              WHERE source_id = v_post_id AND activity_type = 'workout_completed'
            ) THEN
              RAISE EXCEPTION 'workout_completed not recorded for video post';
            END IF;

            DELETE FROM public.platform_activity_events
              WHERE source_type = 'posts' AND source_id = v_post_id;
            DELETE FROM public.posts WHERE id = v_post_id;
          END $$;
        `);
        assertNoEventTypeError(out);
        if (/\"error\"|\"FATAL\"/i.test(out)) throw new Error(out.trim());
      },
    },
    {
      name: "api:existing posts feed loads",
      run: async () => {
        if (!url || !anon) throw new Error("Missing EXPO_PUBLIC_SUPABASE_* in .env");
        const supabase = createClient(url, anon);
        const { data, error } = await supabase
          .from("posts")
          .select("id, post_type, created_at, author_id")
          .order("created_at", { ascending: false })
          .limit(10);
        if (error) {
          assertNoEventTypeError(error.message);
          throw new Error(`feed query failed: ${error.message}`);
        }
        if (!Array.isArray(data)) throw new Error("feed query returned non-array");
      },
    },
    {
      name: "api:production site responds",
      run: async () => {
        const res = await fetch("https://frennix.vercel.app", { method: "HEAD" });
        if (!res.ok) throw new Error(`frennix.vercel.app returned ${res.status}`);
      },
    },
    {
      name: "logs:no post functions reference event_type",
      run: () => {
        const out = queryLinked(`
          SELECT COUNT(*)::int AS n
          FROM pg_proc p
          JOIN pg_namespace n ON p.pronamespace = n.oid
          WHERE n.nspname = 'public'
            AND pg_get_functiondef(p.oid) ILIKE '%event_type%'
            AND p.proname LIKE '%post%';
        `);
        const rows = parseQueryRows(out);
        const n = Number(rows[0]?.n ?? 0);
        if (n > 0) throw new Error("post-related functions still reference event_type");
      },
    },
  ];

  if (jwt && url && anon) {
    checks.push({
      name: "rest:client createPost path (workout)",
      run: async () => {
        const res = await fetch(`${url}/rest/v1/posts?select=id,post_type`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anon,
            Authorization: `Bearer ${jwt}`,
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            post_type: "workout_update",
            content: "[v1.0.2 verify] REST workout",
            workout_types: ["cardio"],
          }),
        });
        const body = await res.text();
        assertNoEventTypeError(body);
        if (!res.ok) throw new Error(`REST workout post ${res.status}: ${body}`);
        const rows = JSON.parse(body) as { id: string }[];
        const id = rows[0]?.id;
        if (!id) throw new Error("REST workout post returned no id");
        await fetch(`${url}/rest/v1/posts?id=eq.${id}`, {
          method: "DELETE",
          headers: { apikey: anon, Authorization: `Bearer ${jwt}` },
        });
      },
    });
  }

  let failed = 0;
  for (const check of checks) {
    try {
      await check.run();
      console.log(`PASS  ${check.name}`);
    } catch (e) {
      failed += 1;
      console.error(`FAIL  ${check.name}`);
      console.error(`      ${e instanceof Error ? e.message : String(e)}`);
      break;
    }
  }

  if (failed) {
    console.error(`\nVerification stopped after ${failed} failure. No release docs updated.`);
    process.exit(1);
  }

  console.log(`\n${checks.length}/${checks.length} PASS — workout sharing verified in production`);
}

void main();
