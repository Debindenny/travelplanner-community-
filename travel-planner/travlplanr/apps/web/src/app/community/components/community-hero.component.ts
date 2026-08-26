import { Component, Output, EventEmitter, signal, computed, OnInit, OnDestroy, inject } from '@angular/core';

import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';
import { apiUrl } from '../../shared/utils/api-url';
import { TripService, SavedTrip } from '../../trip/trip.service';
import { CommunityCollectionService } from '../services/community-collection.service';
import { AuthService } from '../../auth/auth.service';

interface HeroDestination {
  name: string;
  image: string;
}

@Component({
    selector: 'app-community-hero',
    imports: [RouterLink, TranslatePipe],
    template: `
    @if (nextTrip(); as trip) {
      <!-- Personalized next-trip card, shown when the signed-in user has a real upcoming trip -->
      <div class="relative rounded-[22px] overflow-hidden mb-5 select-none font-[inherit]">
        <div
          class="absolute inset-0 bg-cover bg-center"
          [style.backgroundImage]="trip.image ? 'url(' + trip.image + ')' : null"
        ></div>
        <div class="absolute inset-0 community-hero-overlay"></div>
        <div class="relative flex flex-col justify-end min-h-[210px] sm:min-h-64 p-5 sm:p-7 max-w-[650px]">
          <div class="flex items-center gap-[9px] mb-3">
            <span class="w-[7px] h-[7px] rounded-full community-badge-dot"></span>
            <p class="text-[10.5px] font-semibold text-white/70 uppercase tracking-[0.14em]">
              {{ 'COMMUNITY.HERO.NEXT_TRIP_BADGE' | translate }} · {{ 'COMMUNITY.HERO.DAYS_AWAY' | translate: { count: daysAway(trip) } }}
            </p>
          </div>
          <h2 class="text-[28px] sm:text-[34px] font-bold text-white leading-[1.08] tracking-[-0.025em] mb-2.5 max-w-lg">{{ trip.destination }}</h2>
          <p class="text-[13px] font-semibold text-white/75 mb-[22px]">
            {{ formatDateRange(trip) }} <span class="opacity-45">·</span> {{ (nightsCount(trip) === 1 ? 'COMMUNITY.HERO.NIGHT_COUNT' : 'COMMUNITY.HERO.NIGHTS_COUNT') | translate: { count: nightsCount(trip) } }}
            @if (savedSpots() !== null) {
              <span class="opacity-45">·</span> {{ (savedSpots() === 1 ? 'COMMUNITY.HERO.SAVED_SPOT_COUNT' : 'COMMUNITY.HERO.SAVED_SPOTS_COUNT') | translate: { count: savedSpots() } }}
            }
          </p>
          <div class="flex items-center gap-2 flex-wrap">
            <a
              routerLink="/explore"
              [queryParams]="{ q: cityName(trip) }"
              class="h-10 inline-flex items-center px-[18px] bg-white text-[13px] font-semibold rounded-[11px] transition-colors whitespace-nowrap community-hero-btn-solid"
            >
              {{ 'COMMUNITY.HERO.EXPLORE_DESTINATION' | translate: { name: cityName(trip) } }}
            </a>
            <a
              routerLink="/community/matching"
              class="h-10 inline-flex items-center px-[18px] bg-white/[0.16] hover:bg-white/[0.28] text-white text-[13px] font-semibold rounded-[11px] transition-colors whitespace-nowrap"
            >
              {{ 'COMMUNITY.HERO.FIND_TRAVELERS' | translate }}
            </a>
            <a [routerLink]="['/itinerary', trip.id]" class="h-10 inline-flex items-center px-3.5 text-white/80 hover:text-white text-[13px] font-semibold transition-colors whitespace-nowrap">
              {{ 'COMMUNITY.HERO.OPEN_TRIP' | translate }} →
            </a>
          </div>
        </div>
      </div>
    } @else {
      <!-- Hero for signed-out users / users without an upcoming trip. Shows a rotating
           photo carousel once real destinations load from the API; the card, heading
           and buttons below always render regardless — only the photo layer and the
           place-name badge are conditional on real data being available, so there is
           no fake photo/name shown while loading or if that API call fails. -->
      <div class="relative rounded-[22px] overflow-hidden mb-5 select-none font-[inherit]">
        @if (destinations().length > 0) {
          <div
            class="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
            [style.backgroundImage]="'url(' + destinations()[currentIndex()].image + ')'"
            [class.opacity-100]="!transitioning()"
            [class.opacity-0]="transitioning()"
          ></div>
        }
        <div class="absolute inset-0 community-hero-overlay"></div>
        @if (destinations().length > 0) {
          <div class="absolute bottom-4 right-4 flex gap-1.5 z-10">
            @for (d of destinations(); track d.name; let i = $index) {
              <button
                (click)="goTo(i)"
                class="w-1.5 h-1.5 rounded-full transition-all focus:outline-none bg-white"
                [class.opacity-40]="i !== currentIndex()"
              ></button>
            }
          </div>
        }
        <div class="relative flex flex-col justify-end min-h-[210px] sm:min-h-64 p-5 sm:p-7 max-w-[650px]">

          @if (destinations().length > 0) {
            <div class="flex items-center gap-[9px] mb-3">
              <span class="w-[7px] h-[7px] rounded-full community-badge-dot"></span>
              <p class="text-[10.5px] font-semibold text-white/70 uppercase tracking-[0.14em]">📍 {{ destinations()[currentIndex()].name }}</p>
            </div>
          }
          <h2 class="text-[28px] sm:text-[34px] font-bold text-white leading-[1.08] tracking-[-0.025em] mb-[22px] max-w-lg">{{ 'COMMUNITY.HERO.TITLE_LINE1' | translate }}<br class="sm:hidden" /> {{ 'COMMUNITY.HERO.TITLE_LINE2' | translate }}</h2>
          <div class="flex items-center gap-2 flex-wrap">
            <button
              (click)="onPost.emit()"
              class="h-10 inline-flex items-center gap-1.5 px-[18px] bg-white text-[13px] font-semibold rounded-[11px] transition-colors community-hero-btn-solid"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
              {{ 'COMMUNITY.HERO.POST' | translate }}
            </button>
            <button
              (click)="onMap.emit()"
              class="h-10 inline-flex items-center gap-1.5 px-[18px] bg-white/[0.16] hover:bg-white/[0.28] text-white text-[13px] font-semibold rounded-[11px] transition-colors"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
              {{ 'COMMUNITY.HERO.EXPLORE_MAP' | translate }}
            </button>
            <a
              routerLink="/community/matching"
              class="h-10 inline-flex items-center gap-1.5 px-[18px] bg-primary hover:bg-primary-hover text-white text-[13px] font-semibold rounded-[11px] transition-colors"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
              {{ 'COMMUNITY.HERO.FIND_BUDDIES' | translate }}
            </a>
          </div>
        </div>
      </div>
    }
  `
})
export class CommunityHeroComponent implements OnInit, OnDestroy {
  @Output() onPost = new EventEmitter<void>();
  @Output() onMap = new EventEmitter<void>();

