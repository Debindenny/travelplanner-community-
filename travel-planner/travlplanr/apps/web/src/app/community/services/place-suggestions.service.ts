import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../../shared/utils/api-url';

export type SuggestionCategory = 'food' | 'meetup';

export interface PlaceSuggestion {
  name: string;
  address: string | null;
  rating: number | null;
  imageUrl: string | null;
}

/** Destination-aware place suggestions for the Host an Event flow — backed by
 * GET /inventory/place-suggestions (Google Places Text Search, server-side key). */
@Injectable({ providedIn: 'root' })
export class PlaceSuggestionsService {
  private readonly http = inject(HttpClient);

  getSuggestions(location: string, category: SuggestionCategory, limit = 5): Observable<PlaceSuggestion[]> {
    const params = new HttpParams().set('location', location).set('category', category).set('limit', limit);
    return this.http.get<PlaceSuggestion[]>(apiUrl('/inventory/place-suggestions'), { params });
  }
}
