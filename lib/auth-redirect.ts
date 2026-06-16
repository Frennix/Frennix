import { Platform } from "react-native";
import { config } from "./config";

export function getPasswordResetRedirectUrl() {
  const base = config.appUrl.replace(/\/$/, "");
  if (Platform.OS === "web") {
    return `${base}/reset-password`;
  }
  return "frennix://reset-password";
}

export function isWebRecoveryHash() {
  if (typeof window === "undefined") return false;
  return window.location.hash.includes("type=recovery");
}

/** Remove recovery tokens from the URL after session is established (web only). */
export function clearWebRecoveryHash() {
  if (typeof window === "undefined") return;
  if (!window.location.hash) return;
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}
