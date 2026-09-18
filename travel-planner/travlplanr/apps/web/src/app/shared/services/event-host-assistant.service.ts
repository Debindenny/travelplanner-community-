import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TravelChatSessionService } from './travel-chat-session.service';
import { ChatApiService } from './chat-api.service';
import { CommunityEventsMockStore, CURRENT_USER_ID } from '../../community/services/community-events-mock.store';
import {
  CommunityEventCard,
  EventScheduleStep,
  FALLBACK_IMAGE,
  JourneyActivity,
  JourneyDay,
  journeyActivityToTripSegment,
  unsplashUrl
} from '../../community/services/community-event-view.model';
import { TripDay, TripService } from '../../trip/trip.service';
import { EventItineraryService } from '../../community/services/event-itinerary.service';
import { CommunityEventsService } from '../../community/services/community-events.service';
import { AuthService } from '../../auth/auth.service';
import { firstValueFrom } from 'rxjs';
import {
  extractBudgetAmount,
  extractDepartureCity,
  extractDurationDays,
  extractPlaceFromMessage,
  extractTravelers,
  extractTripRoute,
  extractMultiCityRoute
} from '../utils/chat-intent.util';
import {
  analyzeItineraryComposition,
  perUnitRates,
  resolveCostAllocation,
  type EventCostAllocation
} from '../utils/event-cost-allocation.util';

export type EventJoinOption = 'full' | 'partial' | 'both';

export interface EventHostForm {
  title: string;
  eventType: string;
  travelStyle: string[];
  startLocation: string;
  viaLocations: string[];
  destination: string;
  startDate: string;
  endDate: string;
  /** Persisted separately from endDate so a duration mentioned before any
   * date exists ("a 7-day trip") isn't lost by the time a start date arrives
   * in a LATER message — endDate gets derived from whichever of the two
   * (start date, duration) is still missing once both are eventually known,
   * regardless of which turn each one came from. Never sent to the backend
   * directly — only used to compute endDate client-side. */
  durationDays: number | null;
  participantLimit: number | null;
  budget: string;
  description: string;
  activities: string[];
  accommodation: string;
  transportation: string;
  /** '' means "not yet answered" — narrowed to a real EventJoinOption before
   * this form is ever handed to createEvent()/buildEventCard(). */
  joinOption: EventJoinOption | '';
  /** Shortest/longest consecutive stretch a partial-join traveler may pick.
   * null means "no limit configured" — clamped to the real day count later. */
  joinRange: { min: number; max: number } | null;
  /** Explicit host-provided cost overrides — each independent of the
   * others; a host can give some categories and leave the rest to be
   * derived from budget + itinerary composition (see
   * event-cost-allocation.util.ts). null = "not provided". */
  accommodationCost: number | null;
  transportCost: number | null;
  foodCost: number | null;
  activityCost: number | null;
}

const EMPTY_FORM: EventHostForm = {
  title: '',
  eventType: '',
  travelStyle: [],
  startLocation: '',
  viaLocations: [],
  destination: '',
  startDate: '',
  endDate: '',
  durationDays: null,
  participantLimit: null,
  budget: '',
  description: '',
  activities: [],
  accommodation: '',
  transportation: '',
  joinOption: '',
  joinRange: null,
  accommodationCost: null,
  transportCost: null,
  foodCost: null,
  activityCost: null
};

function dateLabel(d: Date): string {
  return `${d.getDate().toString().padStart(2, '0')} ${d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}`;
}

const EVENT_ACTIVITY_TIMES = ['09:00', '14:00', '19:00'];

/** Small pool of generic travel-themed thumbnails for host-authored activities
 * (no real photo per activity exists — these are decorative, not unique). */
const EVENT_ACTIVITY_IMAGE_IDS = [
  '1499856871958-5b9627545d1a', // old-town street
  '1499425543974-31970c11ecd8', // museum interior
  '1502602898657-3e91760cbb34', // landmark
  '1470337458703-46ad1756a187', // rooftop bar
  '1507525428034-b723cf961d3e', // beach
  '1512453979798-5ea266f8880c'  // culture/show
];

const HOTEL_IMAGE_ID = '1566073771259-6a8506099945';
const TRANSPORT_IMAGE_ID = '1474487548417-781cb71495f3';

const WELCOME_MESSAGE =
  "Hi! 👋 I'm your Event Hosting Assistant.\n" +
  "Tell me about the event you'd like to host, in your own words — for example:\n" +
  '"I want to host a 7-day Paris adventure trip from Chennai in December for 20 people with a budget of ₹1,00,000."\n' +
  "I'll ask about anything I still need to know as we go.";

const MONTH_NAMES: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
};
const MONTH_PATTERN = Object.keys(MONTH_NAMES).sort((a, b) => b.length - a.length).join('|');

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

/** A month already passed this year almost certainly means the host meant
 * next year (nobody hosts a trip in the past) — same "infer forward" logic
 * chat_intent.py's own date resolution uses for the main trip planner. */
function inferYear(month: number, today: Date): number {
  const year = today.getFullYear();
  return month < today.getMonth() ? year + 1 : year;
}

/** Every distinct calendar date mentioned in the message — ISO ("2026-12-05"),
 * "5 December 2026", or "December 5, 2026". Deliberately collects ALL of
 * them (not just the first) so a genuine range like "from December 5, 2026
 * to December 9, 2026" is recognized as two dates, not silently truncated to
 * one — that truncation was the actual cause of a 5-day trip publishing as a
 * single day (see extractDateRangeFromMessage). */
