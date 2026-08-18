import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { apiUrl } from '../utils/api-url';
import { dedupeDestinationsByName, DestinationListItem } from '../utils/destination.util';
import { DestinationFilter } from '../data/destinations.data';
import { destinationMatchesFilters } from '../utils/destination-filter.util';

interface PlacesAutocompleteRow {
  place_id?: string;
  name?: string;
  description?: string;
  secondary?: string;
  types?: string[];
  source?: string;
}

interface SearchableDestination {
  item: DestinationListItem;
  nameLower: string;
  tagsLower: string[];
}

export function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeSearchText(value: string): string {
  return stripDiacritics(value.trim().toLowerCase());
}

const RECENT_SEARCHES_KEY = 'travlplanr_recent_destination_searches';
const MAX_RECENT_SEARCHES = 6;

function loadRecentSearches(): DestinationListItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Single lazily-fetched, cached `/destinations` list shared by the hero
 * typeahead and Explore's Magic Search, so navigating between them doesn't
 * trigger a duplicate fetch, and both use the same matching rules. */
@Injectable({ providedIn: 'root' })
export class DestinationSearchService {
  private readonly http = inject(HttpClient);

  private readonly destinations = signal<DestinationListItem[]>([]);
  private readonly loading = signal(false);
  private readonly errorSignal = signal(false);
  readonly error = this.errorSignal.asReadonly();
  private requested = false;
  private readonly remoteCache = new Map<string, DestinationListItem[]>();

  private readonly recentSearchesSignal = signal<DestinationListItem[]>(loadRecentSearches());
  readonly recentSearches = this.recentSearchesSignal.asReadonly();

