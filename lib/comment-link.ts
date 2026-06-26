import { config } from "@/lib/config";
import { copyEntityLink, shareEntityLink } from "@/lib/entity-link";

export function buildCommentLink(postId: string, commentId: string) {
  const base = config.appUrl.replace(/\/$/, "");
  return `${base}/post/${postId}?comment=${commentId}`;
}

export async function copyCommentLink(postId: string, commentId: string) {
  await copyEntityLink(buildCommentLink(postId, commentId));
}

export async function shareCommentLink(postId: string, commentId: string, preview?: string | null) {
  const link = buildCommentLink(postId, commentId);
  const headline = preview?.trim()
    ? `"${preview.trim().slice(0, 80)}" on Frennix`
    : "Comment on Frennix";
  await shareEntityLink({ link, headline });
}
