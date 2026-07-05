/** Restore document scrolling after web overlays close — prevents Safari feed freeze (BUG-004). */
export function restoreWebDocumentScrollLock(): void {
  if (typeof document === "undefined") return;
  document.body.style.removeProperty("overflow");
  document.body.style.removeProperty("position");
  document.body.style.removeProperty("touch-action");
  document.documentElement.style.removeProperty("overflow");
}
