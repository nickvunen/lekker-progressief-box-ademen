// Daily practice streak — pure, local-date logic. No side effects here so it
// stays trivially verifiable; persistence lives in App via usePersistedState.

/** Local calendar date as YYYY-MM-DD (not UTC — the streak is per user day). */
export function todayISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Advance the streak given the previous state and today's date.
 * - same day  → unchanged (already counted today)
 * - yesterday → increment
 * - otherwise → reset to 1 (first day of a new streak)
 */
export function advanceStreak(
  lastDate: string | null,
  count: number,
  today: string,
): { count: number; lastDate: string } {
  if (lastDate === today) return { count, lastDate: today };

  const yesterday = todayISO(
    new Date(new Date(`${today}T00:00:00`).getTime() - 86_400_000),
  );
  const next = lastDate === yesterday ? count + 1 : 1;
  return { count: next, lastDate: today };
}
