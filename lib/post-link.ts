import { config } from "@/lib/config";
import { copyEntityLink, shareEntityLink } from "@/lib/entity-link";

export function buildPostLink(postId: string) {
  const base = config.appUrl.replace(/\/$/, "");
  return `${base}/post/${postId}`;
}

export async function copyPostLink(postId: string) {
  await copyEntityLink(buildPostLink(postId));
}

export async function sharePostLink(postId: string, caption?: string | null) {
  const link = buildPostLink(postId);
  const message = caption?.trim()
    ? `${caption.trim()}\n\n${link}`
    : `Check out this workout on Frennix\n\n${link}`;
  await shareEntityLink({
    link,
    headline: "Frennix workout",
    message,
  });
}
