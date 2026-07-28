import type { Profile } from "@frennix/types";

/**
 * TEMP investigation flag — show load diagnostics for any signed-in user in production.
 * Remove after Training Partners load failure is diagnosed and fixed.
 */
export const TRAINING_PARTNER_LOAD_DIAGNOSTICS_PROD_DEBUG = true;

/** Temporary local override — set in phone browser console:
 * localStorage.setItem("frennix:debug-training-partners", "1")
 */
export const TRAINING_PARTNER_LOAD_DEBUG_STORAGE_KEY = "frennix:debug-training-partners";

export function isTrainingPartnerLoadDiagnosticsVisible(
  profile: Profile | null | undefined,
  isAuthenticated = false
): boolean {
  if (TRAINING_PARTNER_LOAD_DIAGNOSTICS_PROD_DEBUG && isAuthenticated) return true;

  if (profile?.is_admin) return true;

  if (typeof window === "undefined") return false;

  try {
    if (window.localStorage.getItem(TRAINING_PARTNER_LOAD_DEBUG_STORAGE_KEY) === "1") {
      return true;
    }
    if (window.sessionStorage.getItem(TRAINING_PARTNER_LOAD_DEBUG_STORAGE_KEY) === "1") {
      return true;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug_training_partners") === "1") return true;
  } catch {
    // ignore storage access errors
  }

  return false;
}