function collectDatesFromMessage(message: string, today: Date): Date[] {
  const dates: Date[] = [];
  for (const iso of message.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? []) {
    const d = new Date(`${iso}T00:00:00`);
    if (!isNaN(d.getTime())) dates.push(d);
  }
  const dayMonthYear = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_PATTERN})\\.?\\s*,?\\s*(\\d{4})?\\b`, 'gi');
  const monthDayYear = new RegExp(`\\b(${MONTH_PATTERN})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*,?\\s*(\\d{4})?\\b`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = dayMonthYear.exec(message))) {
    const month = MONTH_NAMES[m[2].toLowerCase()];
    const year = m[3] ? parseInt(m[3], 10) : inferYear(month, today);
    dates.push(new Date(year, month, parseInt(m[1], 10)));
  }
  while ((m = monthDayYear.exec(message))) {
    const month = MONTH_NAMES[m[1].toLowerCase()];
    const year = m[3] ? parseInt(m[3], 10) : inferYear(month, today);
    dates.push(new Date(year, month, parseInt(m[2], 10)));
  }
  return dates;
}

/** Best-effort date-range extraction from free text. Collects every date
 * mentioned and, when two or more distinct ones appear (a real range, in
 * either order — "5 to 9 December" or "9 December, starting the 5th"),
 * returns the earliest as `start` and the latest as `end` directly — instead
 * of requiring a separate "5 days" duration phrase to derive `end` at all.
 * Falls back to a single date (`end: null`, left for extractDurationDays or
 * withDefaults to resolve) or a bare month name ("in December" → the 1st)
 * when only one date-like mention exists. Approximate by design, same
 * tradeoff chat-intent.util.ts's own extractors already accept for the main
 * trip planner. */
function extractDateRangeFromMessage(message: string, today = new Date()): { start: string | null; end: string | null } {
  const dates = collectDatesFromMessage(message, today);
  if (dates.length >= 2) {
    dates.sort((a, b) => a.getTime() - b.getTime());
    return { start: toLocalDateString(dates[0]), end: toLocalDateString(dates[dates.length - 1]) };
  }
  if (dates.length === 1) {
    return { start: toLocalDateString(dates[0]), end: null };
  }
  const bareMonth = message.match(new RegExp(`\\b(?:in|on|during)\\s+(${MONTH_PATTERN})\\b`, 'i'));
  if (bareMonth) {
    const month = MONTH_NAMES[bareMonth[1].toLowerCase()];
    return { start: toLocalDateString(new Date(inferYear(month, today), month, 1)), end: null };
  }
  return { start: null, end: null };
}

/** Words that never belong in an actual place name, but can otherwise bleed
 * into a "destination"/"startLocation" value when a message describes a
 * field-by-field structure (e.g. "Destination: Bangkok\nJoin Option:
 * Partial") — the underlying place extractors (extractPlaceFromMessage,
 * extractDepartureCity) stop at from/for/with/comma/sentence-end, but not at
 * a newline or a "Label:" that follows on its own line. Truncating at the
 * first of these (and at the first newline) is what keeps "Bangkok" from
 * becoming "Bangkok Join Option" — which then also corrupts the default
 * title ("{destination} Trip") downstream in withDefaults(). */
const LOCATION_STOP_WORDS =
  /\b(join|option|book\w*|budget|participant\w*|duration|date|title|type|style|activit\w*|accommodat\w*|transport\w*|flight|vehicle|description)\b/i;

/** Every field label the Event Hosting Assistant's own question prompts use
 * — referenced only to recognize a single-space field boundary below, never
 * as a blocklist of words a value can't contain (LOCATION_STOP_WORDS already
 * owns that job for locations, and a title/description is allowed to
 * contain any of these as plain English). */
const KNOWN_FIELD_LABELS =
  'event\\s*name|event\\s*title|title|destination|start\\s*(?:location|city|point)|location|via(?:\\s*locations?|\\s*stops?)?|route|start\\s*date|end\\s*date|duration|participant\\s*limit|budget|travel\\s*styles?|activit\\w*\\s*cost|activit\\w*|accommodat\\w*\\s*cost|accommodat\\w*|transport\\w*\\s*cost|transport\\w*|food\\s*cost|join\\s*option|book\\w*\\s*option|description';

/** A run of 2+ whitespace characters marks a field boundary just as much as
 * a real newline does — a host who lays out fields as "Event Name: X  Start
 * Date: Y  Location: Z" (double-space-separated, no actual \n) would
 * otherwise have nothing to stop extraction from running past the field
 * they meant all the way to the end of the message. Confirmed live: this is
 * exactly what turned "Bangkok" into a 400+ character captured title/
 * destination (the whole rest of the message), which then failed the
 * backend's 255-char title limit and silently fell back to a local-only,
 * never-persisted event.
 *
 * A SINGLE space is also a field boundary when what follows is unmistakably
 * the start of the next field ("Label:") — reported case: "Event Name:
 * Swiss Alpine Explorer Travel Style: Adventure, Nature Accommodation: ..."
 * has only one space between the title and "Travel Style:", so the \s{2,}
 * branch above never fires and extractEventTitle() kept the entire rest of
 * the message as the title. Gated on a known label (not "any word followed
 * by a colon") so a title that legitimately contains a colon isn't cut
 * short.
 *
 * The boundary is anchored on `\b` (a label word-start), not on requiring an
 * actual whitespace character before it — a labeled value can arrive with NO
 * separator to consume at all, e.g. a via-locations array item that is
 * itself exactly "Destination: Lucerne" (the label starts at index 0, so
 * there's no leading space for a `\s+`-based check to match). `\s*\b` still
 * consumes any whitespace that IS there (same as the old `\s+` case) but
 * also matches a zero-width boundary right at the label when there's none —
 * this is what lets sanitizeLocationValue() reduce a raw LLM slot like
 * "Interlaken Destination: Lucerne" down to "Interlaken" regardless of
 * whether that came in as one merged string or as separate array items. */
function firstFieldBoundary(raw: string): number {
  const m = raw.match(new RegExp(`\\r?\\n|\\s{2,}|\\s*\\b(?=(?:${KNOWN_FIELD_LABELS})\\s*:)`, 'i'));
  return m?.index ?? -1;
}

/** Narrative route-connector words ("Chennai via Zurich and Interlaken to
 * Lucerne") that never belong inside a single city's own value. The
 * regex extractors above are careful to strip these when they build a route
 * sequence, but the free-text LLM slot extractor (run_event_turn on the
 * backend) has no city-boundary logic of its own — it just paraphrases the
 * host's sentence. Confirmed: for exactly that input it returned
 * startLocation "Chennai via Zurich and Interlaken" and destination "Lucerne
 * from". "and" is deliberately excluded here — it's the legitimate
 * separator inside a multi-stop via list (see the split in
 * extractViaLocations()/extractRouteSequence()/applyHints()), not a
 * corruption signal by itself. */
const ROUTE_CONNECTOR_WORDS = /\b(via|then|from|to)\b/i;

function sanitizeLocationValue(raw: string): string {
  const boundary = firstFieldBoundary(raw);
  let value = boundary >= 0 ? raw.slice(0, boundary) : raw;
  // A sentence-ending period is also a boundary for a location value
  // specifically — a real place name never legitimately continues past a
  // full stop, but this isn't part of the shared firstFieldBoundary() since
  // a title/description sentence is SUPPOSED to end in one. Confirmed: a
  // captured destination otherwise ran straight through "Madrid." into the
  // next field's own label ("Event Name: ...") with only a single space
  // between them — no newline or double-space for firstFieldBoundary() to
  // catch.
  const periodIdx = value.search(/\.\s|\.$/);
  if (periodIdx >= 0) value = value.slice(0, periodIdx);
  const stop = value.match(LOCATION_STOP_WORDS);
  if (stop?.index !== undefined) value = value.slice(0, stop.index);
  const connector = value.match(ROUTE_CONNECTOR_WORDS);
  if (connector?.index !== undefined) value = value.slice(0, connector.index);
  return value.trim().replace(/[,:;.\-\s]+$/, '');
}

/** Truncates at the first newline only — unlike sanitizeLocationValue(), a
 * title is host-authored creative text that can legitimately contain words
 * like "Budget" or "Adventure" ("Budget Backpacking Adventure"), so it must
 * NOT be cut on those keywords the way a place name safely can be. Only
 * protects against the same field-by-field bleeding (a title followed by
 * "Start Date: ..." on the next line). */
function sanitizeSingleLineValue(raw: string): string {
  const boundary = firstFieldBoundary(raw);
  const value = boundary >= 0 ? raw.slice(0, boundary) : raw;
  return value.trim().replace(/[,:;.\-\s]+$/, '');
}

/** An explicit "Destination:"/"Location:" label takes priority over the
 * generic route/place heuristics (extractTripRoute/extractPlaceFromMessage)
 * — those scan the WHOLE message, including any separate "Transportation:"
 * field, and can mistake a multi-leg transport description ("Flight from
 * Chennai to Delhi and private vehicle to Manali") for the actual
 * destination. Confirmed: that's exactly what produced "Delhi And Private
 * Vehicle To Manali Book" as a destination. Only the first comma-separated
 * segment is kept ("Manali, Himachal Pradesh" → "Manali") — this value is
 * shown as a plain city name elsewhere, not a full region string. */
function extractLabeledDestination(message: string): string | null {
  // "Destination:" is unambiguous; a bare "Location:" is also accepted, but
  // never when it's actually "Start Location:" (that's the start city, not
  // the destination — handled separately by extractLabeledStartLocation()).
  const labeled =
    message.match(/\bdestination\s*:\s*([^\n]+)/i) ?? message.match(/\blocation\s*:\s*([^\n]+)/i);
  if (!labeled?.[1]) return null;
  const cleaned = sanitizeLocationValue(labeled[1]);
  return cleaned ? cleaned.split(',')[0].trim() : null;
}

function extractLabeledStartLocation(message: string): string | null {
  const labeled = message.match(/\bstart\s*(?:location|city|point)\s*:\s*([^\n]+)/i);
  if (!labeled?.[1]) return null;
  const cleaned = sanitizeLocationValue(labeled[1]);
  return cleaned ? cleaned.split(',')[0].trim() : null;
}

/** "Via: Delhi" / "Via Locations: Delhi, Agra" — the intermediate stops
 * between start and destination that make up the middle of the
 * "Chennai → Delhi → Manali" route trail. "Skip"/"none" means explicitly no
 * stops (returns an empty array, not null, so the caller can tell "answered,
 * nothing to add" apart from "field not mentioned at all"). */
function extractViaLocations(message: string): string[] | null {
  const labeled = message.match(/\bvia\s*(?:location|locations|stop|stops)?\s*:\s*([^\n]+)/i);
  if (!labeled?.[1]) return null;
  const raw = labeled[1];
  const boundary = firstFieldBoundary(raw);
  const value = (boundary >= 0 ? raw.slice(0, boundary) : raw).trim();
  if (!value || /^(skip|none|n\/a|na)$/i.test(value)) return [];
  return value
    .split(/,|\band\b/i)
    .map((s) => sanitizeLocationValue(s))
    .filter(Boolean);
}

/** A touring route ("Route: Paris → Barcelona → Madrid", or "Paris to
 * Barcelona to Madrid") names the WHOLE sequence of cities the itinerary
 * actually visits — not a single "destination" with brief "via" stops. When
 * one is found, its first city becomes startLocation, its last becomes
 * destination, and everything between becomes viaLocations, so the trail
 * comes out as the full route rather than collapsing to just the final
 * city. Scoped to an explicit "Route:" label first (extractMultiCityRoute
 * scans the whole message otherwise, which risks matching an unrelated "to
 * ... to" chain elsewhere, e.g. in a Transportation field). */
/** A word-piece city name, non-greedy so it stops at the earliest sensible
 * boundary rather than swallowing the rest of the sentence. */
const NARRATIVE_CITY = `[A-Za-z][A-Za-z\\s\\-'.]{1,30}?`;
const NARRATIVE_ROUTE_END = `(?=[.,!?]|\\s+(?:for|with)\\b|\\s*$)`;

/** "trip to Paris from Chennai via Dubai" / "from Chennai via Dubai to
 * Paris" / "Chennai via Dubai to Paris" — a narrative sentence naming a
 * start, an intermediate stop, and a destination with "via" as the stop
 * marker. Confirmed: this exact phrasing ("...to Paris from Chennai via
 * Dubai for 20 people.") was falling through to extractTripRoute()'s plain
 * "to X from Y" pattern, which has no concept of "via" and greedily
 * swallowed "Chennai via Dubai for 20 people" as a single departure value. */
function extractNarrativeRoute(message: string): string[] | null {
  console.log('INPUT_MESSAGE', message);
  let m = message.match(
    new RegExp(`\\bto\\s+(${NARRATIVE_CITY})\\s+from\\s+(${NARRATIVE_CITY})\\s+via\\s+(${NARRATIVE_CITY})${NARRATIVE_ROUTE_END}`, 'i')
  );
  if (m) return [m[2], m[3], m[1]];
  m = message.match(
    new RegExp(`\\bfrom\\s+(${NARRATIVE_CITY})\\s+via\\s+(${NARRATIVE_CITY})\\s+to\\s+(${NARRATIVE_CITY})${NARRATIVE_ROUTE_END}`, 'i')
  );
  if (m) return [m[1], m[2], m[3]];
  m = message.match(
  /\bfrom\s+([A-Za-z\s]+?)\s+via\s+(.+?)\s+to\s+([A-Za-z\s]+?)(?=\s+on|\s+from|\s+for|\.|,|$)/i
);
if (m) {
  return [
    m[1].trim(),
    ...m[2]
      .split(/\band\b|,/i)
      .map(v => v.trim())
      .filter(Boolean),
    m[3].trim()
  ];
}
  // "starting from Paris, travelling via Barcelona, and ending in Madrid"
  m = message.match(
    new RegExp(
      `\\bstarting\\s+from\\s+(${NARRATIVE_CITY})\\s*,?\\s+travell?ing\\s+via\\s+(${NARRATIVE_CITY})\\s*,?\\s+and\\s+ending\\s+in\\s+(${NARRATIVE_CITY})${NARRATIVE_ROUTE_END}`,
      'i'
    )
  );
  if (m) return [m[1], m[2], m[3]];
  // "from Paris to Barcelona and then Madrid" / "Paris to Barcelona then
  // Madrid" — "then"/"and then" is just as common a 3-city connector as
  // "via", and wasn't recognized at all before (confirmed: this exact
  // phrasing fell through to extractTripRoute()'s plain "from X to Y",
  // which read everything after "to" — including "and then Madrid" AND
  // the next field's own "Event Name:" label — as one destination value).
  m = message.match(
    new RegExp(`\\bfrom\\s+(${NARRATIVE_CITY})\\s+to\\s+(${NARRATIVE_CITY})\\s+(?:and\\s+)?then\\s+(${NARRATIVE_CITY})${NARRATIVE_ROUTE_END}`, 'i')
  );
  if (m) return [m[1], m[2], m[3]];
  m = message.match(
    new RegExp(`\\b(${NARRATIVE_CITY})\\s+to\\s+(${NARRATIVE_CITY})\\s+(?:and\\s+)?then\\s+(${NARRATIVE_CITY})${NARRATIVE_ROUTE_END}`, 'i')
  );
  if (m) return [m[1], m[2], m[3]];
  return null;
}

function extractRouteSequence(message: string): string[] | null {
  const labeled = message.match(/\broute\s*:\s*([^\n]+)/i);
  const scope = labeled?.[1] ?? message;
  const cities = extractMultiCityRoute(scope) ?? extractNarrativeRoute(message);
  console.log('ROUTE_SEQUENCE_RAW', JSON.stringify(cities));
  if (!cities) return null;
  // extractMultiCityRoute() title-cases each city but doesn't know about
  // this app's field-labeled input style — its LAST city can otherwise
  // absorb everything up to the next field ("Madrid  Start Date: ...") the
  // same way the plain destination extraction used to.
  //
  // extractNarrativeRoute()'s "(CITY) via (CITY) to (CITY)" pattern also has
  // no concept of more than one via-stop — for "Chennai via Zurich and
  // Interlaken to Lucerne" its middle group captures the whole chain,
  // "Zurich and Interlaken", as ONE entry. Splitting every entry the same
  // way extractViaLocations() already splits a labeled "Via:" list expands
  // that back into two separate stops.
  const expanded = cities.flatMap((c) => c.split(/,|\band\b/i));
  const cleaned = expanded.map((c) => sanitizeLocationValue(c)).filter(Boolean);
  return cleaned.length >= 2 ? cleaned : null;
}

/** Best-effort event-name extraction: an explicit "Event Name: X" / "Title:
 * X" label (matching how a host describing fields directly would phrase
 * it), natural phrasing ("call it X", "name it X", "titled X"), or a quoted
 * phrase — in that order. Returns null (leaving withDefaults()'s
 * "{destination} Trip" fallback in place) only when none of these match. */
function extractEventTitle(message: string): string | null {
  const labeled = message.match(/\b(?:event\s*name|event\s*title|title)\s*:\s*([^\n]+)/i);
  if (labeled?.[1]) {
    const cleaned = sanitizeSingleLineValue(labeled[1]);
    if (cleaned) return cleaned;
  }
  const phrased = message.match(/\b(?:call(?:ed)?|name(?:d)?|titled)\s+(?:it\s+)?["“]?([A-Za-z][A-Za-z0-9\s\-'.:&]{2,60}?)["”]?(?=[.!?]|$)/i);
  if (phrased?.[1]) {
    const cleaned = sanitizeSingleLineValue(phrased[1]);
    if (cleaned) return cleaned;
  }
  const quoted = message.match(/["“]([A-Za-z][A-Za-z0-9\s\-'.:&]{2,60}?)["”]/);
  if (quoted?.[1]) {
    const cleaned = sanitizeSingleLineValue(quoted[1]);
    if (cleaned) return cleaned;
  }
  return null;
}

/** extractDurationDays() (chat-intent.util.ts, shared with the main trip
 * planner) is `/\b(\d+)\s*(?:day|days)\b/` — `\s*` matches whitespace only,
 * so it never matches a HYPHENATED "7-day trip" (confirmed: this exact
 * phrasing, including this assistant's own welcome-message example, silently
 * produced a 1-day itinerary because of it). Tried first as a supplement
 * here rather than widened in the shared file, to avoid changing behavior
 * for the main trip-planning chat that also uses it. */
function extractDurationDaysLocal(message: string): number | null {
  const shared = extractDurationDays(message);
  if (shared) return shared;
  const hyphenated = message.toLowerCase().match(/\b(\d+)\s*-\s*day(?:s)?\b/);
  return hyphenated ? parseInt(hyphenated[1], 10) : null;
}

/** Best-effort join-option extraction — an explicit "Join Option: Both/
 * Partial/Full" label, or free text mentioning "full"/"partial"/"both" near
 * a joining/booking-related word (so an unrelated use of "full" elsewhere in
 * the message, e.g. "a full week", doesn't get misread as a join-option
 * answer). "both" or the co-occurrence of "full" and "partial" both mean
 * `both`; a lone "partial" means `partial`; a lone "full" means `full`. */
function extractJoinOption(message: string): EventJoinOption | null {
  const labeled = message.match(/\bjoin\s*option\s*:\s*([^\n]+)/i);
  const scope = labeled?.[1] ?? message;
  if (!labeled && !/\b(join|joining|booking|book|participat\w*)\b/i.test(scope)) return null;
  const hasBoth = /\bboth\b/i.test(scope);
  const hasFull = /\bfull\b/i.test(scope);
  const hasPartial = /\bpartial\b/i.test(scope);
  if (hasBoth || (hasFull && hasPartial)) return 'both';
  if (hasPartial) return 'partial';
  if (hasFull) return 'full';
  return null;
}

/** Explicit per-category cost overrides — "Accommodation Cost: 40000",
 * "Transport Cost: ₹30,000". Kept separate from the general-purpose
 * extractBudgetAmount() (which reads the overall event budget): these are
 * for the four narrow "X Cost:" labels only, one per Cost Breakdown
 * category, and must NOT match a bare "Budget:" line. */
function extractLabeledCost(message: string, labelPattern: string): number | null {
  const labeled = message.match(new RegExp(`\\b${labelPattern}\\s*cost\\s*:\\s*([^\\n]+)`, 'i'));
  if (!labeled?.[1]) return null;
  const raw = labeled[1];
  const boundary = firstFieldBoundary(raw);
  const value = (boundary >= 0 ? raw.slice(0, boundary) : raw).trim();
  const amount = parseBudgetAmount(value);
  return amount > 0 ? amount : null;
}

/** Always-available, non-LLM extraction pass — reuses the SAME regex
 * extractors the main trip planner's chat already relies on
 * (chat-intent.util.ts), so Event Hosting has the identical resilience
 * model: something useful gets captured from every message regardless of
 * whether the LLM extractor (POST /api/v1/chat/extract-event) is reachable.
 * Only ever fills a field that's still empty — never overwrites an answer
 * already captured (by this pass or the LLM) on an earlier turn. */
function basicExtractFromMessage(text: string, form: EventHostForm): Partial<Record<keyof EventHostForm, unknown>> {
  const out: Partial<Record<keyof EventHostForm, unknown>> = {};
  const route = extractTripRoute(text);

  if (!form.title) {
    const title = extractEventTitle(text);
    if (title) out['title'] = title;
  }
  // A full touring route ("Paris → Barcelona → Madrid") takes priority over
  // the single-city extractors below — it names the whole sequence the
  // itinerary actually visits, not just one destination plus brief stops.
  const routeSequence = extractRouteSequence(text);
  const labeledDestination = extractLabeledDestination(text);
  const labeledStartLocation = extractLabeledStartLocation(text);
  const labeledVia = extractViaLocations(text);

  // Explicit labels are a deliberate, unambiguous statement of intent — they
  // must be able to CORRECT a value an earlier turn's looser heuristic
  // guess got wrong, not just fill in a still-empty field. Without this, an
  // early wrong guess (e.g. "Paris" mistaken for the destination) would
  // permanently block a later explicit "Destination: Madrid" from ever
  // being applied — confirmed: that's exactly what produced "Paris → Paris".
  if (routeSequence) {
    out['startLocation'] = routeSequence[0];
    out['destination'] = routeSequence[routeSequence.length - 1];
    if (routeSequence.length > 2) out['viaLocations'] = routeSequence.slice(1, -1);
  }
  if (labeledDestination && out['destination'] === undefined) out['destination'] = labeledDestination;
  if (labeledStartLocation && out['startLocation'] === undefined) out['startLocation'] = labeledStartLocation;
  if (labeledVia && out['viaLocations'] === undefined) out['viaLocations'] = labeledVia;

  // Below this point: only the looser heuristics remain, and those only
  // ever fill a field that's still genuinely empty — an uncertain guess
  // shouldn't clobber another uncertain guess from an earlier turn either.
  if (!form.destination && out['destination'] === undefined) {
    const destination = route?.arrival ?? extractPlaceFromMessage(text);
    if (destination) out['destination'] = destination;
  }
  if (!form.startLocation && out['startLocation'] === undefined) {
    const startLocation = route?.departure ?? extractDepartureCity(text);
    if (startLocation) out['startLocation'] = startLocation;
  }
  // No dedicated unlabeled heuristic for via-stops beyond the route
  // sequence/label above — left empty rather than guessed at.
  // Duration is captured independently of whether a start date is known
  // yet — a host who says "a 7-day trip" before ever giving a date must not
  // lose that number by the time the date arrives in a later message.
  if (form.durationDays == null) {
    const duration = extractDurationDaysLocal(text);
    if (duration && duration > 0) out['durationDays'] = duration;
  }

  if (!form.startDate || !form.endDate) {
    const range = extractDateRangeFromMessage(text);
    if (range.start && range.end) {
      // A genuine two-date range mentioned in this one message.
      if (!form.startDate) out['startDate'] = range.start;
      if (!form.endDate) out['endDate'] = range.end;
    } else if (range.start) {
      if (!form.startDate) {
        out['startDate'] = range.start;
      } else if (!form.endDate && range.start >= form.startDate) {
        // Only one date mentioned, but we already have a start from an
        // earlier turn — this lone date is almost certainly the end date
        // ("it should end December 9"), not a second start.
        out['endDate'] = range.start;
      }
    }
  }
  if (!form.endDate && out['endDate'] === undefined) {
    // No second explicit date this turn — derive it from duration instead,
    // using whichever of (start date, duration) just arrived THIS turn and
    // whichever was already known from an earlier one, in any combination.
    const startDate = (out['startDate'] as string | undefined) ?? form.startDate;
    const duration = (out['durationDays'] as number | undefined) ?? form.durationDays ?? undefined;
    if (startDate && duration && duration > 0) {
      const start = new Date(`${startDate}T00:00:00`);
      const end = new Date(start);
      end.setDate(start.getDate() + Math.max(0, duration - 1));
      out['endDate'] = toLocalDateString(end);
    }
  }
  if (form.participantLimit == null) {
    const travelers = extractTravelers(text);
    if (travelers) out['participantLimit'] = travelers;
  }
  if (!form.budget) {
    const amount = extractBudgetAmount(text);
    if (amount) out['budget'] = `₹${amount.toLocaleString('en-IN')}`;
  }
  // Explicit per-category cost overrides — independent of each other and of
  // the overall budget above; only fill a category still unset (an earlier
  // "Accommodation Cost: 40000" must not be clobbered by a later message
  // that only mentions the other three).
  if (form.accommodationCost == null) {
    const cost = extractLabeledCost(text, 'accommodation');
    if (cost) out['accommodationCost'] = cost;
  }
  if (form.transportCost == null) {
    const cost = extractLabeledCost(text, 'transport(?:ation)?');
    if (cost) out['transportCost'] = cost;
  }
  if (form.foodCost == null) {
    const cost = extractLabeledCost(text, 'food');
    if (cost) out['foodCost'] = cost;
  }
  if (form.activityCost == null) {
    const cost = extractLabeledCost(text, 'activit\\w*');
    if (cost) out['activityCost'] = cost;
  }
  if (!form.travelStyle.length) {
    const styles = extractTravelStyles(text);
    if (styles.length) out['travelStyle'] = styles;
  }
  if (!form.joinOption) {
    const joinOption = extractJoinOption(text);
    if (joinOption) out['joinOption'] = joinOption;
  }
  if (!form.description) {
    // Only an explicit "Description: ..." label is accepted here — never
    // the raw message itself. withDefaults() composes a proper short
    // summary from the structured fields when no label was given, instead
    // of dumping the whole original prompt onto the Event Overview.
    const description = extractEventDescription(text);
    if (description) out['description'] = description;
  }
  return out;
}

function extractEventDescription(message: string): string | null {
  const labeled = message.match(/\bdescription\s*:\s*([^\n]+)/i);
  if (!labeled?.[1]) return null;
  // A description is a real sentence — truncate at the next field boundary
  // (same bleed-over protection as sanitizeSingleLineValue), but don't strip
  // its own trailing period the way that helper does for short field values.
  const raw = labeled[1];
  const boundary = firstFieldBoundary(raw);
  const value = (boundary >= 0 ? raw.slice(0, boundary) : raw).trim();
  return value || null;
}

function joinWithAnd(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function tripDayCount(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

/** Composes a short, natural Event Overview sentence from the already-
 * extracted structured fields — e.g. "Manali Mountain Escape is a 5-day
 * adventure and nature community travel event in Manali." Only ever used as
 * a last-resort fallback in withDefaults(), when neither an explicit
 * "Description:" label nor the LLM provided one — never a substitute for a
 * real description the host actually gave. */
function buildAutoDescription(opts: {
  title: string;
  dayCount: number;
  travelStyle: string[];
  destination: string;
  /** Full [startLocation, ...viaLocations, destination] trail, already
   * filtered of empties — when it has more than one city, "covering X, Y,
   * and Z" is more informative than naming only the final destination and
   * silently dropping the route the itinerary actually follows. */
  routeCities: string[];
}): string {
  const styles = opts.travelStyle.map((s) => s.toLowerCase());
  const styleText = styles.length ? joinWithAnd(styles) : 'community';
  const dayLabel = opts.dayCount > 0 ? `${opts.dayCount}-day ` : '';
  const placeText =
    opts.routeCities.length > 1 ? ` covering ${joinWithAnd(opts.routeCities)}` : opts.destination ? ` in ${opts.destination}` : '';
  return `${opts.title} is a ${dayLabel}${styleText} community travel event${placeText}.`;
}

/** Recognized travel-style keywords → the card's theme-chip labels. This is
 * the ONLY thing the Events list card ever shows as tags for a hosted event
 * (see community-events.component.ts's interestTagsFor()/tagsFor()) — that
 * component falls back to showing [destination, price] as tags whenever
 * `interestTags` (travelStyle) is empty, which is exactly what made a
 * budget value and a destination name show up as tags. Populating a real
 * travelStyle here (and withDefaults() guaranteeing it's never empty) keeps
 * that legacy fallback from ever triggering for a hosted event, without
 * touching the shared card-list component itself. */
const TRAVEL_STYLE_KEYWORDS: [RegExp, string][] = [
  [/\badventure\w*\b/i, 'Adventure'],
  [/\b(culture|cultural|heritage|historic\w*|temple\w*)\b/i, 'Culture'],
  [/\b(city\s*(?:tour|walk|exploration)?|sightsee\w*|urban)\b/i, 'City Exploration'],
  [/\b(food|cuisine|culinary|dining|street\s*food|foodie)\b/i, 'Food & Cuisine'],
  [/\bshopping\b/i, 'Shopping'],
  [/\b(nightlife|clubbing|bar\s*hopping|party\s*scene)\b/i, 'Nightlife'],
  [/\b(nature|wildlife|outdoor\w*|scenic)\b/i, 'Nature'],
  [/\b(trek\w*|hik\w*)\b/i, 'Trekking'],
  [/\b(relax\w*|spa|wellness|leisurely?)\b/i, 'Relaxation'],
  [/\bbeach(?:es)?\b/i, 'Beach']
];

function extractTravelStyles(message: string): string[] {
  const found: string[] = [];
  for (const [pattern, label] of TRAVEL_STYLE_KEYWORDS) {
    if (pattern.test(message) && !found.includes(label)) found.push(label);
  }
  return found;
}

/** Fills every still-missing field with a sensible, neutral default right
 * before publishing — this is what lets an event be created the instant the
 * bare minimum (destination + start date) is known, instead of waiting for
 * every field to be understood. A host who described more gets a richer
 * event; a host who only gave the essentials still gets a real, working one. */
function withDefaults(f: EventHostForm): EventHostForm {
  const destination = f.destination || 'the destination';
  const title = f.title || `${f.destination || 'Community'} Trip`;
  const startDate = f.startDate;
  const endDate = f.endDate || startDate;
  // Never empty — see extractTravelStyles()'s doc comment: this is what
  // keeps the Events list card from falling back to showing the
  // destination/budget as tags for a hosted event.
  const travelStyle = f.travelStyle.length ? f.travelStyle : ['Adventure'];
  const routeCities = [f.startLocation, ...f.viaLocations, f.destination].filter(Boolean);
  return {
    ...f,
    title,
    eventType: f.eventType || 'Community Trip',
    endDate,
    budget: f.budget || 'Not specified',
    description:
      f.description ||
      buildAutoDescription({ title, dayCount: tripDayCount(startDate, endDate), travelStyle, destination, routeCities }),
    activities: f.activities.length ? f.activities : ['Free time to explore'],
    travelStyle,
    accommodation: f.accommodation || 'Accommodation to be arranged',
    transportation: f.transportation || 'Self-arranged',
    joinOption: f.joinOption || 'full'
  };
}

/** Detects a flight/train/bus mode from the free-text transportation answer so
 * the arrival/departure activity title matches ItineraryTimelineComponent's
 * locked-reservation pattern (Hotel Check-in/out, Flight/Train/Bus
 * Departure/Arrival). Car and unrecognized/self-arranged transportation stay
 * generic — those aren't in the locked list, matching the business rule that
 * only these four reservation types are fixed. */
function transportModeLabel(transportation: string): 'Flight' | 'Train' | 'Bus' | null {
  const t = transportation.toLowerCase();
  if (/\b(flight|fly|flying|plane|air)\b/.test(t)) return 'Flight';
  if (/\btrain\b/.test(t)) return 'Train';
  if (/\bbus\b/.test(t)) return 'Bus';
  return null;
}

/** Parses "$500", "₹20000", "2k", "1.5L", "Free" into a rough numeric amount
 * (0 when unparseable) — used to spread a whole-trip budget across days. */
function parseBudgetAmount(raw: string): number {
  const text = raw.toLowerCase().replace(/,/g, '');
  if (/\bfree\b/.test(text)) return 0;
  const match = text.match(/(\d+(?:\.\d+)?)\s*(k|l|lac|lakh)?/);
  if (!match) return 0;
  const n = parseFloat(match[1]);
  if (!Number.isFinite(n)) return 0;
  const unit = match[2];
  if (unit === 'k') return Math.round(n * 1_000);
  if (unit === 'l' || unit === 'lac' || unit === 'lakh') return Math.round(n * 100_000);
  return Math.round(n);
}

/**
 * Drives the "host an event" conversation as plain turns inside the existing
 * AI chatbot's thread (TravelChatSessionService.messages) — no separate page,
 * panel, or component. floating-chatbot.component.ts and hero-section.component.ts
 * route composer submits here instead of to the real chat backend while
 * `active()` is true, and tag every bubble with the 'event_host' chat intent so
 * the existing mode-badge UI marks this as a distinct assistant mode.
 *
 * Fully conversational, and resilient the same way the main trip-planner
 * chat is: every message runs through TWO extraction layers, not one.
 * `basicExtractFromMessage()` is a regex-based pass (reusing the same
 * extractors chat-intent.util.ts already provides the main planner) that
 * always runs and never fails. `chatApi.runEventHostingTurn()` (backend:
 * llm_event_extraction.py, same free Ollama path the main chat uses, no
 * paid API) is a best-effort LLM pass layered on top when reachable, adding
 * richer detail and phrasing the next question in its own words — but its
 * absence never blocks anything. Publishing is gated on a true minimum
 * (destination + a start date), not on the LLM ever declaring the form
 * "complete" — the instant that minimum is known, the event is created
 * immediately with sensible defaults (withDefaults()) for anything else
 * still missing, exactly like the trip planner creates a Trip shell before
 * its own async content generation finishes. No summary/review step, no
 * typed "confirm", no payment step anywhere.
 */
@Injectable({ providedIn: 'root' })
export class EventHostAssistantService {
  private readonly chat = inject(TravelChatSessionService);
  private readonly chatApi = inject(ChatApiService);
  private readonly store = inject(CommunityEventsMockStore);
  private readonly router = inject(Router);
  private readonly tripService = inject(TripService);
  private readonly itineraryService = inject(EventItineraryService);
  private readonly meetupsService = inject(CommunityEventsService);
  private readonly auth = inject(AuthService);

  readonly active = signal(false);
  private readonly form = signal<EventHostForm>({ ...EMPTY_FORM });

  start(): void {
    if (this.active()) return;
    this.active.set(true);
    this.form.set({ ...EMPTY_FORM });
    this.pushAssistant(WELCOME_MESSAGE);
  }

  async submitAnswer(raw: string): Promise<void> {
    if (!this.active()) return;
    const text = raw.trim();
    if (!text) return;
    this.pushUser(text);

    if (/^cancel$/i.test(text)) {
      this.active.set(false);
      this.pushAssistant('No problem — cancelled hosting setup. Ask me anything else to keep planning your own trip.');
      return;
    }

    await this.extractAndAdvance(text);
  }

  /** Regex extraction runs first and always succeeds; the LLM turn is a
   * best-effort layer on top that can fail without consequence. Publishing
   * is gated on `hasMinimumToPublish()`, not on the LLM's own completeness
   * judgment — so Event Hosting can never be fully blocked by the LLM being
   * unavailable, matching the trip planner's resilience model. */
  private async extractAndAdvance(text: string): Promise<void> {
    const regexHints = basicExtractFromMessage(text, this.form());
    console.log('REGEX HINTS', regexHints);
    this.applyHints(regexHints as Record<string, unknown>);

    this.chat.sending.set(true);
    let turn: { slots: Record<string, unknown>; reply: string; ready: boolean } | null;
    try {
      turn = await this.chatApi.runEventHostingTurn(text, this.form() as unknown as Record<string, unknown>);
      console.log('LLM SLOTS', turn?.slots);
    } finally {
      this.chat.sending.set(false);
    }

    // The LLM's extraction is more capable than the regex pass, so it takes
    // precedence when both catch the same field — but it's never required.
    if (turn) {
      const slots = { ...turn.slots };
      // llm_event_extraction.py's own system prompt defines viaLocations as
      // "array of strings — include only if this message adds to them, else
      // empty array" — an empty array here means "nothing new this turn,"
      // not "clear it." applyHints() can't tell that apart from the regex
      // pass's OWN empty array (which DOES mean "host explicitly answered
      // skip/none" — see extractViaLocations()), so this is filtered out
      // here rather than changing applyHints()'s shared merge semantics.
      // Confirmed: "Chennai via Zurich and Interlaken to Lucerne" got the
      // correct ["Zurich", "Interlaken"] from the regex pass, then lost it
      // when this second call applied the LLM's viaLocations: [].
      if (Array.isArray(slots['viaLocations']) && !(slots['viaLocations'] as unknown[]).length) {
        delete slots['viaLocations'];
      }
      this.applyHints(slots);
    }

    if (this.hasMinimumToPublish(this.form())) {
      if (turn?.reply) this.pushAssistant(turn.reply);
      await this.createEvent();
      return;
    }

    if (turn) {
      this.pushAssistant(turn.reply);
      return;
    }

    // LLM unreachable AND still missing the one thing a real event genuinely
    // can't exist without — this is the single narrow case Event Hosting
    // still asks about directly (there's no backend row possible otherwise).
    this.pushAssistant(this.minimumAskMessage(this.form()));
  }

  /** The only two fields truly required to create a real `community_meetups`
   * row — everything else gets a sensible default via withDefaults() at
   * publish time. Deliberately not "every field the model can extract": that
   * would recreate the old block-until-LLM-says-ready behavior this
   * redesign removes. */
  private hasMinimumToPublish(f: EventHostForm): boolean {
    return !!f.destination && !!f.startDate;
  }

  private minimumAskMessage(f: EventHostForm): string {
    return !f.destination
      ? 'Where will this event take place?'
      : 'When does it start? (e.g. 2026-12-05, or "in December")';
  }

  /** Merges validated extractor output into the running form. Only known-good
   * keys are copied over — an empty/invalid extractor response leaves the
   * form untouched rather than clobbering an already-answered field. */
  private applyHints(hints: Record<string, unknown>): void {
    if (!hints || !Object.keys(hints).length) return;
    this.form.update((f) => {
      const next: EventHostForm = { ...f };
      if (typeof hints['title'] === 'string') {
        const title = sanitizeSingleLineValue(hints['title']);
        if (title) next.title = title;
      }
      if (typeof hints['eventType'] === 'string') next.eventType = hints['eventType'];
      if (typeof hints['startLocation'] === 'string') next.startLocation = sanitizeLocationValue(hints['startLocation']);
      if (Array.isArray(hints['viaLocations'])) {
        const rawVia = (hints['viaLocations'] as unknown[]).filter((v): v is string => typeof v === 'string');
        // Defensive: an LLM slot can hand back a via-location with the NEXT
        // field's own label still glued on ("Interlaken Destination:
        // Lucerne") instead of a clean split — sanitizeLocationValue() below
        // strips that off, but recover the leaked destination first so it
        // isn't just discarded when this turn's own "destination" slot is
        // missing/empty.
        const leakedDestination = rawVia
          .map((v) => v.match(/\bdestination\s*:\s*([^\n]+)/i)?.[1])
          .find((v): v is string => !!v);
        if (leakedDestination && typeof hints['destination'] !== 'string') {
          const cleaned = sanitizeLocationValue(leakedDestination);
          if (cleaned) next.destination = cleaned;
        }
        // A free-text LLM slot can also hand back multiple stops as one
        // "and"-joined item ("Zurich and Interlaken") instead of separate
        // array entries — split the same way extractRouteSequence()/
        // extractViaLocations() already do before sanitizing each stop.
        next.viaLocations = rawVia
          .flatMap((v) => v.split(/,|\band\b/i))
          .map((v) => sanitizeLocationValue(v))
          .filter(Boolean);
      }
      if (typeof hints['destination'] === 'string') next.destination = sanitizeLocationValue(hints['destination']);
      if (Array.isArray(hints['travelStyle'])) next.travelStyle = hints['travelStyle'] as string[];
      if (typeof hints['startDate'] === 'string') next.startDate = hints['startDate'];
      if (typeof hints['endDate'] === 'string') {
        // Never accept an end date earlier than a start date we already have.
        if (!next.startDate || (hints['endDate'] as string) >= next.startDate) {
          next.endDate = hints['endDate'] as string;
        }
      }
      if (typeof hints['durationDays'] === 'number' && hints['durationDays'] > 0) next.durationDays = hints['durationDays'];
      if (typeof hints['participantLimit'] === 'number') next.participantLimit = hints['participantLimit'];
      if (typeof hints['budget'] === 'string') next.budget = hints['budget'];
      if (typeof hints['description'] === 'string') next.description = hints['description'];
      if (Array.isArray(hints['activities'])) next.activities = hints['activities'] as string[];
      if (typeof hints['accommodation'] === 'string') next.accommodation = hints['accommodation'];
      if (typeof hints['transportation'] === 'string') next.transportation = hints['transportation'];
      // Explicit per-category cost overrides — each independent; a positive
      // number always wins (0/negative from a confused LLM turn is ignored
      // rather than treated as "the host said this category is free").
      
      if (hints['joinOption'] === 'full' || hints['joinOption'] === 'partial' || hints['joinOption'] === 'both') {
        next.joinOption = hints['joinOption'];
      }
      const joinRange = hints['joinRange'] as { min?: unknown; max?: unknown } | undefined;
      if (joinRange && typeof joinRange.min === 'number' && typeof joinRange.max === 'number') {
        next.joinRange = { min: joinRange.min, max: joinRange.max };
      }
      return next;
    });
  }

  /** Creates the real community meetup catalog row (title/description/
   * location/dates) via POST /community/meetups, so the event itself exists
   * server-side — not just its itinerary. Its real id then becomes this
   * event's id everywhere else (itinerary rows, trip customizations.eventId),
   * so the whole event is one consistent record instead of two disconnected
   * ones. Falls back to a local-only id if this fails (offline, not logged
   * in, or a validation rule like "starts_at can't be in the past") — the
   * event still works locally, it just isn't persisted. */
  private async createRealMeetup(f: EventHostForm): Promise<string | null> {
    try {
      const startsAt = new Date(`${f.startDate}T09:00:00`);
      const endsAt = f.endDate ? new Date(`${f.endDate}T18:00:00`) : undefined;
      console.log('HOST_PREFERENCES_PAYLOAD', {
        startLocation: f.startLocation,
        viaLocations: f.viaLocations,
        destination: f.destination
        });
      const meetup = await firstValueFrom(
        this.meetupsService.createEvent({
          title: f.title,
          description: f.description,
          location: f.destination,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt?.toISOString(),
          host_preferences: {
            eventType: f.eventType,
            startLocation: f.startLocation || undefined,
            viaLocations: f.viaLocations,
            travelStyle: f.travelStyle,
            participantLimit: f.participantLimit,
            budget: f.budget,
            activities: f.activities,
            accommodation: f.accommodation,
            transportation: f.transportation,
            // Guaranteed non-'' by the time createEvent() runs — extractAndAdvance()
            // only calls createEvent() once the model reports joinOption (and
            // every other required field) is known.
            joinOption: f.joinOption as EventJoinOption,
            joinRange: f.joinRange
          }
        })
      );
      return meetup.id;
    } catch (err) {
      console.error('Could not create the real community meetup — event will be local-only', err);
      return null;
    }
  }

  /** Publishes the event and, whenever possible, turns its itinerary into a
   * real Trip via TripService.createFromContent() — the same backend path
   * used to make a joined hosted journey "a real, editable itinerary" — so
   * viewing/editing it happens on the actual /itinerary/:id page (same
   * component, same cards, same lock rules) instead of a lookalike. Falls
   * back to the community event list if that call fails (e.g. offline, or
   * the host isn't logged in) so publishing never silently breaks. */
  private async createEvent(): Promise<void> {
    console.log('FINAL FORM', this.form());
    // Defaults are applied here, not earlier — the running form (this.form())
    // stays "what the host actually said" for as long as the conversation is
    // active; only the published card gets the neutral fill-ins for anything
    // still missing at the moment the minimum was met.
    const f = withDefaults(this.form());
    const id = (await this.createRealMeetup(f)) ?? `evt-${Date.now()}`;
    const card = this.buildEventCard(f, id);
    
    console.log('CARD CITIES', card.cities);

    this.store.addEvent(card);

    // Best-effort, independent of the real-Trip creation below: persist the
    // itinerary itself so GET /community/meetups/:id/itinerary returns real
    // data on a later visit, even if this traveler isn't logged in (that call
    // requires auth too, so both simply no-op together in that case). The
    // event and trip are already created regardless of whether this succeeds.
    if (card.days?.length) {
      try {
        await this.itineraryService.createItinerary(card.id, card.days);
      } catch (err) {
        console.error('Could not persist the hosted event itinerary', err);
      }
    }

    try {
      const days: TripDay[] = (card.days ?? []).map((d) => ({
        day: d.day,
        title: d.city,
        activities: d.activities.map((a) => a.title)
      }));
      const segments = (card.days ?? []).flatMap((d) => d.activities.map((a) => journeyActivityToTripSegment(a, d)));
      const tripId = await this.tripService.createFromContent({
        title: card.title,
        destination: f.destination,
        startDate: f.startDate,
        endDate: f.endDate,
        travelers: 1,
        budget: f.budget,
        image: card.imageUrl,
        days,
        segments,
        customizations: { eventId: card.id, hostedEvent: true }
      });
      card.tripId = tripId;
      this.store.updateEvent(card.id, { tripId });
      this.store.setPendingToast(`"${card.title}" is live — visible to the community`);
      this.active.set(false);
      this.pushAssistant(`🎉 "${card.title}" is live! Taking you to your itinerary…`);
      setTimeout(() => this.router.navigateByUrl(`/itinerary/${tripId}`), 1200);
    } catch (err) {
      console.error('Could not publish this event as a real trip — falling back to the community listing', err);
      this.store.setPendingToast(`"${card.title}" is live — visible to the community`);
      this.active.set(false);
      this.pushAssistant(`🎉 "${card.title}" is live! Taking you to your event…`);
      setTimeout(() => this.router.navigateByUrl('/community/events'), 1400);
    }
  }

  private buildEventCard(f: EventHostForm, id: string): CommunityEventCard {
    const start = f.startDate ? new Date(`${f.startDate}T00:00:00`) : new Date();
    const end = f.endDate ? new Date(`${f.endDate}T00:00:00`) : start;
    const days = this.buildItineraryDays(f);
    const dayCount = days.length;
    const description = f.eventType ? `${f.description}\n\nEvent type: ${f.eventType}` : f.description;

    const partialJoinAllowed = f.joinOption !== 'full';
    const fullJoinAllowed = f.joinOption !== 'partial';
    // Clamp the host's requested range to the trip's actual length — a range
    // configured before the dates were final could otherwise exceed it.
    const minConsecutiveDays = partialJoinAllowed
      ? Math.max(1, Math.min(f.joinRange?.min ?? 1, dayCount || 1))
      : undefined;
    const maxConsecutiveDays = partialJoinAllowed
      ? Math.max(minConsecutiveDays ?? 1, Math.min(f.joinRange?.max ?? dayCount, dayCount || 1))
      : undefined;

    return {
      id,
      title: f.title,
      subtitle: `${f.eventType || 'Community'} in ${f.destination}`,
      location: f.destination,
      time: '',
      duration: this.tripDurationLabel(f),
      price: f.budget || 'Free',
      travelersGoing: 1,
      travelersMax: f.participantLimit ?? undefined,
      month: start.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
      day: start.getDate().toString().padStart(2, '0'),
      dateRangeLabel: `${dateLabel(start)} - ${dateLabel(end)}`,
      nights: Math.max(0, dayCount - 1),
      partialJoinAllowed,
      fullJoinAllowed,
      minConsecutiveDays,
      maxConsecutiveDays,
      tag: 'Meetup',
      joined: false,
      followed: false,
      imageUrl: FALLBACK_IMAGE,
      // Real logged-in customer id (matches CommunityEvent.organizer.id from
      // the backend) so the "My Hosted" tab keeps matching this event after
      // a refresh reloads it from GET /community/meetups instead of memory.
      hostId: this.auth.user()?.id ?? CURRENT_USER_ID,
      hostName: 'You',
      hostRole: '',
      reason: '',
      description,
      groupMax: f.participantLimit ? `${f.participantLimit} max` : '',
      schedule: this.buildScheduleSteps(f),
      locationName: f.destination,
      locationNote: f.participantLimit ? `Max participants: ${f.participantLimit}` : '',
      // Route trail (Start → Via → Destination) — same field seeded multi-city
      // journeys use for their city-chip trail on the card and detail page.
      cities: [f.startLocation, ...f.viaLocations, f.destination].filter(Boolean),
      // Real collected travel styles — takes over the card's theme chips so it
      // never falls back to showing the raw location/budget as pseudo-tags.
      interestTags: f.travelStyle,
      days: dayCount ? days : undefined,
      startDateIso: f.startDate,
      endDateIso: f.endDate,
      hostPreferences: {
        eventType: f.eventType,
        startLocation: f.startLocation || undefined,
        viaLocations: f.viaLocations,
        travelStyle: f.travelStyle,
        participantLimit: f.participantLimit,
        budget: f.budget,
        activities: f.activities,
        accommodation: f.accommodation,
        transportation: f.transportation,
        joinOption: f.joinOption as EventJoinOption,
        joinRange: f.joinRange
      }
    };
  }

  /** Builds a day-by-day itinerary that reuses the SAME flight/hotel/bus/train
   * cards a real trip's itinerary shows (see ItineraryTimelineComponent) —
   * not generic activity cards with a descriptive title. Day 1 gets the
   * arrival transit leg (+ an airport-shuttle bus leg when arriving by
   * flight) and the hotel stay; the last day (if the trip is more than one
   * day) gets only the departure transit leg, mirroring how a real itinerary
   * has no new activities planned on the travel-home day. Everything in
   * between gets one activity from the collected pool per day. Flight/hotel/
   * bus/train items are always non-editable (see ItineraryTimelineComponent.
   * isLocked) — that's what actually enforces "reservations can't be
   * changed", not the title text. */
  private buildItineraryDays(f: EventHostForm): JourneyDay[] {
    if (!f.startDate || !f.endDate) return [];
    const start = new Date(`${f.startDate}T00:00:00`);
    const end = new Date(`${f.endDate}T00:00:00`);
    const dayCount = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    const pool = f.activities.length ? f.activities : ['Free time to explore'];
    const mode = transportModeLabel(f.transportation);

    // Cost Breakdown allocation is resolved ONCE, up front, from the total
    // budget + the itinerary's real composition (or the host's own explicit
    // per-category costs) — every item below is priced from this, never
    // from a hardcoded literal. See event-cost-allocation.util.ts.
    const totalBudget = parseBudgetAmount(f.budget);
    const composition = analyzeItineraryComposition(dayCount, pool.length, mode);
    const allocation = resolveCostAllocation(
      totalBudget,
      {
        accommodation: f.accommodationCost ?? undefined,
        transport: f.transportCost ?? undefined,
        food: f.foodCost ?? undefined,
        activities: f.activityCost ?? undefined,
      },
      f.accommodation,
      composition,
    );

    console.log('FORM COSTS', {
      accommodationCost: f.accommodationCost,
      transportCost: f.transportCost,
      foodCost: f.foodCost,
      activityCost: f.activityCost
    });
    console.log('ALLOCATION', allocation);

    const rates = perUnitRates(allocation, composition);

    // No activities are planned on a pure departure day — matches a real itinerary.
    const activityDayCount = dayCount > 1 ? dayCount - 1 : 1;
    let idSeq = 0;
    const nextId = () => `evt-item-${++idSeq}`;

    const days: JourneyDay[] = [];
    for (let dayNum = 1; dayNum <= dayCount; dayNum++) {
      const date = new Date(start);
      date.setDate(start.getDate() + (dayNum - 1));
      const isDepartureOnlyDay = dayCount > 1 && dayNum === dayCount;
      const items: JourneyActivity[] = [];

      if (dayNum === 1) {
        items.push(this.buildTransitLeg(f, nextId(), mode, 'arrival', date, rates.perMainLeg));
        if (mode === 'Flight') {
          items.push(this.buildAirportShuttle(f, nextId(), 'arrival', date, rates.perShuttle));
        }
        items.push(this.buildHotelStay(f, nextId(), start, end, rates.accommodationTotal));
      }

      if (!isDepartureOnlyDay) {
        const titles =
          activityDayCount >= pool.length
            ? [pool[(dayNum - 1) % pool.length]]
            : pool.slice(
                Math.floor(((dayNum - 1) * pool.length) / activityDayCount),
                Math.floor((dayNum * pool.length) / activityDayCount),
              );
        for (const [i, title] of (titles.length ? titles : [pool[0]]).entries()) {
          items.push({
            id: nextId(),
            title: title.replace(/\b\w/g, (c) => c.toUpperCase()),
            time: EVENT_ACTIVITY_TIMES[i % EVENT_ACTIVITY_TIMES.length],
            category: 'Planned Activity',
            duration: '',
            rating: 4.5,
            image: unsplashUrl(EVENT_ACTIVITY_IMAGE_IDS[(dayNum + i) % EVENT_ACTIVITY_IMAGE_IDS.length], 400),
            price: rates.perActivity,
            costCategory: 'activities',
            included: true
          });
          items.push({
            id: nextId(),
            title: 'Buffet Dinner',
            time: '20:00',
            category: 'Food',
            duration: '',
            rating: 4.5,
            image: unsplashUrl(EVENT_ACTIVITY_IMAGE_IDS[0],400),
            price: rates.perMeal,
            costCategory: 'food',
            included: true
          });

        }
      } else {
        // Mirrors the real itinerary page's last-day sequence: check out of
        // the hotel, transfer back to the airport/station, then depart.
        items.push(this.buildHotelCheckout(f, nextId()));
        if (mode === 'Flight') {
          items.push(this.buildAirportShuttle(f, nextId(), 'departure', date, rates.perShuttle));
        }
        items.push(this.buildTransitLeg(f, nextId(), mode, 'departure', date, rates.perMainLeg));
      }

      days.push({
        day: dayNum,
        city: f.destination,
        dateLabel: dateLabel(date),
        // Derived bottom-up from this day's own priced items, not a flat
        // totalBudget/dayCount split — this is what makes a partial-join
        // date range (selectedDaysFor()) or a multi-city day list sum to a
        // correct proportional subtotal automatically, with no extra logic.
        price: items.reduce((sum, a) => sum + (a.price ?? 0), 0),
        activities: items
      });
    }
    return days;
  }

  /** A flight/train/bus card for the arrival or departure leg. Falls back to a
   * plain (unlocked) generic activity when the transportation answer doesn't
   * name a recognized mode (e.g. "self-arranged", "rental car") — there's no
   * real reservation to render a fixed card for in that case. */
  private buildTransitLeg(
    f: EventHostForm,
    id: string,
    mode: 'Flight' | 'Train' | 'Bus' | null,
    direction: 'arrival' | 'departure',
    legDate: Date,
    price: number,
  ): JourneyActivity {
    if (!mode) {
      return {
        id,
        title: direction === 'arrival' ? `Arrival — ${f.transportation}` : `Departure — ${f.transportation}`,
        time: direction === 'arrival' ? '09:00' : '16:00',
        category: 'Transportation',
        duration: '',
        rating: 0,
        image: unsplashUrl(TRANSPORT_IMAGE_ID, 400),
        price,
        costCategory: 'transport',
        included: true
      };
    }
    const from = direction === 'arrival' ? f.startLocation : f.destination;
    const to = direction === 'arrival' ? f.destination : f.startLocation;
    const depTime = direction === 'arrival' ? '09:00' : '14:00';
    const arrTime = direction === 'arrival' ? '11:15' : '16:30';
    const label = dateLabel(legDate);
    const title = mode === 'Flight' ? `Flight to ${to}` : `${mode} to ${to}`;

    if (mode === 'Flight') {
      return {
        id,
        title,
        time: depTime,
        category: 'Transportation',
        duration: '2h 15m',
        rating: 0,
        image: unsplashUrl(TRANSPORT_IMAGE_ID, 400),
        price,
        costCategory: 'transport',
        included: true,
        kind: 'flight',
        carrier: 'TravlAir',
        flightNo: this.fabricateCode('TA', to),
        flightClass: 'Economy',
        refundable: 'Partially Refundable',
        depDate: label,
        depCode: from,
        arrDate: label,
        arrTime,
        arrCode: to,
        stops: 'Direct',
        // Nothing has actually been booked against a real airline yet.
        status: 'Pending'
      };
    }
    return {
      id,
      title,
      time: depTime,
      category: 'Transportation',
      duration: '2h 15m',
      rating: 0,
      image: unsplashUrl(TRANSPORT_IMAGE_ID, 400),
      price,
      costCategory: 'transport',
      included: true,
      kind: mode === 'Train' ? 'train' : 'bus',
      carrier: mode === 'Train' ? 'InterCity Rail' : 'RoadLink Express',
      route: `${from} → ${to}`,
      depDate: label,
      depLocation: from,
      arrDate: label,
      arrTime,
      arrLocation: to,
      stops: 'Direct'
    };
  }

  /** After landing, a flight doesn't drop travelers at the door — an airport
   * shuttle bus leg to/from the hotel is added only around flight legs
   * (train/bus arrivals already end at an in-town station/stop, and a car/
   * self-arranged traveler supplies their own ground transport). */
  private buildAirportShuttle(
    f: EventHostForm,
    id: string,
    direction: 'arrival' | 'departure',
    legDate: Date,
    price: number,
  ): JourneyActivity {
    const label = dateLabel(legDate);
    const airport = `${f.destination} Airport`;
    const downtown = `Downtown ${f.destination}`;
    const from = direction === 'arrival' ? airport : downtown;
    const to = direction === 'arrival' ? downtown : airport;
    const depTime = direction === 'arrival' ? '11:45' : '10:30';
    const arrTime = direction === 'arrival' ? '12:45' : '11:30';
    return {
      id,
      title: 'Airport Express Shuttle',
      time: depTime,
      category: 'Transportation',
      duration: '1h 00m',
      rating: 0,
      image: unsplashUrl(TRANSPORT_IMAGE_ID, 400),
      price,
      costCategory: 'transport',
      included: true,
      kind: 'bus',
      carrier: 'Airport Express',
      route: `${from} → ${to}`,
      depDate: label,
      depLocation: from,
      arrDate: label,
      arrTime,
      arrLocation: to,
      stops: 'Direct'
    };
  }

  /** Locked checkout marker on the last day — the hotel stay itself is the
   * single spanning card built by buildHotelStay() on day 1; this just marks
   * the checkout milestone in the day's sequence (matches
   * ItineraryTimelineComponent's "Hotel Check-out" lock pattern). */
  private buildHotelCheckout(f: EventHostForm, id: string): JourneyActivity {
    return {
      id,
      title: `Hotel Check-out: ${f.accommodation}`,
      time: '10:00',
      category: 'Check-out',
      duration: '',
      rating: 0,
      image: unsplashUrl(HOTEL_IMAGE_ID, 400),
      price: null,
      included: true
    };
  }

  /** One hotel card spanning the whole stay (rather than separate check-in/
   * check-out fragments) — matches how a real itinerary shows a single
   * reserved-stay card with its full date range. */
  private buildHotelStay(f: EventHostForm, id: string, start: Date, end: Date, price: number): JourneyActivity {
    return {
      id,
      title: f.accommodation,
      time: '14:00',
      category: 'Accommodation',
      duration: '',
      rating: 4.2,
      image: unsplashUrl(HOTEL_IMAGE_ID, 400),
      price,
      costCategory: 'accommodation',
      included: true,
      kind: 'hotel',
      amenities: ['Free WiFi', 'Breakfast', 'Airport Shuttle'],
      hotelDates: `${dateLabel(start)} – ${dateLabel(end)}`,
      cancellation: 'Free cancellation until 48h'
    };
  }

  /** Deterministic pseudo flight/train number so re-rendering the same event
   * doesn't produce a different number each time. */
  private fabricateCode(prefix: string, seed: string): string {
    let hash = 0;
    for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return `${prefix}${100 + (hash % 900)}`;
  }

  private buildScheduleSteps(f: EventHostForm): EventScheduleStep[] {
    const route = [f.startLocation, ...f.viaLocations, f.destination].filter(Boolean).join(' → ');
    const steps: EventScheduleStep[] = [
      { time: '', text: `Route: ${route}` },
      { time: '', text: `Arrival in ${f.destination} — transportation: ${f.transportation}` }
    ];
    if (f.accommodation) {
      steps.push({ time: '', text: `Accommodation: ${f.accommodation}` });
    }
    steps.push({ time: '', text: `Departure from ${f.destination}` });
    return steps;
  }

  private tripDurationLabel(f: EventHostForm): string {
    if (!f.startDate || !f.endDate) return '';
    const start = new Date(`${f.startDate}T00:00:00`);
    const end = new Date(`${f.endDate}T00:00:00`);
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    return days === 1 ? '1 day' : `${days} days`;
  }

  private pushAssistant(text: string): void {
    this.chat.messages.update((m) => [...m, { role: 'assistant', text, intent: 'event_host' }]);
    this.chat.requestScroll();
  }

  private pushUser(text: string): void {
    this.chat.messages.update((m) => [...m, { role: 'user', text }]);
  }
}
