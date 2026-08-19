/** Locale helpers for itinerary UI that stores English strings from the API. */

import type { SupportedLanguage } from '../core/services/locale.service';

export const UI_LOCALE_TAGS: Record<SupportedLanguage, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
};

/** Map known English policy/status phrases → i18n keys. */
export const ITINERARY_PHRASE_KEYS: Record<string, string> = {
  Pending: 'ITINERARY.DAY.STATUS_PENDING',
  Confirmed: 'ITINERARY.DAY.STATUS_CONFIRMED',
  Direct: 'ITINERARY.DAY.STOPS_DIRECT',
  'Non-stop': 'ITINERARY.DAY.STOPS_NONSTOP',
  '1 Stop': 'ITINERARY.DAY.STOPS_ONE',
  'Non-Refundable': 'ITINERARY.DAY.NON_REFUNDABLE',
  'Non Refundable': 'ITINERARY.DAY.NON_REFUNDABLE',
  'Partially Refundable': 'ITINERARY.DAY.PARTIALLY_REFUNDABLE',
  'Free Cancellation': 'ITINERARY.DAY.FREE_CANCELLATION',
  'Refundable up to 24h': 'ITINERARY.DAY.REFUNDABLE_24H',
  'Availability not confirmed — verify before booking': 'ITINERARY.DAY.AVAILABILITY_UNCONFIRMED',
  'Availability not confirmed - verify before booking': 'ITINERARY.DAY.AVAILABILITY_UNCONFIRMED',
  'See attraction policy': 'ITINERARY.DAY.SEE_ATTRACTION_POLICY',
  Economy: 'ITINERARY.DAY.CLASS_ECONOMY',
  Standard: 'ITINERARY.DAY.CLASS_STANDARD',
  'Active Rental': 'ITINERARY.DAY.ACTIVE_RENTAL',
};

const TIME_OF_DAY_KEYS: Array<[RegExp, string]> = [
  [/\bMorning\b/gi, 'ITINERARY.DAY.TIME_MORNING'],
  [/\bAfternoon\b/gi, 'ITINERARY.DAY.TIME_AFTERNOON'],
  [/\bEvening\b/gi, 'ITINERARY.DAY.TIME_EVENING'],
  [/\bNight\b/gi, 'ITINERARY.DAY.TIME_NIGHT'],
  [/\bFullday\b/gi, 'ITINERARY.DAY.TIME_FULLDAY'],
  [/\bHalfday\b/gi, 'ITINERARY.DAY.TIME_HALFDAY'],
  [/\bNoon\b/gi, 'ITINERARY.DAY.TIME_NOON'],
];

export function localizeKnownPhrase(
  value: string | null | undefined,
  instant: (key: string, params?: Record<string, unknown>) => string,
): string {
  const text = (value || '').trim();
  if (!text) return '';
  const key = ITINERARY_PHRASE_KEYS[text];
  if (key) return instant(key);
  // Case-insensitive exact match
  const found = Object.entries(ITINERARY_PHRASE_KEYS).find(
    ([en]) => en.toLowerCase() === text.toLowerCase(),
  );
  return found ? instant(found[1]) : text;
}

export function localizeTimeLabel(
  value: string | null | undefined,
  instant: (key: string, params?: Record<string, unknown>) => string,
): string {
  let text = (value || '').trim();
  if (!text) return '';
  for (const [pattern, key] of TIME_OF_DAY_KEYS) {
    text = text.replace(pattern, () => instant(key));
  }
  return text;
}

export function localizeDayTitle(
  dayNum: number,
  rawTitle: string | null | undefined,
  instant: (key: string, params?: Record<string, unknown>) => string,
): string {
  const text = (rawTitle || '').trim();
  const match = text.match(/^Day\s+(\d+)\s*:\s*(.+)$/i);
  if (match) {
    return instant('ITINERARY.DAY.DAY_TITLE', { number: match[1], name: match[2] });
  }
  if (!text || /^Day\s+\d+$/i.test(text) || /Exploration/i.test(text)) {
    return instant('ITINERARY.DAY.DAY_TITLE', {
      number: dayNum,
      name: instant('ITINERARY.DAY.EXPLORATION'),
    });
  }
  return text;
}
