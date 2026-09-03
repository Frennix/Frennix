#!/usr/bin/env node
/**
 * Compare working vs failing feed videos — HTTP headers, reachability, URL shape.
 * Usage: node scripts/diagnose-video-delivery.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function loadEnv() {
  const env = {};
  for (const f of [".env", ".env.local"]) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

function redactUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return "[invalid-url]";
  }
}

async function probeUrl(label, url) {
  if (!url) {
    return { label, url: null, error: "empty-url" };
  }
  const result = { label, urlPath: redactUrl(url), method: "HEAD" };
  try {
    let res = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (res.status === 405 || res.status === 501) {
      result.method = "GET-range";
      res = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-1" },
        redirect: "follow",
      });
    }
    result.status = res.status;
    result.contentType = res.headers.get("content-type");
    result.contentLength = res.headers.get("content-length");
    result.acceptRanges = res.headers.get("accept-ranges");
    result.cacheControl = res.headers.get("cache-control");
    result.accessControlAllowOrigin = res.headers.get("access-control-allow-origin");
    result.etag = res.headers.get("etag") ? "present" : null;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }
  return result;
}

async function main() {
  const env = loadEnv();
  const sb = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

  const { data: bianca } = await sb
    .from("profiles")
    .select("id, username, display_name")
    .eq("username", "bfitjourney")
    .maybeSingle();

  if (!bianca) {
    console.error("Bianca profile (bfitjourney) not found");
    process.exit(1);
  }

  const { data: posts } = await sb
    .from("posts")
    .select("id, post_type, content, media_urls, thumbnail_url, created_at")
    .eq("author_id", bianca.id)
    .order("created_at", { ascending: false })
    .limit(30);

  const failing = (posts ?? []).find((p) =>
    /hyrox training day 2/i.test(p.content ?? "")
  );

  const { data: feedPosts } = await sb
    .from("posts")
    .select("id, post_type, content, media_urls, thumbnail_url, created_at, author:profiles!posts_author_id_fkey(username)")
    .eq("post_type", "video")
    .not("media_urls", "eq", "{}")
    .order("created_at", { ascending: false })
    .limit(40);

  const workingCandidates = (feedPosts ?? []).filter(
    (p) => p.id !== failing?.id && p.media_urls?.[0]
  );

  console.log("=== FAILING POST (Bianca Hyrox) ===");
  if (!failing) {
    console.log("Post not found by caption match");
  } else {
    console.log(
      JSON.stringify(
        {
          id: failing.id,
          post_type: failing.post_type,
          caption: failing.content?.slice(0, 80),
          media_url_path: redactUrl(failing.media_urls?.[0]),
          thumbnail_path: redactUrl(failing.thumbnail_url),
          media_ext: failing.media_urls?.[0]?.split(".").pop()?.split("?")[0],
        },
        null,
        2
      )
    );
  }

  console.log("\n=== WORKING COMPARISON POSTS ===");
  for (const post of workingCandidates.slice(0, 3)) {
    console.log(
      JSON.stringify(
        {
          id: post.id,
          author: post.author?.username,
          post_type: post.post_type,
          caption: post.content?.slice(0, 60),
          media_url_path: redactUrl(post.media_urls?.[0]),
          thumbnail_path: redactUrl(post.thumbnail_url),
          media_ext: post.media_urls?.[0]?.split(".").pop()?.split("?")[0],
        },
        null,
        2
      )
    );
  }

  const probes = [];
  if (failing?.media_urls?.[0]) {
    probes.push(probeUrl("failing-video", failing.media_urls[0]));
  }
  if (failing?.thumbnail_url) {
    probes.push(probeUrl("failing-thumbnail", failing.thumbnail_url));
  }
  for (const [i, post] of workingCandidates.slice(0, 2).entries()) {
    if (post.media_urls?.[0]) {
      probes.push(probeUrl(`working-video-${i}`, post.media_urls[0]));
    }
    if (post.thumbnail_url) {
      probes.push(probeUrl(`working-thumbnail-${i}`, post.thumbnail_url));
    }
  }

  const probeResults = await Promise.all(probes);
  console.log("\n=== HTTP PROBES (redacted) ===");
  console.log(JSON.stringify(probeResults, null, 2));

  // Check storage object exists for failing video
  if (failing?.media_urls?.[0]) {
    const match = failing.media_urls[0].match(/\/posts\/(.+)$/);
    if (match) {
      const storagePath = decodeURIComponent(match[1]);
      const { data, error } = await sb.storage.from("posts").list(storagePath.split("/")[0], {
        search: storagePath.split("/").pop(),
      });
      console.log("\n=== STORAGE LIST (failing object) ===");
      console.log(JSON.stringify({ storagePath, listError: error?.message ?? null, found: data?.length ?? 0 }, null, 2));
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
