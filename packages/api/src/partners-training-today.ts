import type { PartnerTrainingTodayEntry } from "@frennix/types";

/**
 * Privacy-filtered workouts from favorite partners and matches scheduled for `dateKey`.
 *
 * v1: returns empty — UI shell ships in Today's Focus; data layer lands in Calendar v1.1.
 * v1.1 plan:
 * - Favorite Training Partners + Frennix Match candidate set
 * - `training_calendar_items` where privacy IN ('public', 'friends') OR open session
 * - Never return `private` sessions
 * - RLS + server-side filter before client render
 */
export async function getPartnersTrainingToday(
  _userId: string,
  _dateKey: string
): Promise<PartnerTrainingTodayEntry[]> {
  return [];
}
