import { Component, ElementRef, OnDestroy, OnInit, AfterViewInit, ViewChild, inject, signal } from '@angular/core';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { loadLeaflet } from '../../../shared/utils/lazy-load.util';

declare let L: any;

interface MapHotspot {
  id: string;
  name: string;
  region: string;
  focus: string;
  detail: string;
  lat: number;
  lng: number;
  timezone: string;
  countryCode: string;
}

@Component({
    selector: 'app-about-map',
    imports: [TranslatePipe],
    template: `
    <div 
      class="relative w-full rounded-card border border-border-light bg-[#020c1b] p-6 text-white overflow-hidden transition-all duration-300"
      [class.shadow-2xl]="!isFullscreen()"
      [class.min-h-[500px]]="!isFullscreen()"
      [class.fixed]="isFullscreen()"
      [class.inset-0]="isFullscreen()"
      [class.z-[9999]]="isFullscreen()"
      [class.rounded-none]="isFullscreen()"
      [class.h-screen]="isFullscreen()"
    >
      <!-- Background radial glow -->
      <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,96,234,0.12),transparent_70%)] pointer-events-none z-10"></div>

      <div class="relative z-20 flex flex-col gap-2 mb-6 pointer-events-none">
        <h3 class="text-lg font-bold tracking-tight text-white/95">{{ 'ABOUT.MAP.TITLE' | translate }}</h3>
        <p class="text-xs text-white/40">{{ 'ABOUT.MAP.SUBTITLE' | translate }}</p>
      </div>

      <!-- Fullscreen Toggle Button -->
      <button 
        (click)="toggleFullscreen()" 
        class="absolute top-6 right-6 z-30 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 p-2.5 rounded-lg text-white transition-all focus:outline-none focus:ring-2 focus:ring-primary shadow-lg"
        [title]="(isFullscreen() ? 'ABOUT.MAP.FULLSCREEN_EXIT' : 'ABOUT.MAP.FULLSCREEN_ENTER') | translate"
      >
        @if (isFullscreen()) {
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5M15 15l5.25 5.25" />
          </svg>
        } @else {
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
          </svg>
        }
      </button>

      <!-- Map Container -->
      <div 
        class="relative z-0 w-full overflow-hidden rounded-lg transition-all"
        [class.h-[400px]]="!isFullscreen()"
        [class.h-[calc(100vh-120px)]]="isFullscreen()"
      >
        <div #mapElement class="w-full h-full"></div>
        
        @if (isLoading) {
          <div class="absolute inset-0 bg-[#020c1b]/80 flex items-center justify-center z-[1000] backdrop-blur-sm">
            <div class="flex flex-col items-center gap-3 bg-slate-800 p-6 rounded-2xl shadow-xl text-white">
              <svg class="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span class="text-sm font-bold">{{ 'ABOUT.MAP.LOADING' | translate }}</span>
            </div>
          </div>
        }
      </div>
    </div>
  `,
    styles: [`
    :host {
      display: block;
    }
    
    ::ng-deep .animated-route {
      stroke-dasharray: 6 12;
      animation: dash-flow 10s linear infinite;
    }
    
    @keyframes dash-flow {
      to { stroke-dashoffset: -100; }
    }
    
    ::ng-deep .leaflet-popup-content-wrapper {
      background-color: transparent !important;
      box-shadow: none !important;
    }
    ::ng-deep .leaflet-popup-tip {
      display: none !important;
    }
    ::ng-deep .leaflet-container {
      background: transparent !important;
    }
  `]
})
export class AboutMapComponent implements OnInit, OnDestroy {
  @ViewChild('mapElement', { static: true }) mapElement!: ElementRef;
  
  private map: any;
  private translate = inject(TranslateService);
  private liveInterval: any;
  
  isLoading = false;
  isFullscreen = signal(false);

