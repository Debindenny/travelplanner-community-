import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { apiUrl } from '../../shared/utils/api-url';

/* ── Types ────────────────────────────────────────────── */
// Mirrors the real backend (services/planner/app/routers/community_meetups.py).
// The backend serializes id/title/description/location/cost/capacity/schedule/
// what_to_bring/image_url/starts_at/ends_at/created_at/organizer/attendee_count/
// rsvp_status. There is no location_note/badge/spaces_left/conflict model yet, so
// fromWire() forwards those fields when present but they stay undefined until the
// backend starts sending them.

export interface CommunityEventOrganizer {
  id: string;
  name: string;
  avatar: string | null;
  role?: string;
  verified?: boolean;
  hostStat?: string;
}

export interface CommunityEventScheduleItem {
  time: string;
  text: string;
}

/** Surfaced when this meetup overlaps with something already on the caller's itinerary. */
export interface CommunityEventConflict {
  tripName: string;
  dayLabel: string;
  summary: string;
  conflictingActivity?: string;
  conflictingTime?: string;
}

export interface CommunityEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  location_note?: string | null;
  image_url: string | null;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  organizer: CommunityEventOrganizer;
  attendee_count: number;
  rsvp_status: 'going' | 'interested' | 'declined' | null;
  badge?: 'Meetup' | 'Food' | 'Online';
  category?: 'meetup' | 'food' | 'online';
  cost?: string | null;
  capacity?: number | null;
  group_max?: string;
  spaces_left?: number;
  schedule?: CommunityEventScheduleItem[];
  what_to_bring?: string;
  meeting_link?: string | null;
  conflict?: CommunityEventConflict;
}

export interface CreateEventPayload {
  title: string;
  description?: string;
  location?: string;
  image_url?: string;
  cost?: string;
  capacity?: number;
  schedule?: CommunityEventScheduleItem[];
  what_to_bring?: string;
  category?: 'meetup' | 'food' | 'online';
  meeting_link?: string;
  starts_at: string;
  ends_at?: string;
}

export interface RsvpResponse {
  status: string;
  rsvp_status: 'going' | 'interested' | 'declined' | null;
}

/** Prefer the explicit category; fall back to a location-based guess when one isn't set. */
export function isEventOnline(event: Pick<CommunityEvent, 'location' | 'badge' | 'category'>): boolean {
  if (event.category) return event.category === 'online';
  if (event.badge) return event.badge === 'Online';
  return !event.location || /\b(online|virtual|zoom)\b/i.test(event.location);
}

const CATEGORY_BADGE: Record<string, 'Meetup' | 'Food' | 'Online'> = {
  meetup: 'Meetup',
  food: 'Food',
  online: 'Online',
};

/* ── Wire <-> model mapping ───────────────────────────── */

function fromWire(m: any): CommunityEvent {
  return {
    id: m.id,
    title: m.title,
    description: m.description ?? null,
    location: m.location ?? null,
    location_note: m.location_note ?? undefined,
    cost: m.cost ?? null,
    capacity: m.capacity ?? null,
    image_url: m.image_url ?? null,
    starts_at: m.starts_at,
    ends_at: m.ends_at ?? null,
    created_at: m.created_at,
    organizer: {
      id: m.organizer?.id ?? '',
      name: m.organizer?.name ?? 'Traveler',
      avatar: m.organizer?.avatar ?? null,
      role: m.organizer?.role ?? undefined,
      verified: m.organizer?.verified ?? undefined,
      hostStat: m.organizer?.hostStat ?? undefined,
    },
    attendee_count: m.attendee_count ?? 0,
    rsvp_status: m.rsvp_status ?? null,
    badge: (m.category ? CATEGORY_BADGE[m.category] : undefined) ?? m.badge ?? undefined,
    category: m.category ?? undefined,
    group_max: m.group_max ?? undefined,
    spaces_left: m.spaces_left ?? undefined,
    schedule: m.schedule ?? undefined,
    what_to_bring: m.what_to_bring ?? undefined,
    meeting_link: m.meeting_link ?? undefined,
    conflict: m.conflict ?? undefined,
  };
}

function toWire(payload: CreateEventPayload): any {
  return {
    title: payload.title,
    description: payload.description ?? null,
    location: payload.location ?? null,
    cost: payload.cost ?? null,
    capacity: payload.capacity ?? null,
    schedule: payload.schedule ?? null,
    what_to_bring: payload.what_to_bring ?? null,
    category: payload.category ?? null,
    meeting_link: payload.meeting_link ?? null,
    image_url: payload.image_url ?? null,
    starts_at: payload.starts_at,
    ends_at: payload.ends_at ?? null,
  };
}

/* ── Service ──────────────────────────────────────────── */

@Injectable({ providedIn: 'root' })
export class CommunityEventsService {
  private readonly http = inject(HttpClient);

  /** List upcoming meetups. */
  getEvents(limit = 20, offset = 0): Observable<{ meetups: CommunityEvent[]; has_more: boolean }> {
    return this.http
      .get<any>(apiUrl(`/community/meetups?limit=${limit}&offset=${offset}`))
      .pipe(map((res) => ({ meetups: (res.meetups ?? []).map(fromWire), has_more: !!res.has_more })));
  }

  /** Get single meetup. */
  getEvent(id: string): Observable<CommunityEvent> {
    return this.http.get<any>(apiUrl(`/community/meetups/${id}`)).pipe(map(fromWire));
  }

  /** Create meetup. */
  createEvent(payload: CreateEventPayload): Observable<CommunityEvent> {
    return this.http.post<any>(apiUrl('/community/meetups'), toWire(payload)).pipe(map(fromWire));
  }

  /** Set (or, if repeated, remove) the caller's RSVP status. */
  setRsvp(eventId: string, status: 'going' | 'interested' | 'declined'): Observable<RsvpResponse> {
    return this.http.post<RsvpResponse>(apiUrl(`/community/meetups/${eventId}/rsvp`), { status });
  }

  /** Meetups the caller created or RSVP'd to. */
  getMyEvents(): Observable<CommunityEvent[]> {
    return this.http.get<any[]>(apiUrl('/community/meetups/mine')).pipe(map((list) => list.map(fromWire)));
  }
}
