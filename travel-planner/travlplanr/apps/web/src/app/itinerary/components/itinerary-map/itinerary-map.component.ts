import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild, inject } from '@angular/core';

import { TranslateService } from '@ngx-translate/core';

import { GeocodeResult, GeocodingService } from '../../../shared/utils/geocoding.service';
import { TripCityDay, TripSegment } from '../../../trip/trip.service';
import { loadGoogleMaps, loadLeaflet } from '../../../shared/utils/lazy-load.util';
import { PublicConfigService } from '../../../shared/services/public-config.service';

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

type MapStop = {
  lat: number;
  lng: number;
  title: string;
  kind: 'city' | 'hotel' | 'activity' | 'flight' | 'car' | 'train' | 'bus';
  subtitle?: string;
  cityIndex?: number;
};

@Component({
    selector: 'app-itinerary-map',
    imports: [],
    template: `
    <div [class]="'map-container relative w-full h-full min-h-[200px] overflow-hidden shadow-sm ' + customClasses">
      <div #mapElement class="absolute inset-0 w-full h-full"></div>

      @if (isLoading) {
        <div class="absolute inset-0 bg-white/60 dark:bg-gray-900/70 flex items-center justify-center z-[1000]">
          <div class="flex flex-col items-center gap-2">
            <svg class="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="text-sm font-medium text-text-primary dark:text-gray-200">Loading Map...</span>
          </div>
        </div>
      }
    </div>
  `,
    styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      min-height: 200px;
    }
    :host-context(.dark) ::ng-deep .leaflet-tile-pane {
      filter: brightness(0.7) invert(1) contrast(0.9) hue-rotate(180deg);
    }
    ::ng-deep .leaflet-container,
    ::ng-deep .gm-style {
      width: 100% !important;
      height: 100% !important;
    }
  `]
})
export class ItineraryMapComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('mapElement', { static: true }) mapElement!: ElementRef;

  @Input() cityDays: TripCityDay[] = [];
  @Input() segments: TripSegment[] = [];
  @Input() customClasses: string = 'h-[400px] lg:h-[600px] rounded-xl border border-border';

  private map: any;
  private gmap: any = null;
  private markers: any[] = [];
  private polylines: any[] = [];
  private gMarkers: any[] = [];
  private gPolyline: any = null;
  private useGoogle = false;
  private leaflet: any = null;
  private geocodingService = inject(GeocodingService);
  private translate = inject(TranslateService);
  private publicConfig = inject(PublicConfigService);
  private resizeObserver: ResizeObserver | null = null;
  /** Bumps whenever a new feature pass starts so stale geocode work is ignored. */
  private renderGen = 0;
  private gBounds: any = null;
  private leafletBounds: any = null;

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
            this.observeContainerResize();
            // Map shell is ready — never keep the blocker up while pins geocode.
            this.isLoading = false;
            void this.updateMapFeatures();
            return;
          }
        } catch (err) {
          console.warn('Google Maps unavailable, falling back to Leaflet', err);
        }
      }
      this.leaflet = await loadLeaflet();
      (window as any).L = this.leaflet;
      this.setupMarkerIcon();
      this.initMap();
      this.observeContainerResize();
      this.isLoading = false;
      void this.updateMapFeatures();
    } catch (err) {
      console.error('Failed to load map library', err);
      this.isLoading = false;
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if ((this.map || this.gmap) && (changes['cityDays'] || changes['segments'])) {
      void this.updateMapFeatures();
    }
  }

  ngOnDestroy() {
    this.renderGen++;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.map) {
      this.map.remove();
    }
    this.clearGoogleOverlays();
    this.gmap = null;
  }

  private get L(): any {
    return this.leaflet || (window as any).L;
  }

  private setupMarkerIcon() {
    const Lref = this.L;
    if (!Lref) return;
    const iconRetinaUrl = 'assets/leaflet/images/marker-icon-2x.png';
    const iconUrl = 'assets/leaflet/images/marker-icon.png';
    const shadowUrl = 'assets/leaflet/images/marker-shadow.png';
    const iconDefault = Lref.icon({
      iconRetinaUrl,
      iconUrl,
      shadowUrl,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      tooltipAnchor: [16, -28],
      shadowSize: [41, 41]
    });
    Lref.Marker.prototype.options.icon = iconDefault;
  }

  private initMap() {
    const Lref = this.L;
    if (!Lref) return;
    this.map = Lref.map(this.mapElement.nativeElement, {
      preferCanvas: false,
    }).setView([15.2993, 74.124], 9);

    Lref.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(this.map);
  }

  private initGoogleMap(maps: any) {
    this.gmap = new maps.Map(this.mapElement.nativeElement, {
      center: { lat: 15.2993, lng: 74.124 },
      zoom: 9,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });
  }

  private observeContainerResize() {
    if (typeof ResizeObserver === 'undefined') {
      this.refreshMapSize();
      return;
    }
    const el = this.mapElement?.nativeElement as HTMLElement | undefined;
    if (!el) return;
    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => this.refreshMapSize());
    this.resizeObserver.observe(el);
    requestAnimationFrame(() => this.refreshMapSize());
  }

  private refreshMapSize() {
    if (this.useGoogle && this.gmap && (window as any).google?.maps) {
      (window as any).google.maps.event.trigger(this.gmap, 'resize');
      return;
    }
    if (this.map) {
      this.map.invalidateSize(false);
    }
  }

  private async updateMapFeatures() {
    const gen = ++this.renderGen;
    try {
      // Clear old overlays once, then paint each pin as it resolves so the map
      // never sits behind a spinner waiting on slow/throttled geocodes. Each
      // arrival only ADDS its own marker (not a full clear-and-rebuild of every
      // marker so far) — the city-to-city line is the only thing rebuilt per
      // arrival, and always from the full sorted stop list so it never zigzags.
      if (this.useGoogle && this.gmap) {
        this.clearGoogleOverlays();
        this.gBounds = new (window as any).google.maps.LatLngBounds();
      } else if (this.map) {
        this.clearMap();
        this.leafletBounds = null;
      }

      const stops: MapStop[] = [];
      const tasks: Promise<void>[] = [];

      const pushStop = (stop: MapStop | null) => {
        if (!stop || gen !== this.renderGen) return;
        stops.push(stop);
        if (this.useGoogle && this.gmap) {
          this.addGoogleStopMarker(stop);
          this.rebuildGoogleCityPath(stops);
        } else if (this.map) {
          this.addLeafletStopMarker(stop);
          this.rebuildLeafletCityPath(stops);
        }
        this.refreshMapSize();
      };

      this.cityDays.forEach((cityDay, index) => {
        if (!cityDay.city) return;
        tasks.push(
          this.resolveQuery(cityDay.city).then((coords) => {
            pushStop(
              coords
                ? {
                    lat: coords.lat,
                    lng: coords.lon,
                    title: cityDay.city,
                    kind: 'city',
                    subtitle: `${cityDay.nights} Nights`,
                    cityIndex: index + 1,
                  }
                : null,
            );
          }),
        );
      });

      for (const segment of this.segments || []) {
        for (const task of this.segmentStopTasks(segment)) {
          tasks.push(task.then(pushStop));
        }
      }

      await Promise.all(tasks);
    } catch (err) {
      console.warn('Map feature update failed', err);
    }
  }

  private segmentStopTasks(segment: TripSegment): Promise<MapStop | null>[] {
    const s = segment as any;
    const kind = s.type as MapStop['kind'];

    if (kind === 'hotel' || kind === 'activity') {
      return [
        this.resolveLatLngOrQuery(s.lat, s.lng, s.location).then((coords) => {
          if (!coords) return null;
          const title = kind === 'hotel' ? s.name : s.title;
          const travel =
            kind === 'activity' && (s.travelDuration || s.travelMinutes)
              ? this.translate.instant('ITINERARY.MAP.FROM_PREVIOUS_STOP', { duration: s.travelDuration || s.travelMinutes + 'm' })
              : undefined;
          return {
            lat: coords.lat,
            lng: coords.lon,
            title: title || kind,
            kind,
            subtitle: travel,
          };
        }),
      ];
    }

    if (kind === 'flight') {
      const out: Promise<MapStop | null>[] = [];
      if (s.depCode) {
        out.push(
          this.resolveQuery(String(s.depCode)).then((coords) =>
            coords
              ? {
                  lat: coords.lat,
                  lng: coords.lon,
                  title: `${s.carrier || this.translate.instant('ITINERARY.MAP.FLIGHT_FALLBACK')} ${s.flightNo || ''}`.trim(),
                  kind: 'flight',
                  subtitle: this.translate.instant('ITINERARY.MAP.DEPART', { code: s.depCode }),
                }
              : null,
          ),
        );
      }
      if (s.arrCode) {
        out.push(
          this.resolveQuery(String(s.arrCode)).then((coords) =>
            coords
              ? {
                  lat: coords.lat,
                  lng: coords.lon,
                  title: `${s.carrier || this.translate.instant('ITINERARY.MAP.FLIGHT_FALLBACK')} ${s.flightNo || ''}`.trim(),
                  kind: 'flight',
                  subtitle: this.translate.instant('ITINERARY.MAP.ARRIVE', { code: s.arrCode }),
                }
              : null,
          ),
        );
      }
      return out;
    }

    if (kind === 'car' || kind === 'train' || kind === 'bus') {
      const from = s.fromLocation || s.depLocation || s.location;
      const to = s.toLocation || s.arrLocation;
      const out: Promise<MapStop | null>[] = [];
      if (from) {
        out.push(
          this.resolveQuery(String(from)).then((coords) =>
            coords
              ? {
                  lat: coords.lat,
                  lng: coords.lon,
                  title: s.model || s.carrier || s.route || kind,
                  kind,
                  subtitle: this.translate.instant('ITINERARY.MAP.FROM', { location: from }),
                }
              : null,
          ),
        );
      }
      if (to) {
        out.push(
          this.resolveQuery(String(to)).then((coords) =>
            coords
              ? {
                  lat: coords.lat,
                  lng: coords.lon,
                  title: s.model || s.carrier || s.route || kind,
                  kind,
                  subtitle: this.translate.instant('ITINERARY.MAP.TO', { location: to }),
                }
              : null,
          ),
        );
      }
      return out;
    }

    return [];
  }

  private async resolveLatLngOrQuery(
    lat: unknown,
    lng: unknown,
    query?: string,
  ): Promise<GeocodeResult | null> {
    if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lon: lng, displayName: query || '' };
    }
    if (query) return this.resolveQuery(query);
    return null;
  }

  private resolveQuery(query: string): Promise<GeocodeResult | null> {
    return this.geocodingService.getCoordinates(query);
  }

  /** Adds just this one stop's marker — does not touch existing markers or the polyline. */
  private addGoogleStopMarker(stop: MapStop) {
    if (!this.gmap || !(window as any).google?.maps) return;
    const maps = (window as any).google.maps;
    const pos = { lat: stop.lat, lng: stop.lng };
    this.gBounds = this.gBounds || new maps.LatLngBounds();
    this.gBounds.extend(pos);

    if (stop.kind === 'city') {
      const marker = new maps.Marker({
        map: this.gmap,
        position: pos,
        label: { text: String(stop.cityIndex ?? '?'), color: 'white' },
        title: stop.title,
        zIndex: 20,
      });
      const info = new maps.InfoWindow({
        content: `<strong>${escapeHtml(stop.title)}</strong>${
          stop.subtitle ? `<br>${escapeHtml(stop.subtitle)}` : ''
        }`,
      });
      marker.addListener('click', () => info.open({ map: this.gmap!, anchor: marker }));
      this.gMarkers.push(marker);
    } else {
      const colors: Record<string, string> = {
        hotel: '#eab308',
        activity: '#ef4444',
        flight: '#0ea5e9',
        car: '#22c55e',
        train: '#a855f7',
        bus: '#f97316',
      };
      const marker = new maps.Marker({
        map: this.gmap,
        position: pos,
        title: stop.title,
        zIndex: stop.kind === 'hotel' ? 15 : 10,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: stop.kind === 'flight' ? 8 : 7,
          fillColor: colors[stop.kind] || '#ef4444',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
      });
      const info = new maps.InfoWindow({
        content: `<strong>${escapeHtml(stop.title)}</strong><br><span style="text-transform:capitalize">${escapeHtml(
          stop.kind,
        )}</span>${stop.subtitle ? `<br>${escapeHtml(stop.subtitle)}` : ''}`,
      });
      marker.addListener('click', () => info.open({ map: this.gmap!, anchor: marker }));
      this.gMarkers.push(marker);
    }

    if (!this.gBounds.isEmpty()) {
      this.gmap.fitBounds(this.gBounds, 48);
    }
  }

  /** Rebuilds the city-to-city line from the FULL stop list, sorted by visit order — never by arrival order. */
  private rebuildGoogleCityPath(stops: MapStop[]) {
    if (!this.gmap || !(window as any).google?.maps) return;
    const maps = (window as any).google.maps;
    const cityPath = stops
      .filter((s) => s.kind === 'city')
      .sort((a, b) => (a.cityIndex ?? 0) - (b.cityIndex ?? 0))
      .map((s) => ({ lat: s.lat, lng: s.lng }));

    if (this.gPolyline) {
      this.gPolyline.setMap(null);
      this.gPolyline = null;
    }
    if (cityPath.length > 1) {
      this.gPolyline = new maps.Polyline({
        path: cityPath,
        geodesic: true,
        strokeColor: '#0060EA',
        strokeOpacity: 0.7,
        strokeWeight: 3,
        map: this.gmap,
      });
    }
  }

  /** Adds just this one stop's marker — does not touch existing markers or the polyline. */
  private addLeafletStopMarker(stop: MapStop) {
    const Lref = this.L;
    if (!this.map || !Lref) return;
    const latLng = Lref.latLng(stop.lat, stop.lng);
    this.leafletBounds = this.leafletBounds ? this.leafletBounds.extend(latLng) : Lref.latLngBounds([latLng]);

    if (stop.kind === 'city') {
      const cityIcon = Lref.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: #0060EA; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2); font-weight: bold; font-size: 12px;">${
          stop.cityIndex ?? '?'
        }</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      const marker = Lref.marker(latLng, { icon: cityIcon })
        .addTo(this.map)
        .bindPopup(
          `<strong>${escapeHtml(stop.title)}</strong>${
            stop.subtitle ? `<br>${escapeHtml(stop.subtitle)}` : ''
          }`,
        );
      this.markers.push(marker);
    } else {
      const colors: Record<string, string> = {
        hotel: '#eab308',
        activity: '#ef4444',
        flight: '#0ea5e9',
        car: '#22c55e',
        train: '#a855f7',
        bus: '#f97316',
      };
      const color = colors[stop.kind] || '#ef4444';
      const icon = Lref.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      const marker = Lref.marker(latLng, { icon })
        .addTo(this.map)
        .bindPopup(
          `<strong>${escapeHtml(stop.title)}</strong><br><span style="text-transform: capitalize">${escapeHtml(
            stop.kind,
          )}</span>${stop.subtitle ? `<br>${escapeHtml(stop.subtitle)}` : ''}`,
        );
      this.markers.push(marker);
    }

    if (this.leafletBounds && this.leafletBounds.isValid()) {
      this.map.fitBounds(this.leafletBounds, { padding: [50, 50] });
    }
  }

  /** Rebuilds the city-to-city line from the FULL stop list, sorted by visit order — never by arrival order. */
  private rebuildLeafletCityPath(stops: MapStop[]) {
    const Lref = this.L;
    if (!this.map || !Lref) return;
    const cityCoords = stops
      .filter((s) => s.kind === 'city')
      .sort((a, b) => (a.cityIndex ?? 0) - (b.cityIndex ?? 0))
      .map((s) => Lref.latLng(s.lat, s.lng));

    this.polylines.forEach((p) => p.remove());
    this.polylines = [];
    if (cityCoords.length > 1) {
      const line = Lref.polyline(cityCoords, {
        color: '#0060EA',
        weight: 3,
        opacity: 0.6,
        dashArray: '5, 10',
      }).addTo(this.map);
      this.polylines.push(line);
    }
  }

  private clearMap() {
    this.markers.forEach((m) => m.remove());
    this.markers = [];
    this.polylines.forEach((p) => p.remove());
    this.polylines = [];
  }

  private clearGoogleOverlays() {
    this.gMarkers.forEach((m) => m.setMap(null));
    this.gMarkers = [];
    if (this.gPolyline) {
      this.gPolyline.setMap(null);
      this.gPolyline = null;
    }
  }
}
