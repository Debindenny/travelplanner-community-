import { Component, Output, EventEmitter, signal, OnInit, OnDestroy, inject } from '@angular/core';

import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';
import { apiUrl } from '../../shared/utils/api-url';

interface HeroDestination {
  name: string;
  image: string;
}

const FALLBACK_DESTINATIONS: HeroDestination[] = [
  { name: 'Kyoto, Japan', image: 'assets/images/landing/journey-thailand.jpg' },
  { name: 'Santorini, Greece', image: 'assets/images/landing/destination-bali.jpg' },
  { name: 'Bali, Indonesia', image: 'assets/images/landing/destination-paris.jpg' },
];

@Component({
    selector: 'app-community-hero',
    imports: [RouterLink, TranslatePipe],
    template: `
    <div class="relative rounded-2xl overflow-hidden mb-5 h-36 sm:h-44 select-none">
      <!-- Background image with Ken Burns -->
      <div
        class="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
        [style.backgroundImage]="'url(' + destinations()[currentIndex()].image + ')'"
        [class.opacity-100]="!transitioning()"
        [class.opacity-0]="transitioning()"
      ></div>
      <!-- Gradient overlay -->
      <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
      <!-- Destination dots -->
      <div class="absolute bottom-3 right-3 flex gap-1">
        @for (d of destinations(); track d.name; let i = $index) {
          <button
            (click)="goTo(i)"
            class="w-1.5 h-1.5 rounded-full transition-all focus:outline-none bg-white"
            [class.opacity-40]="i !== currentIndex()"
          ></button>
        }
      </div>
      <!-- Content -->
      <div class="absolute inset-0 flex flex-col justify-end p-4">
        <p class="text-2xs font-extrabold text-white/60 uppercase tracking-widest mb-1">📍 {{ destinations()[currentIndex()].name }}</p>
        <h2 class="text-lg sm:text-xl font-extrabold text-white leading-tight mb-3 drop-shadow-sm">{{ 'COMMUNITY.HERO.TITLE_LINE1' | translate }}<br class="sm:hidden" /> {{ 'COMMUNITY.HERO.TITLE_LINE2' | translate }}</h2>
        <div class="flex items-center gap-2 flex-wrap">
          <button
            (click)="onPost.emit()"
            class="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/20 transition-all hover:scale-105 active:scale-95"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            {{ 'COMMUNITY.HERO.POST' | translate }}
          </button>
          <button
            (click)="onMap.emit()"
            class="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/20 transition-all hover:scale-105 active:scale-95"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
            {{ 'COMMUNITY.HERO.EXPLORE_MAP' | translate }}
          </button>
          <a
            routerLink="/community/matching"
            class="flex items-center gap-1.5 bg-primary/80 hover:bg-primary backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full border border-primary/50 transition-all hover:scale-105 active:scale-95"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
            {{ 'COMMUNITY.HERO.FIND_BUDDIES' | translate }}
          </a>
        </div>
      </div>
    </div>
  `
})
export class CommunityHeroComponent implements OnInit, OnDestroy {
  @Output() onPost = new EventEmitter<void>();
  @Output() onMap = new EventEmitter<void>();

  private http = inject(HttpClient);

  destinations = signal<HeroDestination[]>(FALLBACK_DESTINATIONS);
  currentIndex = signal(0);
  transitioning = signal(false);
  private rotateInterval?: ReturnType<typeof setInterval>;

  ngOnInit() {
    this.loadDestinations();
    this.startRotation();
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
}
