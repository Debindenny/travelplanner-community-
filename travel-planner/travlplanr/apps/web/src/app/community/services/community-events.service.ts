import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../../shared/utils/api-url';

/* ── Types ────────────────────────────────────────────── */
// These mirror the backend meetups API at /community/meetups (see
// services/planner/app/routers/community_meetups.py). This intentionally
// does NOT touch /community/events, which is a separate analytics-tracking
// endpoint owned by community-analytics.service.ts.

export interface CommunityEventOrganizer {
  id: string;
  name: string;
  avatar: string | null;
}

export interface CommunityEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  image_url: string | null;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  organizer: CommunityEventOrganizer;
  attendee_count: number;
  rsvp_status: 'going' | 'interested' | 'declined' | null;
}

export interface CreateEventPayload {
  title: string;
  description?: string;
  location?: string;
  image_url?: string;
  starts_at: string;
  ends_at?: string;
}

export interface RsvpResponse {
  status: string;
  rsvp_status: 'going' | 'interested' | 'declined' | null;
}

/* ── Service ──────────────────────────────────────────── */

@Injectable({ providedIn: 'root' })
export class CommunityEventsService {
  private readonly http = inject(HttpClient);

  /** List upcoming meetups. */
  getEvents(limit = 20, offset = 0): Observable<{ meetups: CommunityEvent[]; has_more: boolean }> {
    return this.http.get<{ meetups: CommunityEvent[]; has_more: boolean }>(
      apiUrl(`/community/meetups?limit=${limit}&offset=${offset}`)
    );
  }

  /** Get single meetup. */
  getEvent(id: string): Observable<CommunityEvent> {
    return this.http.get<CommunityEvent>(apiUrl(`/community/meetups/${id}`));
  }

  /** Create meetup. */
  createEvent(payload: CreateEventPayload): Observable<CommunityEvent> {
    return this.http.post<CommunityEvent>(apiUrl('/community/meetups'), payload);
  }

  /** Set (or, if repeated, remove) the caller's RSVP status. */
  setRsvp(eventId: string, status: 'going' | 'interested' | 'declined'): Observable<RsvpResponse> {
    return this.http.post<RsvpResponse>(apiUrl(`/community/meetups/${eventId}/rsvp`), { status });
  }

  /** Meetups the caller created or RSVP'd to. */
  getMyEvents(): Observable<CommunityEvent[]> {
    return this.http.get<CommunityEvent[]>(apiUrl('/community/meetups/mine'));
  }
}