  readonly hotspots: MapHotspot[] = [
    { id: 'ny', name: 'New York City', region: 'North America Hub', focus: 'Urban itinerary example', detail: 'Connecting trans-Atlantic flights with local East Coast getaways.', lat: 40.7128, lng: -74.0060, timezone: 'America/New_York', countryCode: 'USA' },
    { id: 'paris', name: 'Paris', region: 'European Hub', focus: 'Culture itinerary example', detail: 'Top destination for culinary, romance, and cultural itineraries.', lat: 48.8566, lng: 2.3522, timezone: 'Europe/Paris', countryCode: 'FRA' },
    { id: 'rio', name: 'Rio de Janeiro', region: 'South America Hub', focus: 'Coastal itinerary example', detail: 'Central node for tropical breaks and South American expeditions.', lat: -22.9068, lng: -43.1729, timezone: 'America/Sao_Paulo', countryCode: 'BRA' },
    { id: 'capetown', name: 'Cape Town', region: 'African Hub', focus: 'Nature itinerary example', detail: 'Nature safaris and premium wine route connections.', lat: -33.9249, lng: 18.4241, timezone: 'Africa/Johannesburg', countryCode: 'ZAF' },
    { id: 'tokyo', name: 'Tokyo', region: 'Asian Hub', focus: 'Rail itinerary example', detail: 'Gateway to high-speed rail packages and traditional temple tours.', lat: 35.6762, lng: 139.6503, timezone: 'Asia/Tokyo', countryCode: 'JPN' },
    { id: 'sydney', name: 'Sydney', region: 'Oceania Hub', focus: 'Outdoor itinerary example', detail: 'Connecting coastal trips, coral reef excursions, and outback escapes.', lat: -33.8688, lng: 151.2093, timezone: 'Australia/Sydney', countryCode: 'AUS' }
  ];

  ngOnInit() {
  }

