import { Linking, Platform, Share } from "react-native";
import { buildInviteMessage, buildReferralLink } from "@frennix/api";
import { config } from "@/lib/config";
import { showAlert, showSuccess } from "@/lib/alerts";

export function getInviteLink(referralCode: string) {
  return buildReferralLink(config.appUrl, referralCode);
}

export function getInviteMessage(displayName: string, referralCode: string) {
  return buildInviteMessage(displayName, getInviteLink(referralCode));
}

export async function shareInviteLink(displayName: string, referralCode: string) {
  const message = getInviteMessage(displayName, referralCode);

  if (Platform.OS === "web") {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Join Frennix", text: message, url: getInviteLink(referralCode) });
        return;
      } catch {
        // fall through to copy
      }
    }
    await copyInviteLink(referralCode);
    return;
  }

  await Share.share({
    message,
    url: Platform.OS === "ios" ? getInviteLink(referralCode) : undefined,
    title: "Join Frennix",
  });
}

export async function inviteViaSms(displayName: string, referralCode: string) {
  const message = getInviteMessage(displayName, referralCode);
  const encoded = encodeURIComponent(message);
  const url =
    Platform.OS === "ios"
      ? `sms:&body=${encoded}`
      : Platform.OS === "android"
        ? `sms:?body=${encoded}`
        : `sms:?body=${encoded}`;

  if (Platform.OS === "web") {
    await copyInviteLink(referralCode);
    showAlert("Text invite", "Link copied — paste it into a text message to send.");
    return;
  }

  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    showAlert("Could not open Messages", "Copy the link and send it manually.");
    return;
  }
  await Linking.openURL(url);
}

export async function shareToSocial(displayName: string, referralCode: string) {
  await shareInviteLink(displayName, referralCode);
}

export async function copyInviteLink(referralCode: string) {
  const link = getInviteLink(referralCode);

  if (Platform.OS === "web") {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(link);
      showSuccess("Invite link copied");
      return;
    }
    showAlert("Copy link", link);
    return;
  }

  // Native: use Share as fallback for copy on platforms without Clipboard package
  await Share.share({ message: link });
}
