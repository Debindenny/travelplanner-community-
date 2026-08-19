/** Parse the largest day count from package duration strings like "7 Days : 6 Night / 5Days". */
export function parsePackageDurationDays(duration: string): number | null {
  const matches = duration.match(/\b(\d+)\s*(?:day|days)\b/gi);
  if (!matches?.length) return null;
  const values = matches.map((m) => parseInt(m, 10)).filter((n) => !Number.isNaN(n));
  return values.length ? Math.max(...values) : null;
}
