import { Linking, Platform, Share } from "react-native";
import { buildChallengeLink, copyChallengeLink, shareChallengeLink } from "@/lib/challenge-link";
import { showAlert, showSuccess } from "@/lib/alerts";

export type ShareChallengeDestination =
  | "copy_link"
  | "text_message"
  | "instagram_stories"
  | "facebook"
  | "native_share";

function challengeShareMessage(title: string | null | undefined, link: string) {
  const headline = title?.trim()
    ? `Join "${title.trim()}" on Frennix`
    : "Join this challenge on Frennix";
  return `${headline}\n\n${link}`;
}

export async function shareChallengeToDestination(
  challengeId: string,
  title: string | null | undefined,
  destination: ShareChallengeDestination
) {
  const link = buildChallengeLink(challengeId);
  const message = challengeShareMessage(title, link);

  switch (destination) {
    case "copy_link":
      await copyChallengeLink(challengeId);
      return;
    case "text_message":
      await shareChallengeViaText(message);
      return;
    case "instagram_stories":
      await shareChallengeToInstagram(link, message);
      return;
    case "facebook":
      await shareChallengeToFacebook(link);
      return;
    case "native_share":
      await shareChallengeLink(challengeId, title);
      return;
    default:
      await shareChallengeLink(challengeId, title);
  }
}

async function shareChallengeViaText(message: string) {
  const encoded = encodeURIComponent(message);
  const url =
    Platform.OS === "ios"
      ? `sms:&body=${encoded}`
      : Platform.OS === "android"
        ? `sms:?body=${encoded}`
        : `sms:?body=${encoded}`;

  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    showAlert("Text message", message);
    return;
  }

  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    showAlert("Could not open Messages", "Copy the challenge link and send it manually.");
    return;
  }
  await Linking.openURL(url);
}

async function shareChallengeToFacebook(link: string) {
  const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;

  if (Platform.OS === "web") {
    window.open(shareUrl, "_blank", "noopener,noreferrer");
    return;
  }

  const canOpen = await Linking.canOpenURL(shareUrl);
  if (!canOpen) {
    await Share.share({ message: link });
    return;
  }
  await Linking.openURL(shareUrl);
}

async function shareChallengeToInstagram(link: string, message: string) {
  if (Platform.OS === "web") {
    const instagramWeb = `https://www.instagram.com/`;
    window.open(instagramWeb, "_blank", "noopener,noreferrer");
    showSuccess("Challenge link copied — paste into Instagram Stories or bio.");
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(message);
    }
    return;
  }

  const instagramShare = `instagram://sharesheet?text=${encodeURIComponent(message)}`;
  const canOpenInstagram = await Linking.canOpenURL(instagramShare);
  if (canOpenInstagram) {
    await Linking.openURL(instagramShare);
    return;
  }

  await Share.share({ message, url: Platform.OS === "ios" ? link : undefined });
}

export const SHARE_CHALLENGE_OPTIONS: {
  id: ShareChallengeDestination;
  label: string;
  description: string;
}[] = [
  {
    id: "copy_link",
    label: "Copy Challenge Link",
    description: "Copy the link to your clipboard",
  },
  {
    id: "text_message",
    label: "Share via Text Message",
    description: "Open Messages with the challenge link",
  },
  {
    id: "instagram_stories",
    label: "Share to Instagram Stories",
    description: "Open Instagram or use the share sheet",
  },
  {
    id: "facebook",
    label: "Share to Facebook",
    description: "Open Facebook share dialog",
  },
  {
    id: "native_share",
    label: "More Options",
    description: "Use your device's native share sheet",
  },
];
