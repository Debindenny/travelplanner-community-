import { CommunityEvent } from './community-events.service';
import { mockCustomerId } from '../circles-trips/core/data/community-mock-users';
import type { TripSegment } from '../../trip/trip.service';

/**
 * View model consumed by the Community Events templates (list, detail, host
 * wizard, add-to-trip modal, attendees modal) and the mapper that builds it
 * from the real `/community/meetups` API response (CommunityEvent).
 *
 * The backend meetup schema (services/planner/app/routers/community_meetups.py)
 * only carries title/description/location/image_url/starts_at/ends_at plus an
 * organizer and attendee_count — it has no concept of price, category, group
 * capacity, an agenda ("the plan"), or meeting-point notes. Those fields are
 * kept on this view model so the templates don't have to change, but for
 * real (API-backed) events they come through empty/defaulted rather than
 * fabricated — see toEventCard() below for exactly what's mapped vs. defaulted.
 */

export type EventTag = 'Meetup' | 'Food' | 'Online';

export interface EventScheduleStep {
  time: string;
  text: string;
}

export interface CommunityEventCard {
  id: string;
  title: string;
  location: string;
  time: string;
  /** Human-readable length, e.g. "2h 30m". Empty when `ends_at` isn't set. */
  duration: string;
  price: string;
  travelersGoing: number;
  month: string;
  day: string;
  tag: EventTag;
  joined: boolean;
  followed: boolean;
  imageUrl: string;
  hostId: string;
  hostName: string;
  hostRole: string;
  /** Short personalization line shown between the banner and the price row. Not backed by the API — empty for real events. */
  reason: string;
  description: string;
  groupMax: string;
  schedule: EventScheduleStep[];
  locationName: string;
  locationNote: string;
  /** Multi-city route for a hosted journey, e.g. ['Paris', 'Barcelona', 'Madrid']. Falls back to `location` when absent. */
  cities?: string[];
  /** Pre-formatted trip window, e.g. "03 - 12 JUN". Falls back to `month`/`day` when absent. */
  dateRangeLabel?: string;
  /** Number of nights the journey runs, shown next to `dateRangeLabel`. */
  nights?: number;
  /** Whether travelers can join part of the journey rather than the whole thing. */
  partialJoinAllowed?: boolean;
  /** Whether travelers can join the entire journey end-to-end. Defaults to true
   * (every existing event allows it) — set false only for a host who configured
   * "Partial journey only", which also disables the Full Journey button. */
  fullJoinAllowed?: boolean;
  /** Host's avatar photo. Falls back to initials when absent. */
  hostAvatarUrl?: string;
  /** Total traveler capacity, shown as "{travelersGoing} / {travelersMax} Travelers". */
  travelersMax?: number;
  /** Interest/theme chips shown on the card, e.g. ['Culture', 'Food', 'Adventure']. */
  interestTags?: string[];
  /** Descriptive subheading on the detail page, e.g. "Paris, Barcelona And Madrid Theme Journey". */
  subtitle?: string;
  /** Average review rating out of 5, shown on the detail page. */
  rating?: number;
  /** Number of reviews backing `rating`. */
  reviewCount?: number;
  /** Avatar photos of a few travelers who joined, shown as an overlapping stack. */
  travelerAvatars?: string[];
  /** Day-by-day breakdown for a hosted journey, priced individually so travelers can join part of the trip. */
  days?: JourneyDay[];
  /** Id of the real backend Trip this event's itinerary was published into
   * (via TripService.createFromContent) — when set, viewing/editing the
   * itinerary happens on the real /itinerary/:id page, not a separate UI. */
  tripId?: string;
  /** Fixed cost added on top of the selected days' subtotal — guiding, transfers, group logistics. */
  baseFee?: number;
  /** Fewest consecutive days a partial-join traveler must book. Defaults to 2 when `days` is set. */
  minConsecutiveDays?: number;
  /** Most consecutive days a partial-join traveler may book. Defaults to the full trip length when unset. */
  maxConsecutiveDays?: number;
}

