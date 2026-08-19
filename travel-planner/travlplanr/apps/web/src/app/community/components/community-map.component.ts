import { Component, Input, signal, OnInit, AfterViewInit, ViewChild, ElementRef, OnChanges, SimpleChanges, OnDestroy, inject } from '@angular/core';

import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { loadGoogleMaps, loadLeaflet } from '../../shared/utils/lazy-load.util';
import { PublicConfigService } from '../../shared/services/public-config.service';

declare const L: any;

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface SheetPost {
  id: string;
  author: { name: string; avatar: string | null };
  destination: { name: string } | null;
  images: string[];
  caption: string;
}

@Component({
    selector: 'app-community-map',
    imports: [RouterLink, TranslatePipe],
    template: `
    <div
      class="w-full rounded-2xl overflow-hidden border border-border shadow-sm relative transition-all duration-500"
      [class.h-[calc(100vh-180px)]]="fullScreen()"
      [class.h-[480px]]="!fullScreen()"
      role="region"
      [attr.aria-label]="'COMMUNITY.MAP.ARIA_LABEL' | translate"
    >
      <div #mapContainer class="w-full h-full z-0"></div>

      <!-- Full-screen toggle -->
      <button
        (click)="fullScreen.set(!fullScreen())"
        class="absolute top-3 right-3 z-[1000] bg-white/95 hover:bg-white backdrop-blur-sm text-text-primary border border-border px-3 py-1.5 rounded-lg shadow-md text-xs font-bold flex items-center gap-1.5 transition-all focus:outline-none"
        [attr.aria-label]="(fullScreen() ? 'COMMUNITY.MAP.EXIT_FULLSCREEN' : 'COMMUNITY.MAP.EXPAND_MAP') | translate"
      >
        @if (fullScreen()) {
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          {{ 'COMMUNITY.MAP.EXIT' | translate }}
        } @else {
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
          {{ 'COMMUNITY.MAP.EXPAND' | translate }}
        }
      </button>

      @if (missingCount > 0) {
        <div class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm px-4 py-2 rounded-full shadow-md border border-border z-[1000] text-sm text-text-secondary font-bold flex items-center gap-2">
          <svg class="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          {{ 'COMMUNITY.MAP.MISSING_LOCATIONS' | translate: { count: missingCount } }}
        </div>
      }
    </div>

    <!-- Bottom sheet for pin preview -->
    @if (activeSheet()) {
      <div
        class="fixed inset-x-0 bottom-0 z-[2000] md:absolute md:inset-x-4 md:bottom-4 md:left-auto md:right-4 md:w-80 animate-slide-up"
        role="dialog"
        aria-modal="true"
      >
        <div class="bg-white/98 backdrop-blur-md rounded-t-2xl md:rounded-2xl shadow-2xl border border-border overflow-hidden">
          <!-- Drag handle (mobile) -->
          <div class="md:hidden flex justify-center pt-2 pb-1">
            <div class="w-10 h-1 bg-slate-300 rounded-full"></div>
          </div>
          @if (activeSheet()!.images?.length) {
            <img [src]="activeSheet()!.images[0]" class="w-full h-32 object-cover" alt="" loading="lazy" decoding="async" />
          }
          <div class="p-3">
            <div class="flex items-center gap-2 mb-2">
              <img [src]="activeSheet()!.author.avatar || '/assets/images/default-avatar.svg'" class="w-8 h-8 rounded-full object-cover border border-border shrink-0" alt="" loading="lazy" decoding="async" />
              <div class="min-w-0">
                <p class="text-sm font-extrabold text-text-primary truncate">{{ activeSheet()!.author.name }}</p>
                @if (activeSheet()!.destination) {
                  <p class="text-xs text-text-secondary truncate flex items-center gap-0.5">
                    <svg class="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>
                    {{ activeSheet()!.destination!.name }}
                  </p>
                }
              </div>
            </div>
            <p class="text-xs text-text-primary line-clamp-2 leading-relaxed mb-3">{{ activeSheet()!.caption }}</p>
            <div class="flex items-center gap-2">
              <a [routerLink]="['/community/posts', activeSheet()!.id]" class="flex-1 text-center bg-primary hover:bg-primary-hover text-white text-xs font-bold py-2 rounded-xl transition-colors focus:outline-none">{{ 'COMMUNITY.MAP.VIEW_POST' | translate }}</a>
              <button (click)="activeSheet.set(null)" class="px-3 py-2 text-text-secondary hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors focus:outline-none" [attr.aria-label]="'COMMUNITY.MAP.CLOSE' | translate">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class CommunityMapComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @Input() posts: any[] = [];
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;

  missingCount = 0;
  fullScreen = signal(false);
  activeSheet = signal<SheetPost | null>(null);

  private map: any;
  private gmap: any = null;
  private gMarkers: any[] = [];
  private markersLayer: any;
  private leafletLoaded = false;
  private useGoogle = false;
  private publicConfig = inject(PublicConfigService);

  constructor(private translate: TranslateService) {}

  ngOnInit() {}

  async ngAfterViewInit() {
    try {
      const key = await this.publicConfig.getGoogleMapsBrowserKey();
      if (key) {
        try {
          const maps = await loadGoogleMaps(key);
          if (maps) {
            this.useGoogle = true;
            this.gmap = new maps.Map(this.mapContainer.nativeElement, {
              center: { lat: 20, lng: 0 },
              zoom: 2,
              mapTypeControl: false,
              streetViewControl: false,
            });
            this.updateMarkers();
            return;
          }
        } catch (err) {
          console.warn('Google Maps unavailable, falling back to Leaflet', err);
        }
      }
      await loadLeaflet();
      this.leafletLoaded = true;
      this.initMap();
      this.updateMarkers();
    } catch (err) {
      console.error('Failed to load map library', err);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['posts'] && (this.map || this.gmap)) {
      this.updateMarkers();
    }
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
    this.gMarkers.forEach((m) => m.setMap?.(null));
    this.gMarkers = [];
    this.gmap = null;
  }

  private initMap() {
    this.map = L.map(this.mapContainer.nativeElement).setView([20, 0], 2);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19
    }).addTo(this.map);

    this.markersLayer = L.layerGroup().addTo(this.map);
  }

  private updateMarkers() {
    if (this.useGoogle && this.gmap) {
      this.updateGoogleMarkers();
      return;
    }
    if (!this.map || !this.markersLayer) return;

    this.markersLayer.clearLayers();
    this.missingCount = 0;

    const bounds = L.latLngBounds();
    let hasMarkers = false;
    const avatarAlt = this.translate.instant('COMMUNITY.MAP.AVATAR_ALT');

    for (const post of this.posts) {
      const dest = post.destination;
      if (dest?.latitude && dest?.longitude) {
        hasMarkers = true;
        const latLng = [dest.latitude, dest.longitude];
        bounds.extend(latLng);

        const avatarHtml = post.author?.avatar
          ? `<img src="${escapeHtml(post.author.avatar)}" alt="${escapeHtml(avatarAlt)}" class="w-9 h-9 rounded-full border-2 border-white object-cover shadow-lg" loading="lazy" decoding="async" />`
          : `<div class="w-9 h-9 rounded-full border-2 border-white bg-primary flex items-center justify-center text-white shadow-lg"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div>`;

        const customIcon = L.divIcon({
          className: 'custom-leaflet-icon',
          html: `<div class="relative cursor-pointer hover:-translate-y-1 transition-transform duration-150">
                  ${avatarHtml}
                  <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rotate-45 shadow-sm"></div>
                </div>`,
          iconSize: [36, 44],
          iconAnchor: [18, 44]
        });

        const marker = L.marker(latLng, { icon: customIcon });
        const capturedPost = post;

        marker.on('click', () => {
          this.activeSheet.set({
            id: capturedPost.id,
            author: { name: capturedPost.author?.name || this.translate.instant('COMMUNITY.MAP.DEFAULT_AUTHOR_NAME'), avatar: capturedPost.author?.avatar ?? null },
            destination: capturedPost.destination ? { name: capturedPost.destination.name } : null,
            images: capturedPost.images || [],
            caption: capturedPost.caption || '',
          });
        });

        this.markersLayer.addLayer(marker);
      } else {
        this.missingCount++;
      }
    }

    if (hasMarkers) {
      this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  }

  private updateGoogleMarkers() {
    if (!this.gmap || !(window as any).google?.maps) return;
    const maps = (window as any).google.maps;
    this.gMarkers.forEach((m) => m.setMap(null));
    this.gMarkers = [];
    this.missingCount = 0;

    const bounds = new maps.LatLngBounds();
    let hasMarkers = false;

    for (const post of this.posts) {
      const dest = post.destination;
      if (dest?.latitude && dest?.longitude) {
        hasMarkers = true;
        const pos = { lat: dest.latitude, lng: dest.longitude };
        bounds.extend(pos);
        const marker = new maps.Marker({
          map: this.gmap,
          position: pos,
          title: dest.name || post.author?.name || 'Post',
        });
        const capturedPost = post;
        marker.addListener('click', () => {
          this.activeSheet.set({
            id: capturedPost.id,
            author: {
              name: capturedPost.author?.name || this.translate.instant('COMMUNITY.MAP.DEFAULT_AUTHOR_NAME'),
              avatar: capturedPost.author?.avatar ?? null,
            },
            destination: capturedPost.destination ? { name: capturedPost.destination.name } : null,
            images: capturedPost.images || [],
            caption: capturedPost.caption || '',
          });
        });
        this.gMarkers.push(marker);
      } else {
        this.missingCount++;
      }
    }

    if (hasMarkers && !bounds.isEmpty()) {
      this.gmap.fitBounds(bounds, 48);
    }
  }
}
