import { Alert, Platform } from "react-native";

export function showAlert(title: string, message: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

export function confirmDeletePost(onConfirm: () => void) {
  const title = "Delete this post?";
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
  const message = "You will no longer see their posts, comments, or messages.";

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
