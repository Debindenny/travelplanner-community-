const MONTH_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * Parses a plain "YYYY-MM-DD" string as a local calendar date (midnight in
 * the viewer's own timezone) rather than the UTC midnight `new Date(string)`
 * would produce for that format — otherwise a date typed as "2027-06-03"
 * can display as the 2nd or 4th depending on the viewer's offset. Anything
 * else (a full ISO timestamp, or a Date already) is parsed/passed through
 * as-is.
 */
function toLocalDate(value: string | Date): Date | null {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (!value) return null;
  const isoDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (isoDateOnly) {
    const [, y, m, d] = isoDateOnly;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function dayMonth(d: Date): { day: string; month: string } {
  return { day: d.getDate().toString().padStart(2, '0'), month: MONTH_ABBR[d.getMonth()] };
}

/**
 * The one shared event date-range formatter — every card, detail header,
 * search result, and booking summary in the app should call this rather
 * than building its own month/day string, so a hosted event, a joined
 * event, and a seeded/demo event all render identically, before and after
 * a refresh.
 *
 * Format rules (nights = endDate - startDate, computed automatically):
 *   Same month:  "03 - 12 JUN (9 NIGHTS)"
 *   Cross month: "28 JUN - 05 JUL (7 NIGHTS)"
 *   Cross year:  "28 DEC - 04 JAN (7 NIGHTS)"   (the month names alone disambiguate — no year shown)
 *
 * Falls back to a bare "DD MON" (no range, no nights) when there's no
 * usable end date, so a single-date event still degrades gracefully
 * instead of throwing or showing "NaN NIGHTS".
 */
export function formatEventDateRange(startDate: string | Date, endDate?: string | Date | null): string {
  const start = toLocalDate(startDate);
  if (!start) return '';
  const { day: startDay, month: startMonth } = dayMonth(start);

  const end = endDate ? toLocalDate(endDate) : null;
  if (!end || end.getTime() <= start.getTime()) {
    return `${startDay} ${startMonth}`;
  }

  const { day: endDay, month: endMonth } = dayMonth(end);
  const nights = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  const range =
    startMonth === endMonth ? `${startDay} - ${endDay} ${startMonth}` : `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
  return nights > 0 ? `${range} (${nights} NIGHTS)` : range;
}
