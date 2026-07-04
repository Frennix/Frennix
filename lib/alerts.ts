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

/** Shared delete confirmation for all owner-managed content types. */
export function confirmDelete(entityLabel: string, onConfirm: () => void) {
  const title = `Delete ${entityLabel}?`;
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

/** Dismiss notifications from the user's view (soft delete). */
export function confirmDismiss(onConfirm: () => void) {
  const title = "Delete this?";
  const message = "This will be removed from your view.";

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

/** Hide a conversation from the inbox (other participant keeps all messages). */
export function confirmHideConversation(onConfirm: () => void) {
  const title = "Hide this conversation?";
  const message =
    "It will be removed from your inbox. The other person can still see the full conversation.";

  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: "Hide", style: "destructive", onPress: onConfirm },
  ]);
}

/** Permanently remove a conversation from the current user's inbox. */
export function confirmDeleteConversation(onConfirm: () => void) {
  const title = "Delete this conversation?";
  const message =
    "It will be removed from your inbox. Messages stay available for the other person.";

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

/** Remove a single message from the current user's view only. */
export function confirmDeleteMessageForMe(onConfirm: () => void) {
  const title = "Delete this message?";
  const message =
    "This removes the message from your view only. The other person can still see it.";

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

export function confirmDeleteChallenge(onConfirm: () => void) {
  confirmDelete("Challenge", onConfirm);
}

export function confirmDeletePost(onConfirm: () => void) {
  confirmDelete("Post", onConfirm);
}

export function confirmDeleteGroup(onConfirm: () => void) {
  confirmDelete("Group", onConfirm);
}

export function confirmDeleteComment(onConfirm: () => void) {
  confirmDelete("Comment", onConfirm);
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
