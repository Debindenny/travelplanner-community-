import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { apiUrl } from '../../shared/utils/api-url';
import { CommunityPost } from './community-post.service';

/* ── Types ────────────────────────────────────────────── */
// Mirrors the backend destination catalog at /destinations (see
// services/planner/app/routers/destinations.py, Destination.to_dict()) and
// the generic saved-items toggle at /community/saved (see
// services/planner/app/routers/community_saved.py).

export interface CommunityDestinationSummary {
  id: string;
  name: string;
  description: string;
  image: string;
  price: number;
  currency: string;
  region: string;
  tags: string[];
  latitude: number | null;
  longitude: number | null;
  been_there_count: number;
}

export interface CommunityDestinationDetail {
  destination: CommunityDestinationSummary;
  posts: CommunityPost[];
  has_more: boolean;
}

interface SavedItem {
  id: string;
  item_id: string;
  kind: string;
  title: string;
  meta: string;
  image: string | null;
}

export interface ToggleSaveResponse {
  saved: boolean;
}

/* ── Service ──────────────────────────────────────────── */

@Injectable({ providedIn: 'root' })
export class CommunityDestinationService {
  constructor(private http: HttpClient) {}

  /** List destinations from the shared catalog. */
  getDestinations(limit = 24): Observable<CommunityDestinationSummary[]> {
    return this.http.get<CommunityDestinationSummary[]>(apiUrl(`/destinations?limit=${limit}`));
  }

  /** Single destination detail, with its tagged community posts. */
  getDestination(id: string, limit = 20, offset = 0): Observable<CommunityDestinationDetail> {
    return this.http.get<CommunityDestinationDetail>(
      apiUrl(`/destinations/${id}?limit=${limit}&offset=${offset}`)
    );
  }

  /** Destination ids the current user has already saved/joined. */
  getSavedDestinationIds(): Observable<string[]> {
    return this.http.get<{ items: SavedItem[] }>(apiUrl('/community/saved')).pipe(
      map((res) => res.items.filter((item) => item.kind === 'Destination').map((item) => item.item_id))
    );
  }

  /** Toggle save/join for a destination — saves if not saved, un-saves if already saved. */
  toggleSave(destinationId: string): Observable<ToggleSaveResponse> {
    return this.http.post<ToggleSaveResponse>(apiUrl('/community/saved/toggle'), {
      item_type: 'destination',
      item_id: destinationId,
    });
  }
}
