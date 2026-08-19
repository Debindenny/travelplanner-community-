export type ChatIntent =
  | 'browse_packages'
  | 'fix_itinerary'
  | 'start_planning'
  | 'filter_packages'
  | 'create_trip'
  | 'modify_itinerary'
  | 'compare_prices'
  | 'multi_city_trip'
  | 'book_package'
  | 'book_trip'
  | 'regenerate_day'
  | 'show_images'
  | 'weather_query'
  | 'budget_filter'
  | 'save_note'
  | 'group_trip'
  | 'show_itinerary'
  | 'platform_question'
  | 'destination_info'
  | 'general';

/** Short user-facing label for intents worth surfacing as a "mode" hint above
 * the assistant reply, so the chat/search split isn't entirely invisible.
 * Intents absent from this map (e.g. 'general') render no badge. */
const INTENT_LABELS: Partial<Record<ChatIntent, string>> = {
  create_trip: '🧭 Planning a trip',
  multi_city_trip: '🧭 Planning a trip',
  group_trip: '🧭 Planning a trip',
  start_planning: '🧭 Planning a trip',
  browse_packages: '🔍 Browsing packages',
  filter_packages: '🔍 Browsing packages',
  budget_filter: '🔍 Browsing packages',
  compare_prices: '🔍 Browsing packages',
  modify_itinerary: '✏️ Editing itinerary',
  fix_itinerary: '✏️ Editing itinerary',
  regenerate_day: '✏️ Editing itinerary',
  show_itinerary: '📋 Your itinerary',
  weather_query: '☀️ Weather',
  book_package: '🎟️ Booking',
  book_trip: '🎟️ Booking',
  platform_question: '💬 About Travl Planr',
  destination_info: '📍 Destination info',
};

export function intentLabel(intent: ChatIntent | undefined): string | null {
  if (!intent) return null;
  return INTENT_LABELS[intent] ?? null;
}

export type ChatActionType =
  | 'navigate_packages'
  | 'rebuild_itinerary'
  | 'regenerate_itinerary'
  | 'start_wizard'
  | 'filter_packages'
  | 'sort_packages'
  | 'filter_budget'
  | 'create_trip'
  | 'create_draft_trip'
  | 'create_multi_city_trip'
  | 'itinerary_edit'
  | 'book_package'
  | 'book_trip'
  | 'show_images'
  | 'save_trip_note'
  | 'set_group_travelers'
  | 'show_similar_destinations'
  | 'request_destination'
  | 'open_itinerary';

export type DestinationTier = 'supported' | 'draft_eligible' | 'unknown';

export type ItineraryEditKind = 'add_activity' | 'add_transport' | 'remove_item' | 'swap_transport';

export interface ChatImage {
  url: string;
  alt: string;
}

export interface ItineraryEditPayload {
  edit: ItineraryEditKind;
  day?: number;
  title?: string;
  titleMatch?: string;
  itemType?: 'activity' | 'transport';
  transportType?: 'train' | 'bus' | 'flight' | 'car';
  fromType?: 'train' | 'bus' | 'flight' | 'car';
  toType?: 'train' | 'bus' | 'flight' | 'car';
  fromTitleMatch?: string;
  tripId?: string;
  /** When user asks to add N generic activities (not a named one). */
  count?: number;
  autoSuggest?: boolean;
}

export interface ChatAction extends Partial<ItineraryEditPayload> {
  type: ChatActionType;
  destination?: string;
  tripId?: string;
  durationDays?: number;
  sortBy?: 'price_asc' | 'price_desc';
  maxBudget?: number;
  travelers?: number;
  travelStyle?: string;
  destinations?: string[];
  cityDays?: { city: string; nights: number }[];
  packageTitle?: string;
  note?: string;
  style?: string;
  useAi?: boolean;
  query?: string;
  images?: ChatImage[];
  similar?: string[];
  coverageTier?: 'full' | 'draft';
  auto?: boolean;
  budget?: string;
  interests?: string[];
  departureLocation?: string;
  arrivalLocation?: string;
  /** Money-movement actions (book_*) only run when this is true — set when
   * the user explicitly taps the action chip, never by auto-execution. */
  confirmed?: boolean;
}

/** Raw trip-planning slots captured so far in this conversation — no
 * defaults applied. The client fills gaps the same way `createTripFromChat`
 * already does (e.g. budget || 'standard'), so this only reports what the
 * assistant actually knows. */
export interface ChatTripSlots {
  destination?: string | null;
  duration_days?: number | null;
  travelers?: number | null;
  travel_style?: string | null;
  budget?: string | null;
  interests?: string[];
  ready?: boolean;
  missing?: string[];
}

/** Mirrors weather_service.fetch_weather_summary's return shape on the backend. */
export interface ChatWeatherForecastDay {
  day: number;
  tempMaxC?: number | null;
  tempMinC?: number | null;
  precipChance?: number | null;
  weatherCode?: number | null;
}

export interface ChatWeatherSummary {
  destination?: string | null;
  currentTempC?: number | null;
  currentHumidity?: number | null;
  currentCode?: number | null;
  forecast?: ChatWeatherForecastDay[];
}

export interface ChatApiResponse {
  reply: string;
  destination?: string | null;
  intent?: ChatIntent;
  actions?: ChatAction[];
  suggested_actions?: ChatAction[];
  destination_tier?: DestinationTier | null;
  images?: ChatImage[];
  weather?: ChatWeatherSummary | null;
  trip_slots?: ChatTripSlots | null;
  /** Server-side learning log id — wire thumbs feedback to POST /chat/feedback. */
  interaction_id?: string | null;
  provider?: string | null;
}

