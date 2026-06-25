import { Platform, Share } from "react-native";
import { config } from "@/lib/config";
import { showAlert, showSuccess } from "@/lib/alerts";

export function buildPostLink(postId: string) {
  const base = config.appUrl.replace(/\/$/, "");
  return `${base}/post/${postId}`;
}

export async function copyPostLink(postId: string) {
  const link = buildPostLink(postId);

  if (Platform.OS === "web") {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(link);
      showSuccess("Link copied to clipboard");
      return;
    }
    showAlert("Copy link", link);
    return;
  }

  await Share.share({ message: link });
}

export async function sharePostLink(postId: string, caption?: string | null) {
  const link = buildPostLink(postId);
  const message = caption?.trim()
    ? `${caption.trim()}\n\n${link}`
    : `Check out this workout on Frennix\n\n${link}`;

  if (Platform.OS === "web") {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Frennix workout", text: message, url: link });
        return;
      } catch {
        // fall through to copy
      }
    }
    await copyPostLink(postId);
    return;
  }

  await Share.share({
    message,
    url: Platform.OS === "ios" ? link : undefined,
    title: "Frennix workout",
  });
}
