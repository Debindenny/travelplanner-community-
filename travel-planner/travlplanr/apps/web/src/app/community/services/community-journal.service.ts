import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { apiUrl } from '../../shared/utils/api-url';

/* ── Types ────────────────────────────────────────────── */
// NOTE: shapes below mirror the real backend (services/planner/app/routers/community_journals.py).
// The backend Journal model only stores title/content/cover_image/is_public/itinerary_id — there
// is no chapters/destinations/photo-count/like/view model, so those fake fields were removed
// rather than fabricated.

export interface JournalAuthor {
  id: string;
  name: string;
  avatar: string | null;
}

export interface JournalEntry {
  id: string;
  title: string;
  content: string | null;
  coverImage: string | null;
  itineraryId: string | null;
  isPublic: boolean;
  author: JournalAuthor;
  createdAt: string;
  updatedAt: string;
}

export type JournalListItem = JournalEntry;

export interface CreateJournalPayload {
  title: string;
  content?: string;
  coverImage?: string;
  itineraryId?: string;
  isPublic?: boolean;
}

/* ── Wire <-> model mapping ───────────────────────────── */

function fromWire(j: any): JournalEntry {
  return {
    id: j.id,
    title: j.title,
    content: j.content ?? null,
    coverImage: j.cover_image ?? null,
    itineraryId: j.itinerary_id ?? null,
    isPublic: !!j.is_public,
    author: {
      id: j.author?.id ?? '',
      name: j.author?.name ?? 'Traveler',
      avatar: j.author?.avatar ?? null,
    },
    createdAt: j.created_at,
    updatedAt: j.updated_at,
  };
}

function toWire(payload: Partial<CreateJournalPayload>): any {
  const wire: any = {};
  if (payload.title !== undefined) wire.title = payload.title;
  if (payload.content !== undefined) wire.content = payload.content;
  if (payload.coverImage !== undefined) wire.cover_image = payload.coverImage;
  if (payload.itineraryId !== undefined) wire.itinerary_id = payload.itineraryId;
  if (payload.isPublic !== undefined) wire.is_public = payload.isPublic;
  return wire;
}

/* ── Service ──────────────────────────────────────────── */

@Injectable({ providedIn: 'root' })
export class CommunityJournalService {
  private readonly http = inject(HttpClient);

  /** Publicly browsable journals from all users (explore feed). */
  getJournals(limit = 20, offset = 0): Observable<JournalListItem[]> {
    return this.http
      .get<any[]>(apiUrl(`/community/journals/public?limit=${limit}&offset=${offset}`))
      .pipe(map((list) => list.map(fromWire)));
  }

  /** Get a single journal. */
  getJournal(id: string): Observable<JournalEntry> {
    return this.http.get<any>(apiUrl(`/community/journals/${id}`)).pipe(map(fromWire));
  }

  /** Create a new journal. */
  createJournal(payload: CreateJournalPayload): Observable<JournalEntry> {
    return this.http.post<any>(apiUrl('/community/journals'), toWire(payload)).pipe(map(fromWire));
  }

  /** Update a journal. */
  updateJournal(id: string, payload: Partial<CreateJournalPayload>): Observable<JournalEntry> {
    return this.http.patch<any>(apiUrl(`/community/journals/${id}`), toWire(payload)).pipe(map(fromWire));
  }

  /** Delete a journal. */
  deleteJournal(id: string): Observable<{ status: string; message: string }> {
    return this.http.delete<{ status: string; message: string }>(apiUrl(`/community/journals/${id}`));
  }

  /** Get my own journals. */
  getMyJournals(limit = 20, offset = 0): Observable<JournalListItem[]> {
    return this.http
      .get<any[]>(apiUrl(`/community/journals?limit=${limit}&offset=${offset}`))
      .pipe(map((list) => list.map(fromWire)));
  }
}