export interface JourneyDay {
  /** Backend row id (event_itinerary_days.id) — undefined for an event with no DB-backed itinerary yet. */
  id?: string;
  day: number;
  city: string;
  dateLabel: string;
  price: number;
  activities: JourneyActivity[];
}

export interface JourneyActivity {
  /** Backend row id (event_itinerary_activities.id) — required for booking/selection/change calls. */
  id?: string;
  title: string;
  time: string;
  /** Short line shown under the title, e.g. "Guided Tour · 2 hrs". */
  category: string;
  duration: string;
  rating: number;
  image: string;
  /** null means free / no booking needed — the card shows "Free" + "Options" instead of a price + "Book". */
  price: number | null;
  /** Whether this activity is part of the traveler's plan by default — optional extras can be unchecked. */
  included: boolean;
  /** Max bookings the host allows — null/undefined means uncapped. Populated from the backend. */
  capacity?: number | null;
  /** How many travelers currently hold a booking on this activity. */
  bookedCount?: number;
  /** Whether the current traveler has an active booking on this activity. */
  booked?: boolean;

  /** Which itinerary-timeline card this renders as — defaults to the plain
   * activity card when absent. Lets a day's flight/hotel/ground-transport
   * reservations reuse the same rich flight/hotel/bus/train cards (with
   * route diagrams, amenities, etc.) that a real trip's itinerary shows,
   * instead of being flattened into generic activity cards. See
   * CommunityEventDetailViewComponent.detailDays() for the mapping and
   * ItineraryTimelineComponent.isLocked() for why these are non-editable. */
  kind?: 'flight' | 'hotel' | 'bus' | 'train';
  // Flight fields (kind === 'flight'; `title`/`rating`/`image` unused for this kind)
  carrier?: string;
  flightNo?: string;
  flightClass?: string;
  refundable?: string;
  status?: string;
  depDate?: string;
  depCode?: string;
  arrDate?: string;
  arrTime?: string;
  arrCode?: string;
  stops?: string;
  // Hotel fields (kind === 'hotel'; `title` doubles as the hotel name, `rating` as its star rating)
  amenities?: string[];
  hotelDates?: string;
  roomType?: string;
  cancellation?: string;
  // Bus/train fields (kind === 'bus' | 'train'; `title` doubles as the carrier name when `carrier` is unset)
  route?: string;
  depLocation?: string;
  arrLocation?: string;
}

/**
 * Falls back to reading the title when `kind` isn't set explicitly — older/
 * seeded activities (e.g. "Hotel Check-in: Le Marais Boutique Hotel") predate
 * the `kind` field, so without this they'd render as plain activity cards
 * (wrong badge/icon/CTA) instead of the real hotel/flight/bus/train card.
 * Deliberately narrow: a real sightseeing activity that happens to mention
 * "bus" or "train" (a "Bus Tour of the Old Town", a "Scenic Train Ride")
 * must NOT get swept into a transfer card, so these require the specific
 * reservation/transfer wording, not just the mode word alone.
 */
function inferSegmentKind(title: string): 'flight' | 'hotel' | 'bus' | 'train' | undefined {
  const t = title.toLowerCase();
  if (/\bhotel\b/.test(t) && /check-?in|check-?out|\bstay\b/.test(t)) return 'hotel';
  if (/^flight\b/.test(t) || (/\bflight\b/.test(t) && /departure|arrival|check-?in|check-?out/.test(t))) return 'flight';
  if (/\bairport\b.*\bshuttle\b|\bshuttle\b.*\bairport\b/.test(t)) return 'bus';
  if (/\btrain\b.*\b(transfer|shuttle)\b|\b(transfer|shuttle)\b.*\btrain\b/.test(t)) return 'train';
  if (/\bbus\b.*\b(transfer|shuttle)\b|\b(transfer|shuttle)\b.*\bbus\b/.test(t)) return 'bus';
  return undefined;
}

