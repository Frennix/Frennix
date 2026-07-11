/** Hide the static HTML boot overlay once React has painted an interactive screen. */
export function hideFrennixBootShell(): void {
  if (typeof document === "undefined") return;
  const shell = document.getElementById("frennix-boot-shell");
  if (shell) {
    shell.style.display = "none";
    shell.setAttribute("aria-busy", "false");
  }
}

/** Remove the inline HTML "Account loading stalled" overlay after a false-positive recovery. */
export function dismissInlineStartupFailureOverlay(): void {
  if (typeof document === "undefined") return;
  document.getElementById("frennix-startup-failure-overlay")?.remove();
  const stalled = document.getElementById("frennix-boot-shell-stalled");
  if (stalled) stalled.style.display = "none";
}
