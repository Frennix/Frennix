import { Alert, Platform } from "react-native";

export function showAlert(title: string, message: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

export function confirmCloseChallengeEarly(onConfirm: () => void) {
  const title = "Close challenge early?";
  const message =
    "The challenge will end immediately. New athletes will not be able to join.";

  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: "Close challenge", style: "destructive", onPress: onConfirm },
  ]);
}

export function confirmDeleteChallenge(onConfirm: () => void) {
  const title = "Delete Challenge?";
  const message = "This action cannot be undone.";

  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: onConfirm },
  ]);
}

export function confirmDeletePost(onConfirm: () => void) {
  const title = "Delete Workout?";
  const message = "This action cannot be undone.";

  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: onConfirm },
  ]);
}

export function confirmCancelEvent(onConfirm: () => void) {
  const title = "Cancel this event?";
  const message = "Attendees will no longer see it as active.";

  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: "Keep event", style: "cancel" },
    { text: "Cancel event", style: "destructive", onPress: onConfirm },
  ]);
}

export function confirmDeleteComment(onConfirm: () => void) {
  const title = "Delete this comment?";
  const message = "This action cannot be undone.";

  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: onConfirm },
  ]);
}

export function showSuccess(message: string) {
  showAlert("Success", message);
}

export function confirmBlockUser(onConfirm: () => void) {
  const title = "Block this user?";
  const message =
    "You will no longer see their posts, comments, or messages. Any active training match will be removed.";

  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: "Block", style: "destructive", onPress: onConfirm },
  ]);
}

export function confirmRemoveTrainingMatch(partnerName: string, onConfirm: () => void) {
  const title = "Remove training match?";
  const message = `You and ${partnerName} will no longer appear in each other's training matches. Your chat history stays available in Messages.`;

  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: "Remove", style: "destructive", onPress: onConfirm },
  ]);
}