/**
 * Maps a JourneyActivity onto the shared itinerary timeline's flight/hotel/
 * bus/train/activity shape (TripSegment/DetailItem — the two are the exact
 * same union). Used both to render a hosted event's itinerary locally and to
 * build the payload for TripService.createFromContent(), so a hosted event
 * and the real trip it becomes always agree on what each item looks like.
 */
export function journeyActivityToTripSegment(a: JourneyActivity, day: JourneyDay): TripSegment {
  const kind = a.kind ?? inferSegmentKind(a.title);
  if (kind === 'flight') {
    return {
      id: a.id,
      day: day.day,
      type: 'flight',
      carrier: a.carrier || 'TravlAir',
      flightNo: a.flightNo || '',
      class: a.flightClass || 'Economy',
      refundable: a.refundable || 'Partially Refundable',
      depDate: a.depDate || day.dateLabel,
      depTime: a.time,
      depCode: a.depCode || '',
      arrDate: a.arrDate || day.dateLabel,
      arrTime: a.arrTime || '',
      arrCode: a.arrCode || '',
      duration: a.duration || '',
      stops: a.stops || 'Direct',
      status: a.status || 'Confirmed',
      price: a.price ?? undefined
    };
  }
  if (kind === 'hotel') {
    return {
      id: a.id,
      day: day.day,
      type: 'hotel',
      // Strips a leading "Hotel Check-in:"/"Hotel Check-out:" label off
      // inferred-kind titles so the card shows the property name alone
      // ("Le Marais Boutique Hotel"), not the full milestone phrase.
      name: a.title.replace(/^hotel\s+check-?(in|out)\s*:?\s*|^hotel\s+stay\s*:?\s*/i, '').trim() || a.title,
      rating: a.rating,
      location: day.city,
      dates: a.hotelDates || day.dateLabel,
      amenities: a.amenities || [],
      roomType: a.roomType,
      cancellation: a.cancellation,
      imageUrl: a.image,
      price: a.price ?? undefined
    };
  }
  if (kind === 'bus' || kind === 'train') {
    const base = {
      id: a.id,
      day: day.day,
      carrier: a.carrier || a.title,
      route: a.route || '',
      depDate: a.depDate || day.dateLabel,
      depTime: a.time,
      depLocation: a.depLocation || '',
      arrDate: a.arrDate || day.dateLabel,
      arrTime: a.arrTime || '',
      arrLocation: a.arrLocation || '',
      duration: a.duration || '',
      stops: a.stops || 'Direct',
      price: a.price ?? undefined
    };
    return kind === 'bus' ? { ...base, type: 'bus' } : { ...base, type: 'train' };
  }
  return {
    id: a.id,
    day: day.day,
    type: 'activity',
    time: a.time,
    title: a.title,
    rating: a.rating,
    location: day.city,
    // Host-described, not real bookable inventory — same known phrase the
    // itinerary UI already uses for AI-suggested activities (see
    // itinerary-i18n.util.ts's ITINERARY.DAY.AVAILABILITY_UNCONFIRMED).
    refundable: 'Availability not confirmed — verify before booking',
    image: a.image,
    price: a.price ?? undefined,
    duration: a.duration || undefined
  };
}

/** A traveler's personal "Add Transport" addition to the itinerary timeline — see EventItineraryService. */
export interface TransportSegment {
  id: string;
  afterDay: number;
  mode: string;
  title: string;
  time?: string | null;
  notes?: string | null;
  price?: number | null;
}