const DESTINATION_PATTERNS: Array<[RegExp, string]> = [
  [/\bdubai\b/i, 'Dubai'],
  [/\babu\s*dhabi\b/i, 'Abu Dhabi'],
  [/\bbali\b/i, 'Bali'],
  [/\bparis\b/i, 'Paris'],
  [/\bbarcelona\b/i, 'Barcelona'],
  [/\brome\b/i, 'Italy'],
  [/\bmadrid\b/i, 'Spain'],
  [/\bsingapore\b/i, 'Singapore'],
  [/\bthailand\b/i, 'Thailand'],
  [/\bbangkok\b/i, 'Thailand'],
  [/\bjapan\b/i, 'Japan'],
  [/\btokyo\b/i, 'Japan'],
  [/\baustralia\b/i, 'Australia'],
  [/\bmalaysia\b/i, 'Malaysia'],
  [/\bmaldives\b/i, 'Maldives'],
  [/\bswitzerland\b/i, 'Switzerland'],
  [/\bgreece\b/i, 'Greece'],
  [/\bitaly\b/i, 'Italy'],
  [/\bfrance\b/i, 'France'],
  [/\bspain\b/i, 'Spain'],
  [/\blondon\b/i, 'London'],
  [/\bnew\s*york\b/i, 'New York'],
  [/\borlando\b/i, 'Orlando'],
  [/\beurope\b/i, 'Europe'],
  [/\buae\b/i, 'Dubai'],
  [/\bemirates\b/i, 'Dubai'],
  [/\bkenya\b/i, 'Kenya'],
  [/\bfiji\b/i, 'Fiji'],
  [/\bseychelles\b/i, 'Seychelles'],
  [/\bgoa\b/i, 'Goa'],
  [/\bmumbai\b/i, 'Mumbai'],
  [/\bbombay\b/i, 'Mumbai'],
  [/\bdelhi\b/i, 'Delhi'],
  [/\bnew\s*delhi\b/i, 'Delhi'],
  [/\bkochi\b/i, 'Kochi'],
  [/\bcochin\b/i, 'Kochi'],
  [/\bbangalore\b/i, 'Bangalore'],
  [/\bbengaluru\b/i, 'Bangalore'],
  [/\bbanagalore\b/i, 'Bangalore'],
  [/\bmorocco\b/i, 'Morocco'],
  [/\begypt\b/i, 'Egypt'],
];

const TRANSPORT_WORDS = new Set(['train', 'bus', 'flight', 'car', 'transfer', 'transportation', 'transport', 'rental']);

export function extractDestinationFromMessage(message: string): string | null {
  for (const [pattern, name] of DESTINATION_PATTERNS) {
    if (pattern.test(message)) return name;
  }
  return null;
}

/**
 * Destination the user is asking to plan for — prefers explicit "to X" /
 * "from A to B" phrasing over a position-independent curated scan (so
 * "trip to Goa from Bangalore" is Goa, not Bangalore).
 */
