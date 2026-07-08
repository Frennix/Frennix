import { Platform } from "react-native";
import { isIosWebDevice, isWebStandalone } from "@/lib/pwa";

export type WebPushSetupStatus =
  | "enabled"
  | "disabled"
  | "waiting_permission"
  | "home_screen_required";

export type WebPushSetupStatusInput = {
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  standalone?: boolean;
  isIosWeb?: boolean;
};

export const WEB_PUSH_STATUS_LABELS: Record<WebPushSetupStatus, string> = {
  enabled: "Notifications Enabled ✅",
  disabled: "Notifications Disabled",
  waiting_permission: "Waiting for Permission",
  home_screen_required: "Open from Home Screen Required",
};

export function resolveWebPushSetupStatus(input: WebPushSetupStatusInput): WebPushSetupStatus {
  const standalone = input.standalone ?? isWebStandalone();
  const isIosWeb = input.isIosWeb ?? isIosWebDevice();

  if (Platform.OS === "web" && isIosWeb && !standalone) {
    return "home_screen_required";
  }

  if (input.permission === "denied") {
    return "disabled";
  }

  if (input.permission === "granted" && input.subscribed) {
    return "enabled";
  }

  return "waiting_permission";
}

export function isWebPushSetupComplete(input: WebPushSetupStatusInput): boolean {
  return resolveWebPushSetupStatus(input) === "enabled";
}
