import { Platform, Share } from "react-native";
import { showAlert, showSuccess } from "@/lib/alerts";

export async function copyEntityLink(link: string, successMessage = "Link copied to clipboard") {
  if (Platform.OS === "web") {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(link);
      showSuccess(successMessage);
      return;
    }
    showAlert("Copy link", link);
    return;
  }

  await Share.share({ message: link });
}

export async function shareEntityLink(options: {
  link: string;
  headline: string;
  /** Full share message; defaults to `${headline}\n\n${link}` */
  message?: string;
}) {
  const { link, headline } = options;
  const message = options.message ?? `${headline}\n\n${link}`;

  if (Platform.OS === "web") {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: headline, text: message, url: link });
        return;
      } catch {
        // fall through to copy
      }
    }
    await copyEntityLink(link);
    return;
  }

  await Share.share({
    message,
    url: Platform.OS === "ios" ? link : undefined,
    title: headline,
  });
}
