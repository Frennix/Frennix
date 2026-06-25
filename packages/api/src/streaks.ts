/** Local calendar day at midnight for streak calculations. */
function localDayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return localDayStart(next);
}

/**
 * Count consecutive calendar days with at least one workout post.
 * Streak stays active through today if the last workout was today or yesterday.
 * Resets to 0 if the most recent workout was two or more days ago.
 */
export function computeWorkoutStreakFromDates(isoDates: string[], now = new Date()): number {
  if (!isoDates.length) return 0;

  const dayKeys = [...new Set(isoDates.map((iso) => localDayStart(new Date(iso)).getTime()))].sort(
    (a, b) => b - a
  );

  const today = localDayStart(now).getTime();
  const yesterday = addLocalDays(now, -1).getTime();

  if (dayKeys[0] !== today && dayKeys[0] !== yesterday) return 0;

  let streak = 1;
  let expectedPrevious = addLocalDays(new Date(dayKeys[0]), -1).getTime();

  for (let i = 1; i < dayKeys.length; i++) {
    if (dayKeys[i] === expectedPrevious) {
      streak++;
      expectedPrevious = addLocalDays(new Date(dayKeys[i]), -1).getTime();
    } else {
      break;
    }
  }

  return streak;
}