  /** Records a picked destination as a recent search, most-recent first,
   * deduped by name and capped at MAX_RECENT_SEARCHES. */
  recordRecentSearch(item: DestinationListItem): void {
    const key = normalizeSearchText(item.name);
    const next = [item, ...this.recentSearchesSignal().filter((r) => normalizeSearchText(r.name) !== key)].slice(
      0,
      MAX_RECENT_SEARCHES,
    );
    this.recentSearchesSignal.set(next);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      } catch {
        /* localStorage unavailable (private mode, quota) — recent searches stay in-memory only */
      }
    }
  }

  clearRecentSearches(): void {
    this.recentSearchesSignal.set([]);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(RECENT_SEARCHES_KEY);
      } catch {
        /* ignore */
      }
    }
  }

  private readonly searchable = computed<SearchableDestination[]>(() =>
    this.destinations().map((item) => ({
      item,
      nameLower: normalizeSearchText(item.name),
      tagsLower: (item.tags ?? []).map((tag) => normalizeSearchText(tag)),
    })),
  );

  readonly all = this.destinations.asReadonly();
  readonly isLoading = this.loading.asReadonly();

  /** Fetches the destination list once; safe to call from multiple
   * components. Retries once with backoff on failure. */
  load(): void {
    if (this.requested) return;
    this.requested = true;
    this.fetch(1);
  }

  private fetch(attemptsLeft: number): void {
    this.loading.set(true);
    this.errorSignal.set(false);
    this.http.get<DestinationListItem[]>(apiUrl('/destinations')).subscribe({
      next: (rows) => {
        this.loading.set(false);
        this.destinations.set(dedupeDestinationsByName(rows ?? []));
      },
      error: () => {
        if (attemptsLeft > 0) {
          setTimeout(() => this.fetch(attemptsLeft - 1), 1500);
          return;
        }
        this.loading.set(false);
        this.errorSignal.set(true);
        this.requested = false;
      },
    });
  }

  /** Prefix matches first, then substring matches, excluding an exact match
   * of the query itself. Diacritic-insensitive. */
  match(query: string, limit = 6): DestinationListItem[] {
    const q = normalizeSearchText(query);
    if (!q) return [];
    const starts: DestinationListItem[] = [];
    const contains: DestinationListItem[] = [];
    for (const { item, nameLower } of this.searchable()) {
      if (nameLower === q) continue;
      if (nameLower.startsWith(q)) starts.push(item);
      else if (nameLower.includes(q)) contains.push(item);
    }
    return [...starts, ...contains].slice(0, limit);
  }

  /** Prefix matches first, then substring matches, excluding an exact match
   * of the query itself. Diacritic-insensitive. */
  matchNames(query: string, limit = 6): string[] {
    return this.match(query, limit).map((item) => item.name);
  }

  /** Local match first; then catalog search + Google Places Autocomplete.
   * Remote rows are merged into the shared cache for subsequent local lookups. */
  search(query: string, limit = 6): Observable<DestinationListItem[]> {
    const trimmed = query.trim();
    const q = normalizeSearchText(trimmed);
    if (!q || q.length < 2) return of([]);

    const local = this.match(trimmed, limit);
    if (local.length >= limit) return of(local);

    const cacheKey = `${q}:${limit}`;
    const cachedRemote = this.remoteCache.get(cacheKey);
    if (cachedRemote) {
      return of(this.mergeResults(local, cachedRemote, limit));
    }

    const catalog$ = this.http
      .get<DestinationListItem[]>(
        apiUrl(`/destinations?search=${encodeURIComponent(trimmed)}&limit=${limit}`),
      )
      .pipe(catchError(() => of([] as DestinationListItem[])));

    const places$ = this.http
      .get<PlacesAutocompleteRow[]>(
        apiUrl(
          `/inventory/places/autocomplete?q=${encodeURIComponent(trimmed)}&limit=${limit}&types=(cities)`,
        ),
      )
      .pipe(
        map((rows) =>
          (rows ?? []).map(
            (row): DestinationListItem => ({
              id: row.place_id,
              name: (row.name || row.description || '').split(',')[0].trim(),
              description: row.description || row.secondary || '',
              region: row.secondary || '',
              placeId: row.place_id,
              tags: ['places'],
              source: row.source || 'google_places',
            }),
          ),
        ),
        catchError(() => of([] as DestinationListItem[])),
      );

    return forkJoin([catalog$, places$]).pipe(
      map(([catalog, places]) => dedupeDestinationsByName([...catalog, ...places])),
      tap((remote) => {
        this.remoteCache.set(cacheKey, remote);
        this.mergeIntoCache(remote);
      }),
      map((remote) => this.mergeResults(local, remote, limit)),
      catchError(() => of(local)),
    );
  }

  /** Resolve lat/lng (+ address) for a Places Autocomplete pick. */
  resolvePlaceDetails(placeId: string): Observable<DestinationListItem | null> {
    if (!placeId) return of(null);
    return this.http
      .get<{
        place_id?: string;
        name?: string;
        address?: string;
        lat?: number;
        lng?: number;
        photo?: string;
      }>(apiUrl(`/inventory/places/details?place_id=${encodeURIComponent(placeId)}`))
      .pipe(
        map((d) =>
          d
            ? ({
                id: d.place_id,
                name: d.name || '',
                description: d.address || '',
                placeId: d.place_id,
                lat: d.lat,
                lng: d.lng,
                image: d.photo,
                source: 'google_places',
              } satisfies DestinationListItem)
            : null,
        ),
        catchError(() => of(null)),
      );
  }

  /** Filters full destination records by name or tag, for the Explore grid. */
  filter(
    query: string,
    activeFilters: Iterable<DestinationFilter> = [],
  ): DestinationListItem[] {
    const q = normalizeSearchText(query);
    const filters = [...activeFilters];

    return this.searchable()
      .filter(({ nameLower, tagsLower, item }) => {
        const matchesQuery =
          !q || nameLower.includes(q) || tagsLower.some((tag) => tag.includes(q));
        const matchesFilter = destinationMatchesFilters(item, filters);
        return matchesQuery && matchesFilter;
      })
      .map(({ item }) => item);
  }

  private mergeIntoCache(remote: DestinationListItem[]): void {
    if (!remote.length) return;
    const merged = dedupeDestinationsByName([...this.destinations(), ...remote]);
    if (merged.length > this.destinations().length) {
      this.destinations.set(merged);
    }
  }

  private mergeResults(
    local: DestinationListItem[],
    remote: DestinationListItem[],
    limit: number,
  ): DestinationListItem[] {
    const seen = new Set<string>();
    const merged: DestinationListItem[] = [];
    for (const item of [...local, ...remote]) {
      const key = normalizeSearchText(item.name);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
      if (merged.length >= limit) break;
    }
    return merged;
  }
}
