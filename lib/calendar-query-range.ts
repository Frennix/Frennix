/** Shared calendar month range (+7 day pad) for prefetch and tab query cache alignment. */
export function getDefaultCalendarRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const padStart = new Date(start);
  padStart.setDate(padStart.getDate() - 7);
  const padEnd = new Date(end);
  padEnd.setDate(padEnd.getDate() + 7);
  return {
    rangeStart: padStart.toISOString(),
    rangeEnd: padEnd.toISOString(),
  };
}

export function getCalendarViewQueryKey(
  userId: string,
  rangeStart: string,
  rangeEnd: string
) {
  return ["calendar-view", userId, rangeStart, rangeEnd] as const;
}
