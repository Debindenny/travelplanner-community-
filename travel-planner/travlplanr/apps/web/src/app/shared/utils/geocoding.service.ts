import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { apiUrl } from './api-url';

export interface GeocodeResult {
  lat: number;
  lon: number;
  displayName: string;
}

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private readonly http = inject(HttpClient);
  private cache = new Map<string, GeocodeResult>();
  /** Timestamp of each failed lookup — retried after NEGATIVE_TTL_MS instead of cached forever. */
  private failedAt = new Map<string, number>();
  private readonly NEGATIVE_TTL_MS = 5 * 60 * 1000;
  private promiseChain: Promise<any> = Promise.resolve();

  /** Timestamp of the last Nominatim request — Nominatim ToS: max 1 req/sec. */
  private lastNominatimCallMs = 0;

  // Static cache for major cities and airports — avoids unnecessary API calls.
  private readonly staticCache: Record<string, GeocodeResult> = {
    'Paris, France': { lat: 48.8566, lon: 2.3522, displayName: 'Paris, France' },
    'Paris': { lat: 48.8566, lon: 2.3522, displayName: 'Paris' },
    'CDG': { lat: 49.0097, lon: 2.5479, displayName: 'Charles de Gaulle Airport' },
    'London, UK': { lat: 51.5074, lon: -0.1278, displayName: 'London, UK' },
    'London': { lat: 51.5074, lon: -0.1278, displayName: 'London' },
    'LHR': { lat: 51.4700, lon: -0.4543, displayName: 'Heathrow Airport' },
    'New York': { lat: 40.7128, lon: -74.0060, displayName: 'New York City' },
    'JFK': { lat: 40.6413, lon: -73.7781, displayName: 'JFK Airport' },
    'Rome': { lat: 41.9028, lon: 12.4964, displayName: 'Rome' },
    'FCO': { lat: 41.7999, lon: 12.2462, displayName: 'Leonardo da Vinci Airport' },
    'Tokyo': { lat: 35.6762, lon: 139.6503, displayName: 'Tokyo' },
    'NRT': { lat: 35.7720, lon: 140.3929, displayName: 'Narita Airport' },
    'HND': { lat: 35.5494, lon: 139.7798, displayName: 'Haneda Airport' },
    'Dubai': { lat: 25.2048, lon: 55.2708, displayName: 'Dubai' },
    'Singapore': { lat: 1.3521, lon: 103.8198, displayName: 'Singapore' },
    'Bangkok': { lat: 13.7563, lon: 100.5018, displayName: 'Bangkok' },
    'Goa': { lat: 15.2993, lon: 74.1240, displayName: 'Goa' },
    'Bangalore': { lat: 12.9716, lon: 77.5946, displayName: 'Bangalore' },
    'Bengaluru': { lat: 12.9716, lon: 77.5946, displayName: 'Bengaluru' },
    'BLR': { lat: 13.1986, lon: 77.7066, displayName: 'Kempegowda International Airport' },
    'GOI': { lat: 15.3808, lon: 73.8314, displayName: 'Goa International Airport' },
    'Sinquerim Beach': { lat: 15.5005, lon: 73.7661, displayName: 'Sinquerim Beach, Goa' },
    'Sinquerim Beach, North Goa': { lat: 15.5005, lon: 73.7661, displayName: 'Sinquerim Beach, North Goa' },
    'Sinquerim Fort': { lat: 15.4992, lon: 73.7685, displayName: 'Fort Aguada / Sinquerim, Goa' },
    'Sunset Drinks at Sinquerim Fort': { lat: 15.4992, lon: 73.7685, displayName: 'Sinquerim Fort, Goa' },
    'Fort Aguada': { lat: 15.4922, lon: 73.7731, displayName: 'Fort Aguada, Goa' },
    'Fort Aguada, Goa': { lat: 15.4922, lon: 73.7731, displayName: 'Fort Aguada, Goa' },
    'Goa Airport': { lat: 15.3808, lon: 73.8314, displayName: 'Goa International Airport' },
    'Dudhsagar Falls': { lat: 15.3142, lon: 74.3144, displayName: 'Dudhsagar Falls, Goa' },
    'Dudhsagar Falls, Goa': { lat: 15.3142, lon: 74.3144, displayName: 'Dudhsagar Falls, Goa' },
    "Tito's Lane": { lat: 15.5600, lon: 73.7550, displayName: "Tito's Lane, Arpora, Goa" },
    "Tito's Lane, Arpora, North Goa": {
      lat: 15.5600,
      lon: 73.7550,
      displayName: "Tito's Lane, Arpora, North Goa",
    },
  };

  /**
   * Returns coordinates for a location string.
   *
   * Resolution order:
   * 1. Exact match in static cache (case-insensitive).
   *    This prevents "London Street, Bangkok" from resolving to London.
   * 2. IATA code shortcut — 3-letter all-caps strings matched against exact
   *    static cache keys only (no substring matching).
   * 3. In-memory runtime cache (results from previous Nominatim calls).
   * 4. Nominatim API, throttled to ≤ 1 req/sec per their ToS.
   */
  async getCoordinates(location: string): Promise<GeocodeResult | null> {
    if (!location) return null;

    const normalized = location.trim();
    const normalizedLower = normalized.toLowerCase();

    // 1. Exact match — case-insensitive
    const exactKey = Object.keys(this.staticCache).find(
      (k) => k.toLowerCase() === normalizedLower,
    );
    if (exactKey) return this.staticCache[exactKey];

    // 2. IATA-like 3-letter codes (e.g. "CDG", "LHR") — exact key match only
    if (/^[A-Z]{3}$/.test(normalized)) {
      if (this.staticCache[normalized]) return this.staticCache[normalized];
    }

    // 3. Runtime cache
    if (this.cache.has(normalized)) {
      return this.cache.get(normalized)!;
    }
    const failedTs = this.failedAt.get(normalized);
    if (failedTs != null && Date.now() - failedTs < this.NEGATIVE_TTL_MS) {
      return null;
    }

    // 4. Nominatim — serialize calls sequentially via promiseChain to guarantee 1 req/sec limit
    return new Promise<GeocodeResult | null>((resolve) => {
      this.promiseChain = this.promiseChain.then(async () => {
        try {
          const res = await this.executeGeocodes(normalized);
          resolve(res);
        } catch (e) {
          console.error(`Queue geocoding failed for ${normalized}`, e);
          resolve(null);
        }
      });
    });
  }

  private async executeGeocodes(normalized: string): Promise<GeocodeResult | null> {
    if (this.cache.has(normalized)) {
      return this.cache.get(normalized)!;
    }
    const failedTs = this.failedAt.get(normalized);
    if (failedTs != null && Date.now() - failedTs < this.NEGATIVE_TTL_MS) {
      return null;
    }

    // Throttle requests — keeps rate-limiting safe whether the backend proxy
    // forwards to Nominatim (1 req/s) or a commercial geocoder.
    const gap = Date.now() - this.lastNominatimCallMs;
    if (gap < 1000) {
      await new Promise<void>((resolve) => setTimeout(resolve, 1000 - gap));
    }

    try {
      // Backend: GET /api/v1/geocode?q=… → [{ lat, lon, display_name, name }]
      const url = apiUrl(`/geocode?q=${encodeURIComponent(normalized)}`);
      this.lastNominatimCallMs = Date.now();
      const res = await firstValueFrom(
        this.http
          .get<
            | { lat: string | number; lon: string | number; display_name: string; name?: string }[]
            | { lat: string | number; lon: string | number; display_name: string; name?: string }
          >(url)
          .pipe(timeout(4000)),
      );

      const row = Array.isArray(res) ? res[0] : res;
      if (row && row.lat != null && row.lon != null) {
        const result: GeocodeResult = {
          lat: parseFloat(String(row.lat)),
          lon: parseFloat(String(row.lon)),
          displayName: row.display_name || row.name || normalized,
        };
        this.cache.set(normalized, result);
        return result;
      }

      this.failedAt.set(normalized, Date.now());
      return null;
    } catch (e) {
      console.error(`Geocoding failed for ${normalized}`, e);
      // Cache misses briefly so map/transfer retries don't stampede a 429 — expires after NEGATIVE_TTL_MS.
      this.failedAt.set(normalized, Date.now());
      return null;
    }
  }
}
