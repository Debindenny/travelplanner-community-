import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../../shared/utils/api-url';
import { dedupeDestinationsByName } from '../../shared/utils/destination.util';
import {
  BEYOND_TOURIST_TRAIL,
  MIDDLE_EAST_TRIPS,
  POPULAR_DESTINATIONS,
  SOUTH_EAST_ASIA_TRIPS,
  TOP_RATED_TRIPS,
  TRENDING_EUROPE,
  UNIQUE_EXPERIENCE_TRIPS,
  UNITED_STATES_TRIPS,
} from '../../shared/data/landing.data';

@Injectable()
export class LandingDestinationsService {
  private readonly http = inject(HttpClient);

  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  readonly middleEastTrips = signal<any[]>([]);
  readonly unitedStatesTrips = signal<any[]>([]);
  readonly trendingEurope = signal<any[]>([]);
  readonly topRatedTrips = signal<any[]>([]);
  readonly uniqueExperienceTrips = signal<any[]>([]);
  readonly southEastAsiaTrips = signal<any[]>([]);
  readonly popularDestinations = signal<any[]>([]);
  readonly iconicVacations = signal<any[]>([]);

  constructor() {
    this.ensureSectionData();
  }

  loadDestinations() {
    this.ensureSectionData();
    this.isLoading.set(true);
    this.error.set(null);
    this.http.get<any[]>(apiUrl('/destinations')).subscribe({
      next: (rawDests) => {
        this.isLoading.set(false);
        const dests = dedupeDestinationsByName(rawDests || []);
        if (!dests.length) {
          this.applyStaticFallback('No destinations returned from the API.');
          return;
        }
        this.error.set(null);
        this.applyApiDestinations(dests);
      },
      error: (err) => {
        this.isLoading.set(false);
        const offline = err?.status === 0 || err?.status >= 500;
        this.applyStaticFallback(
          offline
            ? 'Live destinations unavailable — showing sample content. We are currently experiencing technical difficulties connecting to our servers. Please try again in a few moments.'
            : 'Failed to load destinations. Showing sample content.',
        );
        console.error('Failed to load destinations:', err);
      },
    });
  }

  private applyApiDestinations(dests: any[]): void {
    /** Bento placement keys — must match `.tile-*` rules in destination-grid-section. */
    const trendingAreas = [
      'malaysia',
      'maldives',
      'seychelles',
      'thailand',
      'switzerland',
      'singapore',
    ] as const;
    const iconicAreas = ['uae', 'usa', 'europe', 'australia', 'china', 'india'] as const;

    // Server already converts via X-Currency — pass a bare amount for display formatting.
    const formatPrice = (price: unknown): string => {
      if (price == null || price === '') return '83000';
      if (typeof price === 'number' && Number.isFinite(price)) {
        return String(Math.round(price));
      }
      const raw = String(price).replace(/^(starts?\s+from|start\s+at)\s*/i, '').trim();
      if (!raw) return '83000';
      const num = Number(raw.replace(/[^\d.]/g, ''));
      if (Number.isFinite(num) && num > 0) return String(Math.round(num));
      return raw.replace(/^[₹$€]\s*/, '');
    };

    const mapToCard = (d: any, gridArea?: string) => {
      let img = d.image || 'assets/images/placeholder.jpg';
      if (d.name === 'Los Angeles' || img.includes('de10a4f220002bdc61761b69689914f967c43a4f')) {
        img = 'assets/images/landing/figma/west-coast.jpg';
      }
      return {
        image: img,
        name: d.name,
        country: d.country || d.name,
        tours: (d.tags && d.tags.length) || 5,
        days: d.duration_days ? `${d.duration_days} days` : '4 days',
        group: 'Family',
        theme: 'Nature',
        // Amount only — template already prefixes LANDING.STARTS_FROM.
        price: formatPrice(d.price),
        title: d.name,
        ...(gridArea ? { gridArea } : {}),
      };
    };

    const filterTags = (tag: string) =>
      dests
        .filter((d) => d.tags && d.tags.some((t: string) => t.toLowerCase().replace(/ /g, '_') === tag))
        .map((d) => mapToCard(d));

    const mapBento = (items: any[], areas: readonly string[]) =>
      items.slice(0, areas.length).map((d, i) => mapToCard(d, areas[i]));

    const popular = dests.filter(
      (d) => d.tags && d.tags.some((t: string) => t.toLowerCase().replace(/ /g, '_') === 'popular'),
    );
    if (popular.length) this.popularDestinations.set(mapBento(popular, trendingAreas) as any);

    const beyond = dests.filter(
      (d) =>
        d.tags &&
        d.tags.some((t: string) => t.toLowerCase().replace(/ /g, '_') === 'beyond_tourist_trail'),
    );
    if (beyond.length) this.iconicVacations.set(mapBento(beyond, iconicAreas) as any);

    this.middleEastTrips.set(filterTags('middle_east'));
    this.unitedStatesTrips.set(filterTags('united_states'));
    this.trendingEurope.set(filterTags('trending_europe'));
    this.topRatedTrips.set(filterTags('top_rated'));
    this.southEastAsiaTrips.set(filterTags('south_east_asia'));
    this.uniqueExperienceTrips.set(filterTags('unique_experience'));
    this.ensureSectionData();
  }

  private ensureSectionData(): void {
    if (!this.popularDestinations().length) this.popularDestinations.set(POPULAR_DESTINATIONS as any);
    if (!this.iconicVacations().length) this.iconicVacations.set(BEYOND_TOURIST_TRAIL as any);
    if (!this.middleEastTrips().length) this.middleEastTrips.set(MIDDLE_EAST_TRIPS as any);
    if (!this.unitedStatesTrips().length) this.unitedStatesTrips.set(UNITED_STATES_TRIPS as any);
    if (!this.trendingEurope().length) this.trendingEurope.set(TRENDING_EUROPE as any);
    if (!this.topRatedTrips().length) this.topRatedTrips.set(TOP_RATED_TRIPS as any);
    if (!this.southEastAsiaTrips().length) this.southEastAsiaTrips.set(SOUTH_EAST_ASIA_TRIPS as any);
    if (!this.uniqueExperienceTrips().length) this.uniqueExperienceTrips.set(UNIQUE_EXPERIENCE_TRIPS as any);
  }

  private applyStaticFallback(message: string): void {
    this.error.set(message);
    this.popularDestinations.set(POPULAR_DESTINATIONS as any);
    this.iconicVacations.set(BEYOND_TOURIST_TRAIL as any);
    this.middleEastTrips.set(MIDDLE_EAST_TRIPS as any);
    this.unitedStatesTrips.set(UNITED_STATES_TRIPS as any);
    this.trendingEurope.set(TRENDING_EUROPE as any);
    this.topRatedTrips.set(TOP_RATED_TRIPS as any);
    this.southEastAsiaTrips.set(SOUTH_EAST_ASIA_TRIPS as any);
    this.uniqueExperienceTrips.set(UNIQUE_EXPERIENCE_TRIPS as any);
  }
}