/** Mirrors the source design's unsplashUrl() helper — same crop/format params. */
export function unsplashUrl(photoId: string, width = 800): string {
  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=${width}&q=80`;
}

const FALLBACK_IMAGE = unsplashUrl('1488646953014-85cb44e25828');

function formatDuration(start: Date, end: Date | null): string {
  if (!end) return '';
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  if (minutes <= 0) return '';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
}

/**
 * The meetup schema has one free-text `description` field and one plain
 * `location` string — no columns for an agenda, a "what to bring" note, or a
 * meeting point distinct from the general destination. To round-trip those
 * Host Wizard fields without a backend/schema change, the wizard appends
 * them to the description behind these markers, and this splits them back
 * out for display. An event with none of these markers (e.g. one seeded
 * directly, or created before this existed) just renders as a plain
 * description with all three sections hidden, exactly as before.
 */
export const PLAN_MARKER = '\n\nTHE PLAN:\n';
export const BRING_MARKER = '\n\nWHAT TO BRING:\n';
export const MEETING_MARKER = '\n\nMEETING POINT:\n';

function splitDescription(raw: string): {
  description: string;
  schedule: EventScheduleStep[];
  locationNote: string;
  meetingPoint: string;
} {
  const markers = (
    [
      { idx: raw.indexOf(PLAN_MARKER), marker: PLAN_MARKER, kind: 'plan' as const },
      { idx: raw.indexOf(BRING_MARKER), marker: BRING_MARKER, kind: 'bring' as const },
      { idx: raw.indexOf(MEETING_MARKER), marker: MEETING_MARKER, kind: 'meeting' as const }
    ].filter((m) => m.idx !== -1)
  ).sort((a, b) => a.idx - b.idx);

  if (!markers.length) {
    return { description: raw, schedule: [], locationNote: '', meetingPoint: '' };
  }

  let schedule: EventScheduleStep[] = [];
  let locationNote = '';
  let meetingPoint = '';

  markers.forEach((m, i) => {
    const contentStart = m.idx + m.marker.length;
    const contentEnd = i + 1 < markers.length ? markers[i + 1].idx : raw.length;
    const content = raw.slice(contentStart, contentEnd).trim();
    if (m.kind === 'plan') {
      schedule = content
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((text) => ({ time: '', text }));
    } else if (m.kind === 'bring') {
      locationNote = content;
    } else {
      meetingPoint = content;
    }
  });

  return { description: raw.slice(0, markers[0].idx).trim(), schedule, locationNote, meetingPoint };
}

/**
 * Maps a real `/community/meetups` API record onto the view model.
 *
 * Mapped from real data: id, title, location (the destination only — see
 * below), time/month/day (from starts_at), duration (starts_at/ends_at),
 * travelersGoing (attendee_count), joined (rsvp_status === 'going'),
 * imageUrl, hostName, description/schedule/locationNote/locationName (the
 * latter three round-tripped through the description via splitDescription
 * — see its comment).
 *
 * `location` holds just the destination (city/country) the host entered —
 * the specific meeting point is a separate wizard field folded into the
 * description via MEETING_MARKER, so the card/detail-page location line
 * doesn't show both concatenated. `locationName` (the "Meeting point" card)
 * uses the parsed meeting point when present, falling back to the
 * destination so that section still shows something for events that gave a
 * location but no specific meeting point.
 *
 * Defaulted — no backing field on the meetup schema: price ('Free' — the
 * platform has no paid-meetup concept yet), tag (inferred: 'Online' when no
 * location, else 'Meetup'), followed (refined separately via
 * CommunityProfileService against the organizer id), hostRole, reason,
 * groupMax. Templates already render these conditionally (or degrade
 * gracefully) when empty.
 */
export function toEventCard(ev: CommunityEvent): CommunityEventCard {
  const start = new Date(ev.starts_at);
  const end = ev.ends_at ? new Date(ev.ends_at) : null;
  const location = ev.location?.trim() || '';
  const { description, schedule, locationNote, meetingPoint } = splitDescription(ev.description || '');

  return {
    id: ev.id,
    title: ev.title,
    location: location || 'Online',
    time: start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    duration: formatDuration(start, end),
    price: 'Free',
    travelersGoing: ev.attendee_count,
    month: start.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: start.getDate().toString().padStart(2, '0'),
    tag: location ? 'Meetup' : 'Online',
    joined: ev.rsvp_status === 'going',
    followed: false,
    imageUrl: ev.image_url || FALLBACK_IMAGE,
    hostId: ev.organizer.id,
    hostName: ev.organizer.name,
    hostRole: '',
    reason: '',
    description,
    groupMax: '',
    schedule,
    locationName: meetingPoint || location,
    locationNote
  };
}

/** The city travelers are shown as visiting — the last comma-separated part of the event location. */
export function eventDestination(ev: CommunityEventCard): string {
  const parts = ev.location.split(',');
  return parts[parts.length - 1].trim();
}

export interface EventAttendee {
  name: string;
  customer_id: string;
  country: string;
  dateRangeLabel: string;
  following: boolean;
}

/**
 * PLACEHOLDER — the meetups API exposes only an attendee *count*
 * (`attendee_count`), not the identities of who RSVP'd; there is no
 * `/community/meetups/{id}/attendees` endpoint to list them. Until that
 * endpoint exists, the "Who is going" modal shows this deterministic,
 * clearly-synthetic roster sized to the REAL attendee count, so the total
 * lines up with the API even though the individual names are placeholders.
 * Do not treat the names/countries/dates here as real user data.
 */
const ATTENDEE_POOL: { name: string; country: string }[] = [
  { name: 'Priya Nair', country: 'India' },
  { name: 'Aarav Menon', country: 'India' },
  { name: 'Lea Fontaine', country: 'Canada' },
  { name: 'Marco Villa', country: 'Italy' },
  { name: 'Emma Ross', country: 'UK' },
  { name: 'Sofia Marchetti', country: 'Italy' },
  { name: 'Noah Fischer', country: 'Germany' },
  { name: 'Ava Novak', country: 'Czechia' },
  { name: 'Liam Chen', country: 'Singapore' },
  { name: 'Mia Torres', country: 'Spain' },
  { name: 'Ethan Baptiste', country: 'France' },
  { name: 'Zoe Larsson', country: 'Sweden' },
  { name: 'Lucas Moreau', country: 'France' },
  { name: 'Ines Costa', country: 'Portugal' },
  { name: 'Omar Haddad', country: 'Egypt' },
  { name: 'Freya Lindqvist', country: 'Norway' },
  { name: 'Diego Alvez', country: 'Brazil' },
  { name: 'Hana Suzuki', country: 'Japan' },
  { name: 'Marcus Webb', country: 'USA' },
  { name: 'Tobias Reinholt', country: 'Denmark' }
];

const MONTH_NAMES: Record<string, string> = {
  JAN: 'Jan', FEB: 'Feb', MAR: 'Mar', APR: 'Apr', MAY: 'May', JUN: 'Jun',
  JUL: 'Jul', AUG: 'Aug', SEP: 'Sep', OCT: 'Oct', NOV: 'Nov', DEC: 'Dec'
};

/** See the PLACEHOLDER note above — count is real, roster is not. */
export function attendeesFor(ev: CommunityEventCard): EventAttendee[] {
  const offset = (Number(ev.id.split('-').pop()?.replace(/\D/g, '')) || 1) - 1;
  const count = Math.min(ev.travelersGoing, ATTENDEE_POOL.length);
  const monthName = MONTH_NAMES[ev.month] ?? ev.month;
  const eventDay = Number(ev.day) || 1;

  return Array.from({ length: count }, (_, i) => {
    const person = ATTENDEE_POOL[(i + offset) % ATTENDEE_POOL.length];
    const startOffset = ((i * 2) % 5) - 4;
    const duration = 5 + (i % 2);
    const startDay = Math.max(1, eventDay + startOffset);
    const endDay = startDay + duration;
    return {
      name: person.name,
      customer_id: mockCustomerId(person.name),
      country: person.country,
      dateRangeLabel: `${monthName} ${startDay} – ${endDay}`,
      following: true
    };
  });
}