  private http = inject(HttpClient);
  private tripService = inject(TripService);
  private collectionService = inject(CommunityCollectionService);
  private auth = inject(AuthService);

  readonly savedSpots = signal<number | null>(null);

  /** The soonest real upcoming trip, if the signed-in user has one. */
  readonly nextTrip = computed(() => {
    const now = Date.now();
    const upcoming = this.tripService.trips()
      .filter(t => t.status !== 'cancelled' && !!t.startDate && new Date(t.startDate).getTime() >= now)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    return upcoming[0] ?? null;
  });

  destinations = signal<HeroDestination[]>([]);
  currentIndex = signal(0);
  transitioning = signal(false);
  private rotateInterval?: ReturnType<typeof setInterval>;

  ngOnInit() {
    this.loadDestinations();
    this.startRotation();
    if (this.auth.user()) {
      this.collectionService.getCollections().subscribe({
        next: (collections) => this.savedSpots.set(collections.reduce((sum, c) => sum + (c.item_count || 0), 0)),
        error: () => {}
      });
    }
  }

  ngOnDestroy() {
    if (this.rotateInterval) clearInterval(this.rotateInterval);
  }

  private loadDestinations() {
    this.http.get<any[]>(apiUrl('/destinations?limit=6&has_image=true')).pipe(
      catchError(() => of(null))
    ).subscribe(data => {
      if (data?.length) {
        const mapped = data
          .filter((d: any) => d.image || d.images?.[0])
          .slice(0, 5)
          .map((d: any) => ({ name: d.name, image: d.image || d.images[0] }));
        if (mapped.length >= 2) {
          this.destinations.set(mapped);
        }
      }
    });
  }

  private startRotation() {
    this.rotateInterval = setInterval(() => {
      if (this.destinations().length < 2) return;
      this.transitioning.set(true);
      setTimeout(() => {
        this.currentIndex.update(i => (i + 1) % this.destinations().length);
        this.transitioning.set(false);
      }, 500);
    }, 5000);
  }

  goTo(i: number) {
    if (i === this.currentIndex()) return;
    this.transitioning.set(true);
    setTimeout(() => {
      this.currentIndex.set(i);
      this.transitioning.set(false);
    }, 300);
  }

  daysAway(trip: SavedTrip): number {
    return Math.max(0, Math.ceil((new Date(trip.startDate).getTime() - Date.now()) / 86400000));
  }

  nightsCount(trip: SavedTrip): number {
    return Math.max(1, Math.round((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / 86400000));
  }

  cityName(trip: SavedTrip): string {
    return (trip.destination || '').split(',')[0].trim();
  }

  formatDateRange(trip: SavedTrip): string {
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const start = new Date(trip.startDate).toLocaleDateString('en-US', opts);
    const end = new Date(trip.endDate).toLocaleDateString('en-US', opts);
    return `${start} – ${end}`;
  }
}
