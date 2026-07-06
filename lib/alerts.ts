import { Alert, Platform } from "react-native";
import { getUserFriendlyErrorMessage } from "@frennix/api";

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

/** Dismiss multiple notifications from the user's view (soft delete). */
export function confirmBulkDismissNotifications(count: number, onConfirm: () => void) {
  const title = `Delete ${count} notification${count === 1 ? "" : "s"}?`;
  const message = "They will be removed from your view. This cannot be undone.";

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
  const title = "Delete Conversation?";
  const message =
    "This will remove the conversation from your inbox. This will not delete it for the other person.";

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

/** Remove multiple conversations from the current user's inbox only. */
export function confirmDeleteSelectedConversations(onConfirm: () => void) {
  const title = "Delete selected conversations?";
  const message =
    "This will remove these conversations from your inbox only. Other users will still keep their copies.";

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

/** Archive multiple conversations from the current user's inbox. */
export function confirmArchiveSelectedConversations(onConfirm: () => void) {
  const title = "Archive selected conversations?";
  const message =
    "These conversations will be removed from your inbox. They will reappear if someone sends a new message.";

  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: "Archive", onPress: onConfirm },
  ]);
}

/** Remove a single message from the current user's view only. */
export function confirmDeleteMessageForMe(onConfirm: () => void) {
  const title = "Delete message?";
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
    { text: "Delete for me", style: "destructive", onPress: onConfirm },
  ]);
}

/** Retract a sent message for all conversation members. */
export function confirmDeleteMessageForEveryone(onConfirm: () => void) {
  const title = "Delete for everyone?";
  const message =
    "This message will be removed for both participants. This cannot be undone.";

  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete for everyone", style: "destructive", onPress: onConfirm },
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

/** Log technical detail and show user-friendly copy only. */
export function showFriendlyError(
  title: string,
  error: unknown,
  fallback = "Something went wrong. Please try again."
) {
  console.error(`[friendly-error] ${title}`, error);
  showAlert(title, getUserFriendlyErrorMessage(error, fallback));
}