  ngAfterViewInit() {
    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !this.map) {
          this.loadMap();
          observer.disconnect();
        }
      }, { threshold: 0.1 });
      observer.observe(this.mapElement.nativeElement);
    } else {
      this.loadMap();
    }
  }

  async loadMap() {
    this.isLoading = true;
    try {
      await loadLeaflet();
      this.initMap();
    } catch (e) {
      console.error('Failed to load Leaflet:', e);
    } finally {
      this.isLoading = false;
    }
  }

  ngOnDestroy() {
    if (this.liveInterval) {
      clearInterval(this.liveInterval);
    }
    if (this.map) {
      this.map.remove();
    }
  }

  toggleFullscreen() {
    this.isFullscreen.update(v => !v);
    
    // Toggle scroll zoom capability based on fullscreen mode
    if (this.map) {
      if (this.isFullscreen()) {
        this.map.scrollWheelZoom.enable();
      } else {
        this.map.scrollWheelZoom.disable();
      }
      
      // Give DOM time to update sizes then invalidate
      setTimeout(() => {
        this.map.invalidateSize();
      }, 350);
    }
  }

  private initMap() {
    if (typeof window === 'undefined') return;

    this.map = L.map(this.mapElement.nativeElement, {
      zoomControl: false,
      scrollWheelZoom: false,
      minZoom: 1,
      maxZoom: 10,
      worldCopyJump: true
    }).setView([20, 10], 1);

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(this.map);

    this.loadGeoJSON();
    this.plotHotspots();
    this.drawRoutes();
    this.startLiveUpdater();

    // Fix grey tile issue by invalidating size after initial render
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
      }
    }, 250);
  }

  private loadGeoJSON() {
    // Fetch simplified world borders to highlight top regions
    fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json')
      .then(res => res.json())
      .then(data => {
        const targetCountries = this.hotspots.map(h => h.countryCode);
        L.geoJSON(data, {
          filter: (feature: any) => targetCountries.includes(feature.id),
          style: {
            color: '#0060EA',
            weight: 1.5,
            opacity: 0.5,
            fillColor: '#0060EA',
            fillOpacity: 0.1
          }
        }).addTo(this.map);
      })
      .catch(e => console.error('Failed to load GeoJSON', e));
  }

  private plotHotspots() {
    for (const spot of this.hotspots) {
      const customIcon = L.divIcon({
        className: 'bg-transparent border-0',
        html: `
          <div class="relative flex items-center justify-center -ml-2 -mt-2 w-4 h-4">
            <div class="absolute w-full h-full bg-primary rounded-full animate-ping opacity-75"></div>
            <div class="relative w-3 h-3 bg-primary border border-white rounded-full shadow-[0_0_8px_#0060EA]"></div>
          </div>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      const marker = L.marker([spot.lat, spot.lng], { icon: customIcon }).addTo(this.map);

      const translatedName = this.translate.instant(`ABOUT.MAP.HOTSPOTS.${spot.id}.NAME`);
      const translatedRegion = this.translate.instant(`ABOUT.MAP.HOTSPOTS.${spot.id}.REGION`);
      const translatedDetail = this.translate.instant(`ABOUT.MAP.HOTSPOTS.${spot.id}.DETAIL`);
      const translatedFocus = this.translate.instant(`ABOUT.MAP.HOTSPOTS.${spot.id}.FOCUS`);

      const popupContent = `
        <div class="w-56 p-4 flex flex-col gap-2 font-poppins bg-slate-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-primary/30">
          <div class="flex justify-between items-start">
            <div class="flex flex-col">
              <span class="text-sm font-bold text-white">${translatedName}</span>
              <span class="text-2xs font-medium text-primary uppercase tracking-wider">${translatedRegion}</span>
            </div>
            <!-- Live Clock Span -->
            <span id="clock-${spot.id}" class="text-xs font-mono font-semibold text-white/80 bg-white/10 px-1.5 py-0.5 rounded">--:--</span>
          </div>
          
          <span class="mt-1 text-xs font-normal leading-relaxed text-white/80 border-t border-white/10 pt-2">
            ${translatedDetail}
          </span>
          <span class="text-2xs font-bold text-emerald-400">
            ${translatedFocus}
          </span>
          
        </div>
      `;

      marker.bindPopup(popupContent, {
        closeButton: false,
        offset: [0, -4]
      });
      
      marker.on('click', () => {
        marker.openPopup();
        this.updateLiveData();
      });
    }
  }

  private drawRoutes() {
    const routes = [
      ['ny', 'paris'],
      ['paris', 'tokyo'],
      ['ny', 'rio'],
      ['rio', 'capetown'],
      ['capetown', 'tokyo'],
      ['tokyo', 'sydney'],
      ['paris', 'capetown']
    ];

    const style = {
      color: '#0060EA',
      weight: 2,
      opacity: 0.6,
      className: 'animated-route'
    };

    for (const [fromId, toId] of routes) {
      const from = this.hotspots.find(h => h.id === fromId);
      const to = this.hotspots.find(h => h.id === toId);
      if (from && to) {
        // We use native Leaflet polylines but assign an animated CSS class
        L.polyline([[from.lat, from.lng], [to.lat, to.lng]], style).addTo(this.map);
      }
    }
  }

  private startLiveUpdater() {
    // Update clocks and stats every minute (or immediately if triggered)
    this.updateLiveData();
    this.liveInterval = setInterval(() => {
      this.updateLiveData();
    }, 60000);
  }

  private updateLiveData() {
    if (typeof window === 'undefined' || !document) return;
    
    const now = new Date();
    
    for (const spot of this.hotspots) {
      // Update Clock
      const clockEl = document.getElementById(`clock-${spot.id}`);
      if (clockEl) {
        try {
          const timeString = new Intl.DateTimeFormat('en-US', {
            timeZone: spot.timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }).format(now);
          clockEl.innerText = timeString;
        } catch (e) {
          clockEl.innerText = '--:--';
        }
      }
    }
  }
}
