import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild, inject, Output, EventEmitter } from '@angular/core';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

declare let L: any;
import { GeocodingService } from '../../shared/utils/geocoding.service';
import { loadGoogleMaps, loadLeaflet } from '../../shared/utils/lazy-load.util';
import { PublicConfigService } from '../../shared/services/public-config.service';
import { DestinationListItem } from '../../shared/utils/destination.util';

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Standard Google Maps dark-mode style array — parity with the Leaflet dark tile layer. */
const GOOGLE_DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0d1b2a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#07111f' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8b98a8' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1a2c3f' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#17293b' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#07111f' }] },
];

@Component({
    selector: 'app-explore-map',
    imports: [TranslatePipe],
    template: `
    <div class="map-container relative z-0 w-full h-[calc(100vh-280px)] min-h-[500px] overflow-hidden rounded-2xl shadow-sm border border-border">
      <div #mapElement class="w-full h-full"></div>

      @if (isLoading) {
        <div class="absolute inset-0 bg-white/60 flex items-center justify-center z-[1000] backdrop-blur-sm">
          <div class="flex flex-col items-center gap-3 bg-white p-6 rounded-2xl shadow-xl">
            <svg class="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="text-sm font-bold text-text-primary">{{ 'EXPLORE.MAP.LOADING' | translate }}</span>
          </div>
        </div>
      }
    </div>
  `,
    styles: [`
    :host {
      display: block;
    }
  `]
})
export class ExploreMapComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('mapElement', { static: true }) mapElement!: ElementRef;

  @Input() destinations: DestinationListItem[] = [];
  /** Highlights the matching marker/pin — set from ExplorePageComponent's selectedDestination signal. */
  @Input() selectedDestinationName: string | null = null;
  @Output() destinationSelected = new EventEmitter<DestinationListItem>();

  private map: any;
  private gmap: any = null;
  private markers: any[] = [];
  private gMarkers: any[] = [];
  private useGoogle = false;
  private geocodingService = inject(GeocodingService);
  private publicConfig = inject(PublicConfigService);
  private translate = inject(TranslateService);

  isLoading = false;

  async ngOnInit() {
    this.isLoading = true;
    try {
      const key = await this.publicConfig.getGoogleMapsBrowserKey();
      if (key) {
        try {
          const maps = await loadGoogleMaps(key);
          if (maps) {
            this.useGoogle = true;
            this.initGoogleMap(maps);
            return;
          }
        } catch (err) {
          console.warn('Google Maps unavailable, falling back to Leaflet', err);
        }
      }
      await loadLeaflet();
      this.initMap();
    } catch (err) {
      console.error('Failed to load map library', err);
    } finally {
      this.isLoading = false;
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if ((this.map || this.gmap) && (changes['destinations'] || changes['selectedDestinationName'])) {
      void this.updateMapFeatures();
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
    this.map = L.map(this.mapElement.nativeElement).setView([20, 0], 2);

    // Dark atmospheric basemap — "bright route nodes" read clearly against it.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(this.map);

    void this.updateMapFeatures();
  }

  private initGoogleMap(maps: any) {
    this.gmap = new maps.Map(this.mapElement.nativeElement, {
      center: { lat: 20, lng: 0 },
      zoom: 2,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      styles: GOOGLE_DARK_MAP_STYLE,
    });
    void this.updateMapFeatures();
  }

  private async updateMapFeatures() {
    if (this.useGoogle && this.gmap) {
      await this.updateGoogleFeatures();
      return;
    }
    if (!this.map) return;

    this.isLoading = true;
    this.clearMap();

    const dests = this.destinations || [];
    const geocodePromises = dests.slice(0, 30).map(async (dest) => {
      if (!dest.name) return null;
      const coords =
        dest.lat != null && dest.lng != null
          ? { lat: dest.lat, lon: dest.lng, displayName: dest.name }
          : await this.geocodingService.getCoordinates(dest.name);
      return { dest, coords };
    });

    const results = await Promise.all(geocodePromises);

    for (const result of results) {
      if (result && result.coords) {
        const { dest, coords } = result;
        const latLng = L.latLng(coords.lat, coords.lon);

        // Bright route-glow node against the dark basemap; selected pin gets a wider glow ring.
        const isSelected = dest.name === this.selectedDestinationName;
        const customIcon = L.divIcon({
          className: 'bg-transparent border-0',
          html: `
            <div class="relative group cursor-pointer -mt-6 -ml-3">
              <div class="w-8 h-8 bg-route-glow text-atmosphere rounded-full flex items-center justify-center shadow-route border-2 border-atmosphere-elevated text-lg transition-transform hover:scale-110 ${isSelected ? 'scale-125 ring-4 ring-route-glow/40' : ''}">
                📍
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 32]
        });

        const marker = L.marker(latLng, { icon: customIcon }).addTo(this.map);
        marker.on('click', () => this.destinationSelected.emit(dest));

        const popupContent = `
          <div class="w-48 p-1 flex flex-col gap-2 font-poppins cursor-pointer" onclick="document.dispatchEvent(new CustomEvent('exploreMapSelect', {detail: '${escapeHtml(dest.name)}'}))">
            ${dest.image ? `<img src="${dest.image}" class="w-full h-24 object-cover rounded-xl shadow-sm" alt="${escapeHtml(dest.name)}">` : ''}
            <div class="flex flex-col">
              <span class="font-bold text-gray-900 text-sm">${escapeHtml(dest.name)}</span>
            </div>
            <button class="mt-1 w-full bg-route-glow text-atmosphere py-1.5 rounded-lg text-xs font-bold shadow-sm transition-opacity hover:opacity-90">${escapeHtml(this.translate.instant('EXPLORE.MAP.VIEW_PACKAGES'))}</button>
          </div>
        `;

        marker.bindPopup(popupContent, {
          closeButton: false,
          className: 'custom-explore-popup'
        });

        this.markers.push(marker);
      }
    }

    if (this.markers.length > 0) {
      const group = L.featureGroup(this.markers);
      this.map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 6 });
    }

    if (typeof document !== 'undefined' && !this.map._hasCustomListener) {
      document.addEventListener('exploreMapSelect', ((e: CustomEvent) => {
        const match = (this.destinations || []).find((d) => d.name === e.detail);
        if (match) this.destinationSelected.emit(match);
      }) as EventListener);
      this.map._hasCustomListener = true;
    }

    this.isLoading = false;
  }

  private async updateGoogleFeatures() {
    if (!this.gmap || !(window as any).google?.maps) return;
    const maps = (window as any).google.maps;
    this.isLoading = true;
    this.gMarkers.forEach((m) => m.setMap(null));
    this.gMarkers = [];

    const bounds = new maps.LatLngBounds();
    const dests = this.destinations || [];

    const results = await Promise.all(
      dests.slice(0, 30).map(async (dest) => {
        if (!dest.name) return null;
        const coords =
          dest.lat != null && dest.lng != null
            ? { lat: dest.lat, lon: dest.lng }
            : await this.geocodingService.getCoordinates(dest.name);
        return coords ? { dest, coords } : null;
      }),
    );

    for (const result of results) {
      if (!result) continue;
      const { dest, coords } = result;
      const pos = { lat: coords.lat, lng: coords.lon };
      bounds.extend(pos);
      const isSelected = dest.name === this.selectedDestinationName;
      // Bright route-glow node against the dark map style, matching the Leaflet pin.
      const marker = new maps.Marker({
        map: this.gmap,
        position: pos,
        title: dest.name,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          fillColor: '#37D6D0', // route.glow
          fillOpacity: 1,
          strokeColor: '#0D1B2A', // atmosphere.elevated
          strokeWeight: 2,
          scale: isSelected ? 10 : 7,
        },
      });
      const info = new maps.InfoWindow({
        // Literal hex (inline style, not a Tailwind class) matching route.glow / atmosphere tokens —
        // InfoWindow content lives outside Angular's Tailwind-processed DOM.
        content: `<div style="max-width:180px"><strong>${escapeHtml(dest.name)}</strong><br><button id="gm-pick-${escapeHtml(dest.name)}" style="margin-top:6px;background:#37D6D0;color:#07111F;border:0;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:600;cursor:pointer">${escapeHtml(this.translate.instant('EXPLORE.MAP.VIEW_PACKAGES'))}</button></div>`,
      });
      marker.addListener('click', () => {
        info.open({ map: this.gmap, anchor: marker });
        this.destinationSelected.emit(dest);
      });
      this.gMarkers.push(marker);
    }

    if (!bounds.isEmpty()) {
      this.gmap.fitBounds(bounds, 48);
    }
    this.isLoading = false;
  }

  private clearMap() {
    this.markers.forEach(m => m.remove());
    this.markers = [];
  }
}
