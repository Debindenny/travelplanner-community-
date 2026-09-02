import { CommunityEvent } from './community-events.service';
import { mockCustomerId } from '../circles-trips/core/data/community-mock-users';

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
  hostName: string;
  hostRole: string;
  /** Short personalization line shown between the banner and the price row. Not backed by the API — empty for real events. */
  reason: string;
  description: string;
  groupMax: string;
  schedule: EventScheduleStep[];
  locationName: string;
  locationNote: string;
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
