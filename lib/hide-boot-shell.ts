import { Platform } from "react-native";
import { hideNativeSplashScreen } from "@/lib/native-splash-screen";

const FADE_MS = 450;

/** Remove the inline HTML "Account loading stalled" overlay after a false-positive recovery. */
export function dismissInlineStartupFailureOverlay(): void {
  if (typeof document === "undefined") return;
  document.getElementById("frennix-startup-failure-overlay")?.remove();
}

/** Hide the static HTML boot overlay once React has painted an interactive screen. */
export function hideFrennixBootShell(): void {
  if (Platform.OS !== "web") {
    void hideNativeSplashScreen();
    return;
  }

  if (typeof document === "undefined") return;
  const shell = document.getElementById("frennix-boot-shell");
  if (!shell || shell.getAttribute("data-hiding") === "true") return;

  shell.setAttribute("data-hiding", "true");
  shell.classList.add("frennix-boot-shell--hiding");
  shell.setAttribute("aria-busy", "false");

  const finalize = () => {
    shell.style.display = "none";
    shell.setAttribute("aria-hidden", "true");
  };

  shell.addEventListener("transitionend", finalize, { once: true });
  window.setTimeout(finalize, FADE_MS);
  dismissInlineStartupFailureOverlay();
}