export function extractPlaceFromMessage(message: string): string | null {
  const route = extractTripRoute(message);
  if (route?.arrival) return route.arrival;

  const patterns = [
    /\b(?:trip|vacation|holiday|itinerar\w*)\s+to\s+([A-Za-z][A-Za-z\s\-'.]{1,40}?)(?=\s+from\b|\s+for\b|\s+with\b|,|\s*$|[.!?])/i,
    /\b(?:plan|build|create|make)\s+(?:a\s+)?(?:\d+\s*-?\s*day\s+)?(?:trip\s+to\s+)([A-Za-z][A-Za-z\s\-'.]{1,40}?)(?=\s+from\b|\s+for\b|\s+with\b|,|\s*$|[.!?])/i,
    /\b(?:visit|explore|go\s+to)\s+([A-Za-z][A-Za-z\-'.]{2,40})/i,
    /^([A-Za-z][A-Za-z\s\-'.]{1,40}?)\s+\d+\s*(?:day|days|night|nights)\b/i,
  ];
  for (const pattern of patterns) {
    const match = message.trim().match(pattern);
    if (!match?.[1]) continue;
    const raw = match[1]
      .trim()
      .replace(/[.!?]+$/, '')
      .replace(/\s+/g, ' ');
    if (!raw || /\b(day|days|people|person|budget|trip|plan|the)\b/i.test(raw)) continue;
    const known = extractDestinationFromMessage(raw);
    if (known) return known;
    if (raw.length >= 2) return raw.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return extractDestinationFromMessage(message);
}

export function extractTripRoute(message: string): { departure: string; arrival: string } | null {
  const fromTo = message.match(
    /\bfrom\s+([A-Za-z][A-Za-z\s\-'.]{1,40}?)\s+to\s+([A-Za-z][A-Za-z\s\-'.]{1,40})/i,
  );
  const title = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
  if (fromTo) {
    const departure = fromTo[1].trim().replace(/\s+/g, ' ');
    const arrival = fromTo[2].trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
    if (departure && arrival) {
      return { departure: title(departure), arrival: title(arrival) };
    }
  }
  const toFrom = message.match(
    /\bto\s+([A-Za-z][A-Za-z\s\-'.]{1,40}?)\s+from\s+([A-Za-z][A-Za-z\s\-'.]{1,40})/i,
  );
  if (toFrom) {
    const arrival = toFrom[1].trim().replace(/\s+/g, ' ').replace(/[.!?,]+$/, '');
    const departure = toFrom[2].trim().replace(/\s+/g, ' ').replace(/[.!?,]+$/, '');
    if (departure && arrival) {
      return { departure: title(departure), arrival: title(arrival) };
    }
  }
  return null;
}

/** Origin-only phrases like "I'm starting from Bangalore" — not a destination browse. */
export function extractDepartureCity(message: string): string | null {
  if (extractTripRoute(message)) return null;
  const match =
    message.match(
      /\b(?:i(?:'m|\s+am)?\s+)?(?:starting|departing|leaving|flying|travel(?:l?ing)?|coming)\s+from\s+([A-Za-z][A-Za-z\s\-'.]{1,40})/i,
    ) ||
    message.match(/\b(?:start|depart|leave|fly|travel)\s+from\s+([A-Za-z][A-Za-z\s\-'.]{1,40})/i) ||
    message.match(/\b(?:my\s+)?(?:origin|departure(?:\s+city)?)\s+(?:is|as|:)\s+([A-Za-z][A-Za-z\s\-'.]{1,40})/i);
  if (!match?.[1]) return null;
  const raw = match[1]
    .trim()
    .replace(/[.!?]+$/, '')
    .replace(/\s+(?:for|on|with|and|to|in|at|by|via|instead|please|thanks?)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw || /\b(trip|itinerar|package|day|days|plan)\b/i.test(raw)) return null;
  const known = extractDestinationFromMessage(raw);
  if (known) return known;
  return raw.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function extractDurationDays(message: string): number | null {
  const match = message.toLowerCase().match(/\b(\d+)\s*(?:day|days)\b/);
  return match ? parseInt(match[1], 10) : null;
}

export function extractBudgetAmount(message: string): number | null {
  const text = message.toLowerCase().replace(/,/g, '');
  if (!/\b(budget|afford|spend|under|₹|\$|usd|dollar|inr|rs)\b/.test(text)) {
    if (!/\bplan\s+a\s+(?:₹|\$|usd|\d)/.test(text)) return null;
  }
  if (/\bplan\s+a\s+\d+\s*(?:day|days)\b/.test(text)) return null;
  const match =
    text.match(/(?:₹|rs\.?|inr|usd|\$|€|£)\s*(\d+(?:\.\d+)?)/) ||
    text.match(/\b(?:budget|afford|spend|under)\s+(?:of\s+)?(?:₹|rs\.?|inr|usd|\$)?\s*(\d+(?:\.\d+)?)/) ||
    text.match(/\bplan\s+a\s+(?:₹|\$|usd)\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  let amount = parseFloat(match[1]);
  if (/\b(\d+(?:\.\d+)?)\s*(?:l|lac|lakh)\b/.test(text)) amount *= 100_000;
  else if (/\b(\d+(?:\.\d+)?)\s*k\b/.test(text) || text.includes('thousand')) amount *= 1_000;
  else if (/\$|usd|dollar/.test(text)) amount *= 83;
  return Math.round(amount);
}

export function extractTravelers(message: string): number | null {
  const text = message.toLowerCase();
  const patterns = [
    /\b(?:we\s+are|group\s+of|party\s+of|for)\s+(\d+)\s+(?:people|persons|travelers|travellers|guests|adults)\b/,
    /\b(\d+)\s+(?:people|persons|travelers|travellers|guests|adults)\b/,
    /\b(\d+)\s+(?:of\s+us|friends|couples)\b/,
  ];
  for (const re of patterns) {
    const match = text.match(re);
    if (match) return Math.max(1, Math.min(parseInt(match[1], 10), 20));
  }
  return null;
}

function canonicalCity(raw: string): string | null {
  const cleaned = raw.trim().replace(/[.,!?]+$/, '');
  if (!cleaned) return null;
  for (const [pattern, name] of DESTINATION_PATTERNS) {
    if (pattern.test(cleaned)) return name;
  }
  return cleaned.length >= 3 ? cleaned.replace(/\b\w/g, (c) => c.toUpperCase()) : null;
}

export function extractMultiCityRoute(message: string): string[] | null {
  const arrowSplit = message.split(/\s*(?:→|->|—|–)\s*/);
  if (arrowSplit.length >= 2) {
    const cities = arrowSplit.map((c) => canonicalCity(c)).filter((c): c is string => !!c);
    if (cities.length >= 2) return cities;
  }
  const toChain = message.match(
    /\b([A-Za-z][A-Za-z\s]+?)\s+to\s+([A-Za-z][A-Za-z\s]+?)\s+to\s+([A-Za-z][A-Za-z\s]+?)(?:\s+in\b|\s*$)/i,
  );
  if (toChain) {
    return [canonicalCity(toChain[1]), canonicalCity(toChain[2]), canonicalCity(toChain[3])].filter(
      (c): c is string => !!c,
    );
  }
  return null;
}

export function extractRegenerateDay(message: string): { day: number | null; style: string | null } {
  const text = message.toLowerCase();
  if (!/\b(regenerat|rewrit|redo|make|more)\b/.test(text)) return { day: null, style: null };
  const dayMatch = text.match(/\bday\s*(\d+)\b/);
  if (!dayMatch) return { day: null, style: null };
  const styleMatch = text.match(/\bmore\s+(\w+)|(\w+)\s+day\s*\d+|(\w+)\s+activities\b/);
  const style = styleMatch ? styleMatch[1] || styleMatch[2] || styleMatch[3] : null;
  return { day: parseInt(dayMatch[1], 10), style };
}

export function extractTripNote(message: string): { note: string | null; day: number | null } {
  const text = message.toLowerCase().trim();
  if (!/\b(remind|remember|note|annotate|save\s+(?:a\s+)?note)\b/.test(text)) return { note: null, day: null };
  const noteMatch = message.match(
    /(?:remind\s+me(?:\s+that)?|remember(?:\s+that)?|note(?:\s+that)?|save\s+(?:a\s+)?note(?:\s+that)?)\s+(.+)/i,
  );
  if (!noteMatch) return { note: null, day: null };
  return { note: noteMatch[1].trim().replace(/[.]+$/, ''), day: extractDayNumber(message) };
}

export function extractPackageBookingTarget(message: string): string | null {
  const text = message.toLowerCase();
  if (!/\b(book|checkout|reserve|purchase)\b/.test(text)) return null;
  const pkgMatch = text.match(/\b(?:book|checkout|reserve|purchase)\s+(?:the\s+)?(.+?)(?:\s+package|\s*$)/);
  if (pkgMatch) return pkgMatch[1].trim().replace(/[.]+$/, '');
  return extractDestinationFromMessage(message);
}

const TENS_WORDS: Record<string, number> = { twenty: 20, thirty: 30 };
const UNIT_CARDINALS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
};
const UNIT_ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9,
};
const CARDINAL_WORDS: Record<string, number> = {
  ...UNIT_CARDINALS,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
};
const ORDINAL_WORDS: Record<string, number> = {
  ...UNIT_ORDINALS,
  tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15,
  sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20, thirtieth: 30,
};
const DAY_NUMBER_WORDS: Record<string, number> = { ...CARDINAL_WORDS, ...ORDINAL_WORDS };

const DAY_WORD_ALT = Object.keys(DAY_NUMBER_WORDS)
  .sort((a, b) => b.length - a.length)
  .join('|');
// Trailing "... on/to/for [the] day <n>" / "... on the <ordinal> day" phrase,
// where <n> can be a digit, an ordinal digit (2nd), or a spelled-out number.
const TITLE_DAY_SUFFIX_RE = new RegExp(
  `\\s+(?:on|to|for|from|in)\\s+(?:the\\s+)?day\\s*(?:\\d+(?:st|nd|rd|th)?|(?:${DAY_WORD_ALT})(?:[\\s-](?:${DAY_WORD_ALT}))?)$` +
    `|\\s+(?:on|to|for|from|in)\\s+(?:the\\s+)?(?:(?:${DAY_WORD_ALT})(?:[\\s-](?:${DAY_WORD_ALT}))?|\\d+(?:st|nd|rd|th))\\s+day$` +
    `|\\s+(?:on|to|for|from|in)\\s+day\\s*\\d+(?:st|nd|rd|th)?$` +
    // Bare trailing "day N" with no connector ("activities day 3").
    `|\\s+(?:the\\s+)?day\\s*\\d+(?:st|nd|rd|th)?$` +
    `|\\s+on\\s+\\d+(?:st|nd|rd|th)?$`,
  'i',
);

function stripDaySuffix(title: string): string {
  return title.replace(TITLE_DAY_SUFFIX_RE, '').trim();
}

/** Convert a spelled-out day number ('two' → 2, 'twenty-one' → 21, 'second' → 2)
 * so voice transcriptions like 'add a car to day two' resolve correctly. */
function wordToDayNumber(phrase: string | undefined): number | null {
  if (!phrase) return null;
  const tokens = phrase.trim().toLowerCase().replace(/-/g, ' ').split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  if (tokens.length >= 2 && TENS_WORDS[tokens[0]] !== undefined) {
    const unit = UNIT_CARDINALS[tokens[1]] ?? UNIT_ORDINALS[tokens[1]];
    if (unit) return TENS_WORDS[tokens[0]] + unit;
  }
  return DAY_NUMBER_WORDS[tokens[0]] ?? null;
}

/** Ordinal-only variant for the 'the second day' phrasing. Restricting to
 * ordinals avoids misreading a duration like 'a two day trip' as day 2. */
function ordinalWordToDayNumber(phrase: string | undefined): number | null {
  if (!phrase) return null;
  const tokens = phrase.trim().toLowerCase().replace(/-/g, ' ').split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  if (tokens.length >= 2 && TENS_WORDS[tokens[0]] !== undefined && UNIT_ORDINALS[tokens[1]] !== undefined) {
    return TENS_WORDS[tokens[0]] + UNIT_ORDINALS[tokens[1]];
  }
  return ORDINAL_WORDS[tokens[tokens.length - 1]] ?? null;
}

export function extractDayNumber(message: string): number | null {
  const text = message.toLowerCase();
  // Allow a trailing ordinal ("day 3rd") so it isn't missed and defaulted to 1.
  let match = text.match(/\bday\s*(\d+)(?:st|nd|rd|th)?\b/);
  if (match) return parseInt(match[1], 10);
  match = text.match(/\b(\d+)(?:st|nd|rd|th)\s+day\b/);
  if (match) return parseInt(match[1], 10);
  match = text.match(/\bday\s+([a-z]+(?:[\s-][a-z]+)?)\b/);
  if (match) {
    const wordDay = wordToDayNumber(match[1]);
    if (wordDay) return wordDay;
  }
  match = text.match(/\b([a-z]+(?:[\s-][a-z]+)?)\s+day\b/);
  if (match) {
    const wordDay = ordinalWordToDayNumber(match[1]);
    if (wordDay) return wordDay;
  }
  match = text.match(/\bon\s+(\d+)(?:st|nd|rd|th)?\b/);
  if (match) return parseInt(match[1], 10);
  return null;
}

function cleanTitleMatch(raw: string): string {
  return raw.trim().replace(/^the\s+/i, '').trim();
}

function parseDayTransportSubject(subject: string): { day: number; fromType: ItineraryEditPayload['fromType'] } | null {
  const match = subject
    .toLowerCase()
    .trim()
    .match(/^day\s*(\d+)\s+(car|rental\s*car|train|bus|flight)$/);
  if (!match) return null;
  const fromType = match[2].replace(/\s+/g, ' ').replace('rental car', 'car') as ItineraryEditPayload['fromType'];
  return { day: parseInt(match[1], 10), fromType };
}

export function normalizeFromTitleMatch(raw?: string): string | undefined {
  if (!raw) return undefined;
  if (parseDayTransportSubject(raw)) return undefined;
  const cleaned = cleanTitleMatch(raw).toLowerCase();
  if (TRANSPORT_WORDS.has(cleaned) || cleaned === 'rental car') return undefined;
  return cleanTitleMatch(raw);
}

function parseSwapTransport(text: string, day: number | null): ItineraryEditPayload | null {
  const dayExplicit = text.match(
    /\b(?:change|replace|swap|switch)\s+(?:on\s+)?day\s*(\d+)\s+(car|rental\s*car|train|bus|flight)\s+(?:to|with)\s+(?:a\s+)?(?:any\s+)?(train|bus|flight|car)\b/i,
  );
  if (dayExplicit) {
    const fromType = dayExplicit[2].replace(/\s+/g, ' ').replace(/rental car/i, 'car') as ItineraryEditPayload['fromType'];
    let toType = dayExplicit[3].toLowerCase() as ItineraryEditPayload['toType'];
    if ((toType as string) === 'transfer' || (toType as string) === 'transportation') toType = 'car';
    return { edit: 'swap_transport', fromType, toType, day: parseInt(dayExplicit[1], 10) };
  }

  const patterns: Array<{ re: RegExp; carTitleFirst: boolean }> = [
    { re: /(?:the\s+)?(.+?)\s+car\s+change\s+it\s+to\s+(?:any\s+)?(train|bus|flight|car)\b/i, carTitleFirst: true },
    { re: /\b(?:change|replace|swap|switch)\s+(?:the\s+)?(.+?)\s+to\s+(?:a\s+)?(?:any\s+)?(train|bus|flight|car)\b/i, carTitleFirst: false },
    { re: /\b(?:change|replace|swap)\s+(?:the\s+)?(car|rental\s*car|train|bus|flight)\s+(?:to|with)\s+(?:a\s+)?(?:any\s+)?(train|bus|flight|car)\b/i, carTitleFirst: false },
  ];

  for (const { re, carTitleFirst } of patterns) {
    const match = text.match(re);
    if (!match) continue;
    let fromType: ItineraryEditPayload['fromType'] = 'car';
    let fromTitleMatch: string | undefined;
    let toType = match[2].toLowerCase() as ItineraryEditPayload['toType'];
    if ((toType as string) === 'transfer' || (toType as string) === 'transportation') toType = 'car';
    const subject = match[1].toLowerCase().trim();
    const dayTransport = parseDayTransportSubject(subject);
    if (dayTransport) {
      return { edit: 'swap_transport', fromType: dayTransport.fromType, toType, day: dayTransport.day };
    }
    if (carTitleFirst || (!TRANSPORT_WORDS.has(subject) && subject !== 'rental car')) {
      fromTitleMatch = normalizeFromTitleMatch(match[1]);
    } else if (['car', 'rental car', 'train', 'bus', 'flight'].includes(subject)) {
      fromType = subject.replace('rental ', '') as ItineraryEditPayload['fromType'];
    }
    return { edit: 'swap_transport', fromType, toType, fromTitleMatch, day: day || 1 };
  }
  return null;
}

const WORD_TO_COUNT: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
};

const GENERIC_ACTIVITY_WORDS =
  /\b(activities|activity|things\s+to\s+do|things|stuff|experiences|sights|places|spots|excursions|tours|options|attractions)\b/;

// Generic "activity" nouns — a request naming only one of these (after
// quantifiers are stripped) wants real curated suggestions, not a card titled
// with the word itself.
const ACTIVITY_NOUN_RE =
  /^(?:activities|activity|things(?:\s+to\s+do)?|things|stuff|experiences|sights|places|spots|excursions|tours|options|attractions)$/;

// Leading quantifiers/fillers that don't make an activity request specific.
const QUANTIFIER_FILLER_RE =
  /^(?:some|a few|few|a couple of|a couple|couple of|several|a bunch of|bunch of|multiple|more|additional|extra|new|other|any)\s+/i;

export function extractActivityAddCount(message: string): number | null {
  const text = message.toLowerCase();
  let match = text.match(
    /\badd\s+(\d+)\s+(?:more\s+)?(?:activities|activity|things(?:\s+to\s+do)?|experiences|sights|places|spots|excursions|tours)\b/,
  );
  if (match) return Math.min(parseInt(match[1], 10), 8);

  match = text.match(
    /\badd\s+(one|two|three|four|five|six|seven|eight)\s+(?:more\s+)?(?:activities|activity|things(?:\s+to\s+do)?|experiences|sights|places|spots)\b/,
  );
  if (match) return WORD_TO_COUNT[match[1]] ?? null;

  match = text.match(/\badd\s+(\d+)\s+more\b/);
  if (match && GENERIC_ACTIVITY_WORDS.test(text)) {
    return Math.min(parseInt(match[1], 10), 8);
  }
  return null;
}

export function isGenericActivityTitle(title: string): boolean {
  let t = title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(QUANTIFIER_FILLER_RE, '').trim();
  return (
    /^\d+\s+more\s+activit/.test(t) ||
    /^\d+\s+activit/.test(t) ||
    /^more\s+activit/.test(t) ||
    ACTIVITY_NOUN_RE.test(t)
  );
}

/** How many activities a generic "add activities" ask should add. An explicit
 * number wins; "a couple" → 2; a singular noun → 1; a plural ask defaults to 3
 * rather than a lonely 1. Mirrors _infer_generic_activity_count on the server. */
export function inferGenericActivityCount(message: string): number {
  const explicit = extractActivityAddCount(message);
  if (explicit) return explicit;
  const text = message.toLowerCase();
  if (/\b(a couple|couple of|both|two)\b/.test(text)) return 2;
  if (/\badd\s+(?:an?\s+)(?:activity|thing(?:\s+to\s+do)?|spot|place|experience|sight|excursion|tour|attraction|option)\b/.test(text)) {
    return 1;
  }
  if (/\bactivity\b/.test(text) && !/\bactivities\b/.test(text)) return 1;
  return 3;
}

export function parseItineraryEdits(message: string): ItineraryEditPayload[] {
  const text = message.toLowerCase().trim();
  const edits: ItineraryEditPayload[] = [];
  const day = extractDayNumber(message);

  const swap = parseSwapTransport(text, day);
  if (swap) return [swap];

  const bulkCount = extractActivityAddCount(message);
  if (bulkCount && bulkCount > 0 && GENERIC_ACTIVITY_WORDS.test(text)) {
    return [{ edit: 'add_activity', day: day || 1, count: bulkCount, autoSuggest: true }];
  }

  const transportMatch = text.match(/\badd\s+(?:a\s+)?(train|bus|flight|car|transfer|transportation)\b/);
  if (transportMatch) {
    let transportType = transportMatch[1] as ItineraryEditPayload['transportType'];
    if ((transportType as string) === 'transfer' || (transportType as string) === 'transportation') transportType = 'car';
    edits.push({ edit: 'add_transport', transportType, day: day || 1 });
    return edits;
  }

  if (/\b(add|insert|include|put)\b/.test(text)) {
    const addMatch = text.match(
      /\badd\s+(?:an?\s+)?(.+?)(?:\s+(?:on|to|for|in)\s+day\s*\d+(?:st|nd|rd|th)?|\s+on\s+\d+(?:st|nd|rd|th)?\b|$)/,
    );
    if (addMatch) {
      let title = stripDaySuffix(addMatch[1].trim());
      title = title.replace(/^(?:can you|could you|please)\s+/i, '').trim();
      if (title && !TRANSPORT_WORDS.has(title)) {
        // Route to real curated suggestions when generic OR when a stray
        // "day N" survived the suffix strip — never echo the command as a title.
        if (isGenericActivityTitle(title) || /\bday\s*\d+/.test(title)) {
          const count = inferGenericActivityCount(message);
          return [{ edit: 'add_activity', day: day || 1, count, autoSuggest: true }];
        }
        edits.push({ edit: 'add_activity', title: title.replace(/\b\w/g, (c) => c.toUpperCase()), day: day || 1 });
        return edits;
      }
    }
  }

  if (/\b(remove|delete|drop|cancel)\b/.test(text)) {
    const removeMatch = text.match(/\b(?:remove|delete|drop|cancel)\s+(?:the\s+)?(.+?)(?:\s+(?:from|on)\s+day\s*\d+|\s+on\s+\d+(?:st|nd|rd|th)?\b|$)/);
    if (removeMatch) {
      const title = stripDaySuffix(removeMatch[1].trim());
      const itemType = /train|bus|flight|car|transfer/.test(title) ? 'transport' : 'activity';
      edits.push({ edit: 'remove_item', titleMatch: title, day: day ?? undefined, itemType });
    }
  }

  return edits;
}

const PLATFORM_QUESTION_RE =
  /\b(pricing|subscription|free\s+plan|paid\s+plan|upgrade\s+(?:my\s+)?plan|how\s+much\s+(?:does|is)\s+(?:travl\s*planr|this\s+app|the\s+app|it)\s+cost|how\s+does\s+(?:travl\s*planr|this\s+app|the\s+app|this\s+site|this)\s+work|how\s+it\s+works|refund|cancel\s+my\s+(?:subscription|account|plan)|contact\s+support|customer\s+support|is\s+(?:travl\s*planr|this)\s+free|do\s+i\s+need\s+an?\s+account|privacy\s+polic|terms\s+of\s+service|faq|frequently\s+asked)\b/i;

export function inferIntentFromMessage(message: string): ChatIntent {
  const text = message.toLowerCase();

  if (parseItineraryEdits(message).length) return 'modify_itinerary';
  if (extractTripNote(message).note) return 'save_note';
  if (PLATFORM_QUESTION_RE.test(text) && !extractDestinationFromMessage(message)) return 'platform_question';

  if (/\b(book|checkout|reserve|purchase)\b/.test(text)) {
    if (/\b(package|standard|premium|deluxe)\b/.test(text) || extractDestinationFromMessage(message)) return 'book_package';
    if (/\b(trip|itinerar\w*|plan)\b/.test(text)) return 'book_trip';
  }

  if (/\b(show\s+me|images?|photos?|pictures?)\b/.test(text) && /\b(beach|beaches|food|temple|mountain|sunset|view|scenery|gallery)\b/.test(text)) {
    return 'show_images';
  }

  if (/\b(cheapest|lowest\s+price|compare\s+prices?|price\s+comparison|best\s+deal|best\s+value)\b/.test(text)) {
    return 'compare_prices';
  }

  if (extractBudgetAmount(message) && /\b(budget|afford|spend|under|plan\s+a|week|trip|package)\b/.test(text)) {
    return 'budget_filter';
  }

  const { day: regenDay } = extractRegenerateDay(message);
  if (
    regenDay &&
    /\b(regenerat|rewrit|redo|make)\b/.test(text) &&
    /\b(more\s+(relaxing|adventur\w*|cultural|exciting|active|scenic|food|local|fun)|relaxing|adventur\w*)\b/.test(text)
  ) {
    return 'regenerate_day';
  }

  if (extractMultiCityRoute(message) && /\b(trip|itinerar\w*|vacation|holiday|plan|days?)\b/.test(text)) {
    return 'multi_city_trip';
  }

  if (extractTravelers(message) && /\b(trip|plan|travel|vacation|holiday|group)\b/.test(text)) {
    return 'group_trip';
  }

  if (/\b(weather|temperature|rain|forecast|climate|season|best\s+time(?:\s+to\s+visit)?|when\s+to\s+visit)\b/.test(text)) return 'weather_query';

  if (
    /\b(tell\s+me\s+about|what\s+to\s+(?:see|do)|attractions?\s+in|overview\s+of)\b/.test(text) &&
    extractDestinationFromMessage(message)
  ) {
    return 'destination_info';
  }

  if (
    /\b(fix|improve|update|change|redo|rebuild|refresh|correct|adjust)\b.*\b(itinerar\w*|plan|trip|schedule|days)\b/.test(text) ||
    /\b(itinerar\w*|plan|trip)\b.*\b(fix|improve|update|change|redo|rebuild|refresh|correct|adjust)\b/.test(text)
  ) {
    return 'fix_itinerary';
  }

  // Origin / routing corrections — never browse packages for the home city.
  if (
    extractDepartureCity(message) ||
    (/\b(?:i\s+will\s+be\s+)?(?:travell?ing|flying|departing|leaving|coming)\s+from\b/.test(text) &&
      extractTripRoute(message))
  ) {
    return 'fix_itinerary';
  }

  if (/\bfilter\b/.test(text) && /\b(package|day|days|night|tour)\b/.test(text)) return 'filter_packages';
  if (extractDurationDays(message) && /\b(package|packages)\b/.test(text)) return 'filter_packages';

  if (
    /\b(show|view|open|see|display|bring up)\b.*\b(itinerar\w*|trip plan|trip)\b/.test(text) ||
    /\b(itinerar\w*)\b.*\b(show|view|open|see|display)\b/.test(text) ||
    /\b(turn|convert)\b.*\binto\b.*\b(full\s+)?(itinerar\w*|trip\s+plan)\b/.test(text)
  ) {
    return 'show_itinerary';
  }

  if (/\b(make|create|build|plan|generate|start|draft)\b/.test(text) && /\b(trip|itinerar\w*|vacation|holiday)\b/.test(text)) {
    return 'create_trip';
  }
  if (extractDurationDays(message) && /\b(trip|itinerar\w*|vacation|holiday)\b/.test(text)) return 'create_trip';
  if (extractDurationDays(message) && /\b(?:in|to)\s+[a-z]/i.test(text)) return 'create_trip';

  if (/\b(package|packages|deal|tours?|holiday)\b/.test(text)) return 'browse_packages';
  if (/\b(plan|planning|wizard|custom|build|create)\b.*\b(trip|itinerar|vacation|holiday)\b/.test(text)) return 'start_planning';
  if (extractDestinationFromMessage(message)) return 'browse_packages';
  return 'general';
}

export function suggestedActionLabel(action: ChatAction): string {
  switch (action.type) {
    case 'create_draft_trip':
      return `Create draft itinerary${action.destination ? ` for ${action.destination}` : ''}`;
    case 'show_similar_destinations':
      return action.similar?.length
        ? `Browse similar: ${action.similar.slice(0, 2).join(', ')}`
        : 'Browse similar destinations';
    case 'request_destination':
      return action.destination ? `Request ${action.destination}` : 'Request this destination';
    case 'book_package':
      return `Book ${action.packageTitle || action.destination || 'this package'}`;
    case 'book_trip':
      return 'Proceed to booking';
    default:
      return 'Continue';
  }
}

export function buildClientActions(
  message: string,
  tripId?: string | null,
  region?: string | null,
): ChatAction[] {
  const intent = inferIntentFromMessage(message);
  const departureOnly = extractDepartureCity(message);
  const destination = departureOnly ? null : extractDestinationFromMessage(message);
  const route = extractTripRoute(message);
  const actions: ChatAction[] = [];
  const durationDays = extractDurationDays(message);
  const tripDestination = route?.arrival || destination;

  // On an open itinerary, "starting from X" updates departure — never packages.
  if (tripId && departureOnly) {
    return [{
      type: 'regenerate_itinerary',
      tripId,
      departureLocation: departureOnly,
      arrivalLocation: region || undefined,
      useAi: true,
      style: region
        ? `Update outbound flights to depart from ${departureOnly} to ${region}.`
        : `Update outbound flights to depart from ${departureOnly}.`,
    }];
  }

  if (destination && ['browse_packages', 'start_planning', 'general', 'compare_prices', 'budget_filter'].includes(intent)) {
    actions.push({ type: 'navigate_packages', destination });
  }
  if (destination && intent === 'start_planning') {
    // Carry over any slots already captured in this message so the wizard
    // opens pre-filled instead of re-asking what the user just said.
    actions.push({
      type: 'start_wizard',
      destination,
      travelers: extractTravelers(message) ?? undefined,
    });
  }
  if (intent === 'fix_itinerary') {
    if (route && tripId) {
      actions.push({
        type: 'regenerate_itinerary',
        tripId,
        departureLocation: route.departure,
        arrivalLocation: route.arrival || region || undefined,
        useAi: true,
        style: `Update flights to route ${route.departure} to ${route.arrival || region || 'destination'}.`,
      });
    } else if (!departureOnly) {
      actions.push({ type: 'rebuild_itinerary', tripId: tripId || undefined });
    }
  }
  if (intent === 'compare_prices') {
    actions.push({ type: 'sort_packages', sortBy: 'price_asc', durationDays: durationDays ?? undefined, destination: destination || region || undefined });
    if (durationDays) actions.push({ type: 'filter_packages', durationDays });
  }
  const budget = extractBudgetAmount(message);
  if (intent === 'budget_filter' && budget) {
    actions.push({ type: 'filter_budget', maxBudget: budget, durationDays: durationDays ?? undefined, destination: destination || region || undefined });
  }
  if (intent === 'filter_packages' && durationDays) {
    actions.push({ type: 'filter_packages', durationDays });
    if (!actions.some((a) => a.type === 'navigate_packages')) {
      actions.push({ type: 'navigate_packages', destination: destination || region || 'Europe' });
    }
  }
  if (intent === 'create_trip' && durationDays) {
    const travelers = extractTravelers(message);
    const hasPrefs = /\b(food|culture|adventure|relax|family|solo|couple|friends|budget|premium|sightseeing)\b/i.test(message);
    if (!travelers && !hasPrefs) return actions;
    // Never invent a destination from page region when the message named one —
    // sticky open-itinerary region (e.g. Australia) was creating wrong trips.
    const messagePlace = extractPlaceFromMessage(message);
    const dest = messagePlace || tripDestination || region;
    if (!dest) return actions;
    const knownDestination = Boolean(extractDestinationFromMessage(messagePlace || message));
    actions.push({
      type: knownDestination ? 'create_trip' : 'create_draft_trip',
      destination: dest,
      durationDays,
      travelers: travelers ?? undefined,
      coverageTier: knownDestination ? 'full' : 'draft',
      departureLocation: route?.departure,
      arrivalLocation: route?.arrival || messagePlace || tripDestination || undefined,
    });
  }
  if (intent === 'multi_city_trip') {
    const cities = extractMultiCityRoute(message) || [];
    const totalDays = durationDays || Math.max(cities.length * 3, 7);
    const nightsEach = Math.max(1, Math.floor(totalDays / Math.max(cities.length, 1)) - 1);
    actions.push({
      type: 'create_multi_city_trip',
      destinations: cities,
      cityDays: cities.map((city) => ({ city, nights: nightsEach })),
      durationDays: totalDays,
      travelers: extractTravelers(message) ?? undefined,
    });
  }
  if (intent === 'group_trip' && destination && durationDays) {
    const travelers = extractTravelers(message) || 2;
    actions.push({
      type: 'create_trip',
      destination,
      durationDays,
      travelers,
      travelStyle: travelers > 2 ? 'friends' : 'couple',
      coverageTier: 'full',
    });
  }
  if (intent === 'regenerate_day') {
    const { day, style } = extractRegenerateDay(message);
    actions.push({ type: 'regenerate_itinerary', day: day ?? undefined, style: style ?? undefined, useAi: true, tripId: tripId || undefined });
  }
  if (intent === 'save_note') {
    const { note, day } = extractTripNote(message);
    if (note) actions.push({ type: 'save_trip_note', note, day: day ?? undefined, tripId: tripId || undefined });
  }
  if (intent === 'book_package') {
    actions.push({ type: 'book_package', packageTitle: extractPackageBookingTarget(message) ?? undefined, destination: destination || region || undefined });
  }
  if (intent === 'book_trip') {
    actions.push({ type: 'book_trip', tripId: tripId || undefined });
  }
  if (intent === 'show_images') {
    actions.push({ type: 'show_images', query: message, destination: destination || region || undefined });
  }
  if (intent === 'modify_itinerary') {
    for (const edit of parseItineraryEdits(message)) {
      actions.push({ type: 'itinerary_edit', ...edit, tripId: tripId || undefined });
    }
  }
  return actions;
}
