/** Hide the static HTML boot overlay once React has painted an interactive screen. */
export function hideFrennixBootShell(): void {
  if (typeof document === "undefined") return;
  const shell = document.getElementById("frennix-boot-shell");
  if (shell) {
    shell.style.display = "none";
    shell.setAttribute("aria-busy", "false");
  }
}
