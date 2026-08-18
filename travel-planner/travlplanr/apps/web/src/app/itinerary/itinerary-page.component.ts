import { Component, inject, signal, computed, ViewChild, ElementRef, OnInit, OnDestroy, effect, HostListener, DestroyRef } from '@angular/core';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { TripService, SavedTrip, DetailFlight, DetailCar, DetailHotel, DetailActivity, DetailTrain, DetailBus, TripSegment, CarRentalRole } from '../trip/trip.service';
import { ItineraryPdfService } from './itinerary-pdf.service';
import { ToastService } from '../shared/utils/toast.service';
import { apiErrorMessage } from '../shared/utils/api-error.util';
import { ItineraryPdfTemplateComponent } from './itinerary-pdf-template.component';
import {
  ItineraryPdfData,
  ItineraryPdfItem,
} from './itinerary-pdf.models';
import { PARTNER_LOGOS } from '../shared/data/landing.data';
import { airlineIataCode, safeAirlineLogoUrl, airlineLogoAsset } from '../shared/utils/airline-display.util';
import { LoadingOverlayComponent } from '../shared/components/loading-overlay/loading-overlay.component';
import { FooterSectionComponent } from '../landing/components/footer-section/footer-section.component';
import { ChatContextService } from '../shared/services/chat-context.service';
import { ChatLearningService } from '../shared/services/chat-learning.service';
import { ItineraryEditPayload, normalizeFromTitleMatch, isGenericActivityTitle } from '../shared/utils/chat-intent.util';
import { activityImageForCity, getSuggestedActivitiesForCity, SuggestedActivity, toItineraryTimeSlot } from '../shared/utils/activity-suggestions.util';
import { ItineraryMapComponent } from './components/itinerary-map/itinerary-map.component';
import { SharePanelComponent } from '../collaboration/components/share-panel/share-panel.component';
import { CollaborationService } from '../collaboration/collaboration.service';
import { AuthService } from '../auth/auth.service';
import { apiUrl } from '../shared/utils/api-url';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CURRENCY_SYMBOLS, LocaleService } from '../core/services/locale.service';
import {
  UI_LOCALE_TAGS,
  localizeDayTitle,
  localizeKnownPhrase,
  localizeTimeLabel,
} from './itinerary-i18n.util';
import { ItineraryStore } from './itinerary.store';
import { GenerationProgressService } from '../shared/services/generation-progress.service';
import { TripPresenceService } from '../shared/services/trip-presence.service';
import { TripVersionHistoryComponent } from './components/trip-version-history/trip-version-history.component';
import { TripCommentsComponent } from './components/trip-comments/trip-comments.component';
import { ItineraryHeaderComponent } from './components/itinerary-header/itinerary-header.component';
import { CurrencyConverterPipe } from '../shared/utils/currency-converter.pipe';
import { priceToUsd } from '../shared/utils/price-to-usd';
import { ItineraryTimelineComponent } from './components/itinerary-timeline/itinerary-timeline.component';
import { ModalComponent } from 'ui';
import { TransferPlanService, TransferLegPlan } from './transfer-plan.service';
import { TravelNextActivitiesService } from '../shared/services/travelnext-activities.service';
import { TravelomatixHotelsService } from '../shared/services/travelomatix-hotels.service';
import { TravelNextCarsService } from '../shared/services/travelnext-cars.service';

interface AlternativeHotel {
  id: string;
  name: string;
  rating: number;
  location: string;
  city: string;
  distance: string;
  maxGuests: number;
  roomType: string;
  bedPreference: string;
  cancellation: string;
  parking: string;
  price: number;
  taxes: number;
  imageUrl: string;
  amenities: string[];
  deepLink?: string;
  stars?: number;
  reviewCount?: number;
  gallery?: string[];
  mealPlan?: string;
  provider?: string;
  bookable?: boolean;
  partnerMetadata?: Record<string, unknown>;
}

interface HotelBedOption {
  id: string;
  name: string;
  features: { label: string; included: boolean }[];
  price: number;
}

interface HotelRoomTypeOption {
  id: string;
  name: string;
  maxGuests: number;
  imageUrl: string;
  beds: HotelBedOption[];
}

interface HotelDetailContent {
  gallery: string[];
  reviewCount: number;
  address: string;
  displayDate: string;
  checkInLabel: string;
  checkOutLabel: string;
  facilityColumns: string[][];
  overviewParagraphs: string[];
  roomTypes: HotelRoomTypeOption[];
}


interface AlternativeActivity {
  id: string;
  title: string;
  rating: number;
  location: string;
  city: string;
  distance: string;
  refundable: string;
  price: number; // Per person
  image: string;
  timeOfDay: 'Morning' | 'Noon' | 'Evening' | 'Night' | 'Halfday' | 'Fullday';
  duration: string;
  attractionType: string;
  locationType: 'Near Your Hotel' | 'In City Center' | 'Outside City';
  isPopular?: boolean;
  isLastMinute?: boolean;
  isLocalExpert?: boolean;
  deepLink?: string;
  provider?: string;
  reviewCount?: number;
  /** True when provider is content-only (e.g. TripAdvisor) — no bookable price. */
  contentOnly?: boolean;
  /** Optional drive-time label from previous stop (e.g. "25 min"). */
  travelDuration?: string;
  /** Optional drive time in minutes when a formatted label is unavailable. */
  travelMinutes?: number;
  /** Optional previous-stop label used in "from X" copy. */
  travelFrom?: string;
  lat?: number;
  lng?: number;
  placeId?: string;
  bookable?: boolean;
  partnerMetadata?: Record<string, unknown>;
}

interface ActivityDetailContent {
  overview: string;
  highlights: string[];
  included: string[];
  notIncluded: string[];
  meetingPoint: string;
  pickupInfo: string;
  cancellationPolicy: string;
  gallery: string[];
  reviewCount: number;
  languages: string[];
  timeSlots: string[];
  maxGroupSize: number;
}


export type DetailItem = DetailFlight | DetailCar | DetailHotel | DetailActivity | DetailTrain | DetailBus;

export interface DetailDay {
  day: number;
  title: string;
  dateStr: string;
  items: DetailItem[];
}

interface CityTransit {
  type: string;
  text: string;
  icon: string;
}

interface CityEntry {
  name: string;
  nights: number;
  transit: CityTransit;
}

interface AlternativeFlight {
  id: string;
  carrier: string;
  airlineCode: string;
  flightNo: string;
  class: string;
  refundable: string;
  depDate: string;
  depTime: string;
  depCode: string;
  arrDate: string;
  arrTime: string;
  arrCode: string;
  duration: string;
  stops: string;
  price: number;
  emission: string;
  logoUrl?: string;
}

interface AlternativeTrain {
  id: string;
  carrier: string;
  depDate: string;
  depTime: string;
  depLocation: string;
  arrDate: string;
  arrTime: string;
  arrLocation: string;
  duration: string;
  stops: string;
  class: string;
  refundable: string;
  price: number;
  imageUrl?: string;
  bookable?: boolean;
  partnerMetadata?: Record<string, unknown>;
}

interface AlternativeCar {
  id: string;
  model: string;
  category: string;
  location: string;
  passengers: number;
  gearbox: string;
  bags: number;
  fuel: string;
  mileage: string;
  security: number;
  supplier: string;
  price: number;
  imageUrl?: string;
  deepLink?: string;
  provider?: string;
  make?: string;
  duration?: string;
  durationMinutes?: number;
  distanceKm?: number | null;
  fromLocation?: string;
  toLocation?: string;
  fareSource?: 'transfer' | 'car' | 'route_estimate';
  bookable?: boolean;
  partnerMetadata?: Record<string, unknown>;
}

interface CarDetailContent {
  overview: string;
  rentalIncludes: string[];
  rentalExcludes: string[];
  pickupDetails: string;
  dropoffDetails: string;
  driverRequirements: string[];
  insuranceInfo: string;
  cancellationPolicy: string;
  additionalFees: string[];
  operatingHours: string;
  pickupTimes: string[];
  dropoffTimes: string[];
}

interface FlightDetailContent {
  overview: string;
  includes: string[];
  excludes: string[];
  departureInfo: string;
  arrivalInfo: string;
  layoverInfo: string;
  baggageInfo: string;
  cancellationPolicy: string;
  fareRules: string[];
}

interface TrainDetailContent {
  overview: string;
  includes: string[];
  excludes: string[];
  departureInfo: string;
  arrivalInfo: string;
  onboardInfo: string;
  cancellationPolicy: string;
  fareRules: string[];
}

interface BusDetailContent {
  overview: string;
  includes: string[];
  excludes: string[];
  departureInfo: string;
  arrivalInfo: string;
  onboardInfo: string;
  cancellationPolicy: string;
  fareRules: string[];
}

interface AlternativeBus {
  id: string;
  carrier: string;
  depDate: string;
  depTime: string;
  depLocation: string;
  arrDate: string;
  arrTime: string;
  arrLocation: string;
  duration: string;
  stops: string;
  class: string;
  seatType: string;
  operator: string;
  rating: string;
  refundable: string;
  price: number;
  imageUrl?: string;
}

@Component({
    selector: 'app-itinerary-page',
    imports: [CommonModule, RouterLink, ItineraryPdfTemplateComponent, LoadingOverlayComponent, DragDropModule, FooterSectionComponent, ItineraryMapComponent, SharePanelComponent, TranslatePipe, ItineraryHeaderComponent, CurrencyConverterPipe, ItineraryTimelineComponent, TripVersionHistoryComponent, TripCommentsComponent, ModalComponent],
    templateUrl: "./itinerary-page.component.html",
    styles: [`
    .cdk-drag-preview {
      box-shadow: 0 5px 5px -3px rgba(0, 0, 0, 0.2),
                  0 8px 10px 1px rgba(0, 0, 0, 0.14),
                  0 3px 14px 2px rgba(0, 0, 0, 0.12);
      border-radius: 12px;
    }
    .cdk-drag-placeholder {
      opacity: 0.3;
    }
    .cdk-drag-animating {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }
    .cdk-drop-list-dragging .cdk-drag {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }
    .cdk-drag-item {
      cursor: grab;
    }
    .cdk-drag-item:active {
      cursor: grabbing;
    }
  `]
})
export class ItineraryPageComponent implements OnInit, OnDestroy {
  private dayObserver: IntersectionObserver | null = null;
  private tabObserver: IntersectionObserver | null = null;
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tripService = inject(TripService);
  private readonly transferPlan = inject(TransferPlanService);
  private readonly itineraryPdfService = inject(ItineraryPdfService);
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LocaleService);
  private readonly chatContext = inject(ChatContextService);
  private readonly chatLearning = inject(ChatLearningService);
  private readonly collaborationService = inject(CollaborationService);
  private readonly authService = inject(AuthService);
  private readonly travelNextActivities = inject(TravelNextActivitiesService);
  private readonly travelomatixHotels = inject(TravelomatixHotelsService);
  private readonly travelNextCars = inject(TravelNextCarsService);
  readonly generationProgress = inject(GenerationProgressService);
  readonly tripPresence = inject(TripPresenceService);
  readonly versionHistoryOpen = signal(false);
  readonly commentsDay = signal<number | null>(null);
  /** Hide page FABs while the global chat dock is open so they don't stack under bubbles. */
  readonly chatOpen = this.chatContext.chatOpen;

  // Custom Edit Modals State
  showTravelerCountModal = signal(false);
  travelerCountInput = signal('');
  showDateEditModal = signal(false);
  dateStartInput = signal('');
  dateEndInput = signal('');

  // -- State Store -----------------------------------------------------------
  readonly store = inject(ItineraryStore);

  // -- Collaboration signals --------------------------------------------------
  readonly sharePanelOpen = this.store.sharePanelOpen;
  readonly tripIsConfirmed = this.store.tripIsConfirmed;
  readonly myCollabRole = this.store.myCollabRole;
  readonly sharePanelCloseHandler = () => this.sharePanelOpen.set(false);
  readonly activeCollaborators = computed(() => {
    return this.collaborationService.collaborators().filter(c => c.status === 'active');
  });
  private lastChatRebuildTick = 0;
  private lastChatEditVersion = 0;
  private lastChatRegenerateTick = 0;
  private lastChatNoteVersion = 0;
  private lastBookTripTick = 0;
  private lastCurrencyEpoch = 0;
  /** Place-stop fingerprint → triggers async fare refresh when activities/hotels change. */
  private lastTransferPlaceFingerprint = '';
  private transferFareRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private syncQueue: Promise<boolean> = Promise.resolve(true);
  /** Serialize segment-mutating transfer replans (parallel day updates can clobber each other). */
  private transferPlanQueue: Promise<void> = Promise.resolve();
  private dayOf(value: unknown): number {
    return Number(value) || 1;
  }

  private enqueueTransferPlan(dayDay: number, opts?: { silent?: boolean }): Promise<void> {
    const run = () => this.autoPlanTransferAfterActivityChange(dayDay, opts);
    const queued = this.transferPlanQueue.then(run, run);
    this.transferPlanQueue = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  }
  
  private flightSearchId = 0;
  private hotelSearchId = 0;
  private carSearchId = 0;
  private trainSearchId = 0;
  private busSearchId = 0;
  private activitySearchId = 0;
  /** Skip pushing a URL fragment while restoring view mode from browser back/forward. */
  private suppressViewModeUrlSync = false;

  readonly tripNotes = this.store.tripNotes;

  @ViewChild('pdfExportRoot') private pdfExportRoot?: ElementRef<HTMLElement>;

  readonly pdfExportData = this.store.pdfExportData;
  readonly pdfDownloading = this.store.pdfDownloading;
  readonly isBooked = this.store.isBooked;
  readonly bookingInProgress = this.store.bookingInProgress;
  readonly loadingSwap = this.store.loadingSwap;

  trip: SavedTrip | null = null;

  // Initial itinerary fetch states (distinct from pdfDownloading).
  readonly tripLoading = this.store.tripLoading;
  readonly tripLoadError = this.store.tripLoadError;
  /** Bumped when `trip.segments` is mutated so `displayedDays` recomputes. */
  readonly tripSegmentsVersion = this.store.tripSegmentsVersion;
  /** Bumped after ngx-translate finishes loading a language so instant() strings refresh. */
  private readonly langTick = signal(0);

  // True inventory-search failure (network/server), surfaced by TripService so
  // the swap views can distinguish a failure from a genuinely-empty result.
  readonly inventoryError = this.tripService.inventoryError;
  // Captures the last inventory fetch so the swap views can offer a retry.
  private lastInventoryFetch: (() => void) | null = null;

  retryInventory(): void {
    this.lastInventoryFetch?.();
  }

  readonly tripStartDate = this.store.tripStartDate;

  private buildPdfFaq(): { question: string; answer: string }[] {
    return [1, 2, 3, 4, 5].map((n) => ({
      question: this.translate.instant(`ITINERARY.PDF.FAQ_Q${n}_QUESTION`),
      answer: this.translate.instant(`ITINERARY.PDF.FAQ_Q${n}_ANSWER`),
    }));
  }

  constructor() {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.langTick.update((n) => n + 1);
    });
    effect(() => {
      const tick = this.chatContext.itineraryRebuildRequested();
      if (tick > this.lastChatRebuildTick) {
        this.lastChatRebuildTick = tick;
        void this.retryLoad();
      }
      // retryLoad() sets tripLoading synchronously (before its first await), which
      // runs inside this effect's tracking window and needs to opt into signal writes.
    }, { allowSignalWrites: true });
    effect(() => {
      const tick = this.chatContext.itineraryRegenerateRequested();
      if (tick > this.lastChatRegenerateTick) {
        this.lastChatRegenerateTick = tick;
        void this.waitForRegeneration();
      }
      // waitForRegeneration() sets tripLoading synchronously — same reason as above.
    }, { allowSignalWrites: true });
    effect(() => {
      const tick = this.chatContext.bookTripRequested();
      if (tick > this.lastBookTripTick) {
        this.lastBookTripTick = tick;
        void this.bookCompleteItinerary();
      }
      // bookCompleteItinerary() sets bookingInProgress synchronously — same reason as above.
    }, { allowSignalWrites: true });
    effect(() => {
      const epoch = this.locale.currencyEpoch();
      if (epoch <= this.lastCurrencyEpoch) return;
      this.lastCurrencyEpoch = epoch;
      const tripId = this.trip?.id || this.route.snapshot.paramMap.get('id');
      if (tripId) {
        void this.updateTripState(tripId);
      }
      this.retryInventory();
      // updateTripState() sets tripLoading synchronously — opt into signal writes.
    }, { allowSignalWrites: true });
    effect(() => {
      const version = this.chatContext.tripNoteVersion();
      if (version <= this.lastChatNoteVersion) return;
      this.lastChatNoteVersion = version;
      const notes = this.chatContext.drainTripNotes();
      if (!notes.length) return;
      void (async () => {
        for (const entry of notes) {
          await this.applyTripNote(entry.note, entry.day);
        }
      })();
      // applyTripNote() -> waitForTripReady() can reach updateTripState(), which
      // sets tripLoading synchronously before its first await — that write lands
      // inside this effect's tracking window, so it must opt into signal writes.
    }, { allowSignalWrites: true });
    effect(() => {
      const version = this.chatContext.itineraryEditVersion();
      if (version <= this.lastChatEditVersion) return;
      this.lastChatEditVersion = version;
      const edits = this.chatContext.drainItineraryEdits();
      if (!edits.length) return;
      void (async () => {
        const ready = await this.waitForTripReady();
        if (!ready) {
          this.toast.error(this.translate.instant('ITINERARY.TOAST.STILL_LOADING_RETRY'));
          return;
        }
        for (const edit of edits) {
          await this.applyItineraryEdit(edit);
        }
        await this.syncCustomizationsToBackend();
        this.toast.success(this.translate.instant('ITINERARY.TOAST.UPDATED_FROM_CHAT'));
      })();
      // Same reason as above — waitForTripReady() can synchronously reach updateTripState().
    }, { allowSignalWrites: true });
    this.initializeTripContext();
    effect(() => {
      if (this.suppressViewModeUrlSync) return;
      const mode = this.viewMode();
      const tripId = this.trip?.id;
      if (!tripId) return;

      const currentFrag = this.route.snapshot.fragment ?? null;
      const targetFrag = mode === 'itinerary' ? null : mode;

      if (currentFrag !== targetFrag) {
        this.router.navigate([], {
          fragment: targetFrag ?? undefined,
          replaceUrl: false,
          queryParamsHandling: 'merge',
        });
      }
    });
    effect(() => {
      this.displayedDays();
      setTimeout(() => this.setupScrollSpy(), 500);
    });
    // When place/transport stops change order or identity, refresh transfer fares.
    effect(() => {
      const days = this.displayedDays();
      if (!days.length || !this.trip) return;
      const fingerprint = days
        .map((d) => {
          const places = d.items
            .filter(
              (i) =>
                i.type === 'activity' ||
                i.type === 'hotel' ||
                i.type === 'flight' ||
                i.type === 'train' ||
                i.type === 'bus',
            )
            .map((i) => {
              if (i.type === 'activity') {
                return `a:${(i as DetailActivity).title}|${(i as DetailActivity).location}`;
              }
              if (i.type === 'hotel') {
                return `h:${(i as DetailHotel).name}|${(i as DetailHotel).location}`;
              }
              if (i.type === 'train') {
                const t = i as DetailTrain;
                return `t:${t.depLocation}->${t.arrLocation}|${t.depTime}`;
              }
              if (i.type === 'bus') {
                const b = i as DetailBus;
                return `b:${b.depLocation}->${b.arrLocation}|${b.depTime}`;
              }
              const f = i as DetailFlight;
              return `f:${f.depCode}->${f.arrCode}|${f.flightNo}`;
            })
            .join('>');
          return `${d.day}:${places}`;
        })
        .join('||');
      if (fingerprint === this.lastTransferPlaceFingerprint) return;
      this.lastTransferPlaceFingerprint = fingerprint;

      // Any day with a car + place/transport stops should replan when neighbors change.
      const daysNeedingFare = days.filter((d) => {
        const hasPlace = d.items.some(
          (i) =>
            i.type === 'activity' ||
            i.type === 'hotel' ||
            i.type === 'flight' ||
            i.type === 'train' ||
            i.type === 'bus',
        );
        return hasPlace && d.items.some((i) => i.type === 'car');
      });
      if (!daysNeedingFare.length) return;

      if (this.transferFareRefreshTimer) clearTimeout(this.transferFareRefreshTimer);
      this.transferFareRefreshTimer = setTimeout(() => {
        void (async () => {
          for (const d of daysNeedingFare) {
            await this.enqueueTransferPlan(d.day, { silent: true });
          }
        })();
      }, 300);
    });
  }

  ngOnDestroy(): void {
    this.dayObserver?.disconnect();
    this.tabObserver?.disconnect();
    if (this.transferFareRefreshTimer) clearTimeout(this.transferFareRefreshTimer);
    if (this.trip) this.tripPresence.leave(this.trip.id);
    this.chatContext.clearTripPageContext();
  }

  private setupScrollSpy(): void {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;

    this.dayObserver?.disconnect();
    this.tabObserver?.disconnect();

    this.dayObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const id = visible[0].target.id;
          if (id === 'overview') {
            this.activeDayTab.set('summary');
          } else if (id.startsWith('day-')) {
            const dayNum = parseInt(id.replace('day-', ''), 10);
            if (!isNaN(dayNum)) {
              this.activeDayTab.set(dayNum);
            }
          }
        }
      },
      { rootMargin: '-140px 0px -70% 0px', threshold: 0 }
    );

    const overviewEl = document.getElementById('overview');
    if (overviewEl && this.dayObserver) this.dayObserver.observe(overviewEl);

    for (const day of this.displayedDays()) {
      const el = document.getElementById(`day-${day.day}`);
      if (el && this.dayObserver) this.dayObserver.observe(el);
    }

    this.tabObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const id = visible[0].target.id;
          if (['overview', 'checklist', 'inclusions'].includes(id)) {
            this.activeTab.set(id as any);
          }
        }
      },
      { rootMargin: '-140px 0px -70% 0px', threshold: 0 }
    );

    ['overview', 'checklist', 'inclusions'].forEach((id) => {
      const el = document.getElementById(id);
      if (el && this.tabObserver) this.tabObserver.observe(el);
    });
  }

  // =============================================
  // SWAP FLIGHT STATE
  // =============================================
  readonly viewMode = this.store.viewMode;
  readonly swappingFlightRef = this.store.swappingFlightRef;
  readonly swappedFlights = this.store.swappedFlights;
  readonly selectedFlightDetail = this.store.selectedFlightDetail;
  readonly flightDetailTravelers = this.store.flightDetailTravelers;

  readonly flightDetailContent = computed((): FlightDetailContent => {
    const flight = this.selectedFlightDetail();
    if (!flight) {
      return {
        overview: '',
        includes: [],
        excludes: [],
        departureInfo: '',
        arrivalInfo: '',
        layoverInfo: '',
        baggageInfo: '',
        cancellationPolicy: '',
        fareRules: [],
      };
    }
    return this.buildFlightDetailContent(flight);
  });

  readonly flightDetailTotal = computed(() => {
    const flight = this.selectedFlightDetail();
    if (!flight) return 0;
    return flight.price * this.flightDetailTravelers();
  });

  // Activity Swapping and Addition State
  readonly swappingActivityRef = this.store.swappingActivityRef;
  readonly swappedActivities = this.store.swappedActivities;
  readonly addedActivities = this.store.addedActivities;
  readonly addedTransport = this.store.addedTransport;
  readonly removedItemKeys = this.store.removedItemKeys;
  readonly addingTransportRef = this.store.addingTransportRef;
  readonly customItemOrder = this.store.customItemOrder;

  readonly transportModeOptions = [
    { id: 'flight' as const, labelKey: 'ITINERARY.DAY.MODE_FLIGHT' },
    { id: 'train' as const, labelKey: 'ITINERARY.DAY.MODE_TRAIN' },
    { id: 'bus' as const, labelKey: 'ITINERARY.DAY.MODE_BUS' },
    { id: 'car' as const, labelKey: 'ITINERARY.DAY.MODE_CAR' },
  ];

  /** Which inventory catalog the activity swap panel is browsing. */
  readonly activityInventoryKind = signal<'activity' | 'event' | 'cruise' | 'holiday'>('activity');

  readonly activityBrowseCopy = computed(() => {
    const kind = this.activityInventoryKind();
    if (kind === 'event') {
      return {
        addIn: 'ITINERARY.ACTIVITY.ADD_EVENT_IN',
        found: 'ITINERARY.ACTIVITY.EVENTS_FOUND',
        searchPlaceholder: 'ITINERARY.ACTIVITY.SEARCH_EVENTS_PLACEHOLDER',
        searching: 'ITINERARY.ACTIVITY.SEARCHING_EVENTS',
        noMatch: 'ITINERARY.ACTIVITY.NO_EVENTS_MATCH_FILTERS',
        back: 'ITINERARY.ACTIVITY.BACK_TO_EVENTS',
        select: 'ITINERARY.ACTIVITY.SELECT_EVENT',
      };
    }
    if (kind === 'cruise') {
      return {
        addIn: 'ITINERARY.ACTIVITY.ADD_CRUISE_IN',
        found: 'ITINERARY.ACTIVITY.CRUISES_FOUND',
        searchPlaceholder: 'ITINERARY.ACTIVITY.SEARCH_CRUISES_PLACEHOLDER',
        searching: 'ITINERARY.ACTIVITY.SEARCHING_CRUISES',
        noMatch: 'ITINERARY.ACTIVITY.NO_CRUISES_MATCH_FILTERS',
        back: 'ITINERARY.ACTIVITY.BACK_TO_CRUISES',
        select: 'ITINERARY.ACTIVITY.SELECT_CRUISE',
      };
    }
    if (kind === 'holiday') {
      return {
        addIn: 'ITINERARY.ACTIVITY.ADD_HOLIDAY_IN',
        found: 'ITINERARY.ACTIVITY.HOLIDAYS_FOUND',
        searchPlaceholder: 'ITINERARY.ACTIVITY.SEARCH_HOLIDAYS_PLACEHOLDER',
        searching: 'ITINERARY.ACTIVITY.SEARCHING_HOLIDAYS',
        noMatch: 'ITINERARY.ACTIVITY.NO_HOLIDAYS_MATCH_FILTERS',
        back: 'ITINERARY.ACTIVITY.BACK_TO_HOLIDAYS',
        select: 'ITINERARY.ACTIVITY.SELECT_HOLIDAY',
      };
    }
    return {
      addIn: 'ITINERARY.ACTIVITY.ADD_ACTIVITY_IN',
      found: 'ITINERARY.ACTIVITY.ACTIVITIES_FOUND',
      searchPlaceholder: 'ITINERARY.ACTIVITY.SEARCH_ACTIVITIES_PLACEHOLDER',
      searching: 'ITINERARY.ACTIVITY.SEARCHING_ACTIVITIES',
      noMatch: 'ITINERARY.ACTIVITY.NO_ACTIVITIES_MATCH_FILTERS',
      back: 'ITINERARY.ACTIVITY.BACK_TO_ACTIVITIES',
      select: 'ITINERARY.ACTIVITY.SELECT_ACTIVITY',
    };
  });

  // Filters for Activities
  readonly activityPriceFilter = this.store.activityPriceFilter;
  readonly activityTimeFilter = this.store.activityTimeFilter;
  readonly activityDurationFilter = this.store.activityDurationFilter;
  readonly activityTypeFilter = this.store.activityTypeFilter;
  readonly activityLocationFilter = this.store.activityLocationFilter;
  readonly activityHighlightFilter = this.store.activityHighlightFilter;
  readonly activitySearch = this.store.activitySearch;

  readonly activityTimeOptions = [
    { value: 'Morning', label: 'ITINERARY.ACTIVITY.TIME_MORNING' },
    { value: 'Noon', label: 'ITINERARY.ACTIVITY.TIME_NOON' },
    { value: 'Evening', label: 'ITINERARY.ACTIVITY.TIME_EVENING' },
    { value: 'Night', label: 'ITINERARY.ACTIVITY.TIME_NIGHT' },
  ];
  readonly activityDurationOptions = [
    { value: 'Up to 1 hour', label: 'ITINERARY.ACTIVITY.DURATION_UP_TO_1H' },
    { value: 'Up to 3 hours', label: 'ITINERARY.ACTIVITY.DURATION_UP_TO_3H' },
    { value: 'Up to 6 hours', label: 'ITINERARY.ACTIVITY.DURATION_UP_TO_6H' },
    { value: 'Up to 12 hours', label: 'ITINERARY.ACTIVITY.DURATION_UP_TO_12H' },
    { value: 'Up to 24 hours', label: 'ITINERARY.ACTIVITY.DURATION_UP_TO_24H' },
  ];
  readonly activityTypeOptions = [
    { value: 'Historical attractions', label: 'ITINERARY.ACTIVITY.ATTRACTION_HISTORICAL' },
    { value: 'Cultural institutions', label: 'ITINERARY.ACTIVITY.ATTRACTION_CULTURAL' },
    { value: 'Nature and wildlife', label: 'ITINERARY.ACTIVITY.ATTRACTION_NATURE' },
    { value: 'Sightseeing tours', label: 'ITINERARY.ACTIVITY.ATTRACTION_SIGHTSEEING' },
    { value: 'Leisure activities', label: 'ITINERARY.ACTIVITY.ATTRACTION_LEISURE' },
    { value: 'Outdoor activities', label: 'ITINERARY.ACTIVITY.ATTRACTION_OUTDOOR' },
    { value: 'Sky bound experiences', label: 'ITINERARY.ACTIVITY.ATTRACTION_SKY' },
    { value: 'Water sports', label: 'ITINERARY.ACTIVITY.ATTRACTION_WATER' },
    { value: 'Exhibitions & events Parks', label: 'ITINERARY.ACTIVITY.ATTRACTION_EXHIBITIONS' },
  ];
  readonly activityLocationOptions = [
    { value: 'Near Your Hotel', label: 'ITINERARY.ACTIVITY.LOCATION_NEAR_HOTEL' },
    { value: 'In City Center', label: 'ITINERARY.ACTIVITY.LOCATION_CITY_CENTER' },
    { value: 'Outside City', label: 'ITINERARY.ACTIVITY.LOCATION_OUTSIDE_CITY' },
  ];
  readonly activityHighlightOptions = [
    { value: 'Popular', label: 'ITINERARY.ACTIVITY.POPULAR' },
    { value: 'Last-Minute Available', label: 'ITINERARY.ACTIVITY.LAST_MINUTE_AVAILABLE' },
    { value: 'Rated 4.5+', label: 'ITINERARY.ACTIVITY.RATING_45_PLUS' },
    { value: 'Local Expert', label: 'ITINERARY.ACTIVITY.LOCAL_EXPERT' },
  ];
  readonly selectedActivityDetail = this.store.selectedActivityDetail;
  readonly activityGalleryIndex = this.store.activityGalleryIndex;
  readonly activityDetailTravelers = this.store.activityDetailTravelers;
  readonly activityDetailTimeSlot = this.store.activityDetailTimeSlot;

  readonly activityDetailContent = computed((): ActivityDetailContent => {
    const act = this.selectedActivityDetail();
    if (!act) {
      return {
        overview: '',
        highlights: [],
        included: [],
        notIncluded: [],
        meetingPoint: '',
        pickupInfo: '',
        cancellationPolicy: '',
        gallery: [],
        reviewCount: 0,
        languages: [],
        timeSlots: [],
        maxGroupSize: 15,
      };
    }
    return this.buildActivityDetailContent(act);
  });

  readonly activityDetailTotal = computed(() => {
    const act = this.selectedActivityDetail();
    if (!act || act.contentOnly || act.price <= 0) return 0;
    return act.price * this.activityDetailTravelers();
  });

  // Hotel Swapping State
  readonly swappingHotelRef = this.store.swappingHotelRef;
  readonly swappedHotels = this.store.swappedHotels;
  readonly selectedHotelDetail = this.store.selectedHotelDetail;
  readonly selectedHotelBedId = this.store.selectedHotelBedId;

  readonly hotelDetailContent = computed((): HotelDetailContent => {
    const hotel = this.selectedHotelDetail();
    if (!hotel) {
      return {
        gallery: [],
        reviewCount: 0,
        address: '',
        displayDate: '',
        checkInLabel: '',
        checkOutLabel: '',
        facilityColumns: [],
        overviewParagraphs: [],
        roomTypes: [],
      };
    }
    return this.buildHotelDetailContent(hotel);
  });

  readonly selectedHotelBed = computed(() => {
    const bedId = this.selectedHotelBedId();
    for (const room of this.hotelDetailContent().roomTypes) {
      const bed = room.beds.find((b) => b.id === bedId);
      if (bed) return bed;
    }
    return this.hotelDetailContent().roomTypes[0]?.beds[0] ?? null;
  });

  // Filters for Hotels
  readonly hotelPriceFilter = this.store.hotelPriceFilter;
  readonly hotelRatingFilter = this.store.hotelRatingFilter;
  readonly hotelAmenitiesFilter = this.store.hotelAmenitiesFilter;
  readonly hotelTypeFilter = this.store.hotelTypeFilter;
  readonly hotelPolicyFilter = this.store.hotelPolicyFilter;
  readonly hotelDistanceFilter = this.store.hotelDistanceFilter;
  readonly hotelBedFilter = this.store.hotelBedFilter;
  readonly hotelAreaFilter = this.store.hotelAreaFilter;
  readonly hotelSearch = this.store.hotelSearch;
  readonly hotelSort = this.store.hotelSort;
  readonly hotelSortOpen = this.store.hotelSortOpen;
  readonly tpExclusive = this.store.tpExclusive;
  readonly hotelCurrentPage = this.store.hotelCurrentPage;
  readonly hotelPageSize = 10;

  readonly hotelTypeOptions = [
    { value: 'Hotel', label: 'ITINERARY.HOTEL.TYPE_HOTEL' },
    { value: 'Apartment', label: 'ITINERARY.HOTEL.TYPE_APARTMENT' },
    { value: 'Resort', label: 'ITINERARY.HOTEL.TYPE_RESORT' },
    { value: 'Villa', label: 'ITINERARY.HOTEL.TYPE_VILLA' },
    { value: 'Hostels', label: 'ITINERARY.HOTEL.TYPE_HOSTELS' },
    { value: 'Guest House', label: 'ITINERARY.HOTEL.TYPE_GUEST_HOUSE' },
    { value: 'Budget', label: 'ITINERARY.HOTEL.TYPE_BUDGET' },
  ];
  readonly hotelAmenityOptions = [
    { value: 'Free Wi-Fi', label: 'ITINERARY.HOTEL.AMENITY_WIFI' },
    { value: 'Air Conditioning', label: 'ITINERARY.HOTEL.AMENITY_AC' },
    { value: 'Parking', label: 'ITINERARY.HOTEL.AMENITY_PARKING' },
    { value: 'Pet-Friendly', label: 'ITINERARY.HOTEL.AMENITY_PET_FRIENDLY' },
    { value: 'Restaurant', label: 'ITINERARY.HOTEL.AMENITY_RESTAURANT' },
    { value: 'Spa', label: 'ITINERARY.HOTEL.AMENITY_SPA' },
    { value: 'Pool', label: 'ITINERARY.HOTEL.AMENITY_POOL' },
    { value: 'Bar', label: 'ITINERARY.HOTEL.AMENITY_BAR' },
    { value: 'Gym', label: 'ITINERARY.HOTEL.AMENITY_GYM' },
  ];
  readonly hotelPolicyOptions = [
    { value: 'Free Cancellation', label: 'ITINERARY.HOTEL.POLICY_FREE_CANCELLATION' },
    { value: 'No prepayment', label: 'ITINERARY.HOTEL.POLICY_NO_PREPAYMENT' },
  ];
  readonly hotelDistanceOptions = [
    { value: 'Less than 1 km', label: 'ITINERARY.HOTEL.DISTANCE_1KM' },
    { value: 'Less than 3 km', label: 'ITINERARY.HOTEL.DISTANCE_3KM' },
    { value: 'Less than 5 km', label: 'ITINERARY.HOTEL.DISTANCE_5KM' },
  ];
  readonly hotelBedOptions = [
    { value: '1 double bed', label: 'ITINERARY.HOTEL.BED_DOUBLE_1' },
    { value: 'Twin bed', label: 'ITINERARY.HOTEL.BED_TWIN' },
    { value: 'Double bed', label: 'ITINERARY.HOTEL.BED_DOUBLE' },
  ];
  // Some entries are proper place names left untranslated (no `label` key -> template falls back to `value`).
  readonly hotelAreaOptions: { value: string; label?: string }[] = [
    { value: "Guests' favourite area", label: 'ITINERARY.HOTEL.AREA_FAVOURITE' },
    { value: 'Paris City Centre' },
    { value: 'Best areas outside centre', label: 'ITINERARY.HOTEL.AREA_OUTSIDE_CENTRE' },
    { value: '15th arr' },
    { value: '17th arr' },
    { value: 'Centro' },
    { value: 'Retiro' },
    { value: 'Salamanca' },
    { value: 'Chamberi' },
    { value: 'Barajas' },
  ];

  // Train Swapping State
  readonly swappingTrainRef = this.store.swappingTrainRef;
  readonly swappedTrains = this.store.swappedTrains;
  readonly selectedTrainDetail = this.store.selectedTrainDetail;
  readonly trainDetailTravelers = this.store.trainDetailTravelers;

  readonly trainDetailContent = computed((): TrainDetailContent => {
    const train = this.selectedTrainDetail();
    if (!train) {
      return {
        overview: '',
        includes: [],
        excludes: [],
        departureInfo: '',
        arrivalInfo: '',
        onboardInfo: '',
        cancellationPolicy: '',
        fareRules: [],
      };
    }
    return this.buildTrainDetailContent(train);
  });

  readonly trainDetailTotal = computed(() => {
    const train = this.selectedTrainDetail();
    if (!train) return 0;
    return train.price * this.trainDetailTravelers();
  });

  // Car Swapping State
  readonly swappingCarRef = this.store.swappingCarRef;
  readonly swappedCars = this.store.swappedCars;
  
  readonly selectedCarDetail = this.store.selectedCarDetail;

  // Bus Swapping State
  readonly swappingBusRef = this.store.swappingBusRef;
  readonly swappedBuses = this.store.swappedBuses;
  readonly selectedBusDetail = this.store.selectedBusDetail;
  readonly busDetailTravelers = this.store.busDetailTravelers;

  readonly busDetailContent = computed((): BusDetailContent => {
    const bus = this.selectedBusDetail();
    if (!bus) {
      return {
        overview: '',
        includes: [],
        excludes: [],
        departureInfo: '',
        arrivalInfo: '',
        onboardInfo: '',
        cancellationPolicy: '',
        fareRules: [],
      };
    }
    return this.buildBusDetailContent(bus);
  });

  readonly busDetailTotal = computed(() => {
    const bus = this.selectedBusDetail();
    if (!bus) return 0;
    return bus.price * this.busDetailTravelers();
  });

  // Filters for Flights
  readonly stopsFilter = signal<string[]>([]);
  readonly classFilter = signal<string[]>([]);
  readonly departureFilter = signal<string[]>([]);
  readonly airlineFilter = signal<string[]>([]);
  readonly fareFilter = signal<string[]>([]);
  readonly flightSearch = signal<string>('');

  // Filter option lists (matching Figma)
  readonly stopOptions = [
    { value: 'Direct', label: 'ITINERARY.FILTERS.STOP_DIRECT' },
    { value: '1 Stop', label: 'ITINERARY.FILTERS.STOP_1' },
    { value: '2 Stops', label: 'ITINERARY.FILTERS.STOP_2' },
  ];
  readonly classOptions = [
    { value: 'Economy', label: 'ITINERARY.FLIGHT.CLASS_ECONOMY' },
    { value: 'Premium', label: 'ITINERARY.FLIGHT.CLASS_PREMIUM' },
    { value: 'First Class', label: 'ITINERARY.FLIGHT.CLASS_FIRST' },
    { value: 'Business Class', label: 'ITINERARY.FLIGHT.CLASS_BUSINESS' },
  ];
  readonly departureTimeOptions = [
    { value: 'before-6', label: 'ITINERARY.FILTERS.TIME_BEFORE_6AM' },
    { value: '6-12', label: 'ITINERARY.FILTERS.TIME_6_12' },
    { value: '12-18', label: 'ITINERARY.FILTERS.TIME_12_18' },
    { value: 'after-18', label: 'ITINERARY.FILTERS.TIME_AFTER_6PM' },
  ];
  readonly airlineOptions = [
    'Emirates', 'Qatar Airways', 'American Airlines', 'Vueling Airlines',
    'Lufthansa', 'Air France', 'British Airways', 'IndiGo', 'Air Europa',
    'Air India', 'Singapore Airlines', 'Turkish Airlines', 'United Airlines',
    'Delta Air Lines', 'Jet Airways', 'Sri Lankan Airlines',
  ];
  readonly fareTypeOptions = [
    { value: 'Refundable', label: 'ITINERARY.FILTERS.FARE_REFUNDABLE' },
    { value: 'Non-Refundable', label: 'ITINERARY.FILTERS.FARE_NON_REFUNDABLE' },
  ];

  // Master list of alternative flights (from Figma node 1263:45520)
  
  // =============================================
  // TRAIN SWAPPING FILTERS, OPTIONS, LISTS, ACTIONS
  // =============================================
  readonly trainStopsFilter = signal<string[]>([]);
  readonly trainClassFilter = signal<string[]>([]);
  readonly trainDepartureFilter = signal<string[]>([]);
  readonly trainOperatorFilter = signal<string[]>([]);
  readonly trainFareFilter = signal<string[]>([]);
  readonly trainSearch = signal<string>('');

  readonly trainStopOptions = [
    { value: 'Direct', label: 'ITINERARY.FILTERS.STOP_DIRECT' },
    { value: '1 Stop', label: 'ITINERARY.FILTERS.STOP_1' },
    { value: '2 Stops', label: 'ITINERARY.FILTERS.STOP_2' },
  ];
  readonly trainClassOptions = [
    { value: 'Sleeper', label: 'ITINERARY.TRAIN.CLASS_SLEEPER' },
    { value: 'AC Chair Car', label: 'ITINERARY.TRAIN.CLASS_AC_CHAIR_CAR' },
    { value: 'AC Tier 1', label: 'ITINERARY.TRAIN.CLASS_AC_TIER_1' },
    { value: 'AC Tier 2', label: 'ITINERARY.TRAIN.CLASS_AC_TIER_2' },
    { value: 'AC Tier 3', label: 'ITINERARY.TRAIN.CLASS_AC_TIER_3' },
  ];
  readonly trainOperatorOptions = ['AVE', 'TGV | inoui', 'Renfe', 'Ouigo', 'Iryo'];
  readonly trainFareOptions = [
    { value: 'Refundable', label: 'ITINERARY.FILTERS.FARE_REFUNDABLE' },
    { value: 'Non-Refundable', label: 'ITINERARY.FILTERS.FARE_NON_REFUNDABLE' },
  ];

  
  readonly filteredTrains = computed(() => {
    let trains = this.contextualTrains();
    const stops = this.trainStopsFilter();
    const cls = this.trainClassFilter();
    const dep = this.trainDepartureFilter();
    const operator = this.trainOperatorFilter();
    const fare = this.trainFareFilter();
    const search = this.trainSearch().toLowerCase().trim();

    if (stops.length > 0) {
      trains = trains.filter(t => stops.includes(t.stops));
    }
    if (cls.length > 0) {
      trains = trains.filter(t => cls.includes(t.class));
    }
    if (dep.length > 0) {
      trains = trains.filter(t => dep.includes(this.depTimeToBucket(t.depTime)));
    }
    if (operator.length > 0) {
      trains = trains.filter(t => operator.includes(t.carrier));
    }
    if (fare.length > 0) {
      trains = trains.filter(t => fare.some(f => t.refundable.toLowerCase().includes(f.toLowerCase())));
    }
    if (search) {
      trains = trains.filter(t =>
        t.carrier.toLowerCase().includes(search) ||
        t.depLocation.toLowerCase().includes(search) ||
        t.arrLocation.toLowerCase().includes(search)
      );
    }
    return trains;
  });

  readonly hasActiveTrainFilters = computed(() =>
    this.trainStopsFilter().length > 0 ||
    this.trainClassFilter().length > 0 ||
    this.trainDepartureFilter().length > 0 ||
    this.trainOperatorFilter().length > 0 ||
    this.trainFareFilter().length > 0
  );

  toggleTrainStopsFilter(value: string): void {
    const current = this.trainStopsFilter();
    this.trainStopsFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  toggleTrainClassFilter(value: string): void {
    const current = this.trainClassFilter();
    this.trainClassFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  toggleTrainDepartureFilter(value: string): void {
    const current = this.trainDepartureFilter();
    this.trainDepartureFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  toggleTrainOperatorFilter(value: string): void {
    const current = this.trainOperatorFilter();
    this.trainOperatorFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  toggleTrainFareFilter(value: string): void {
    const current = this.trainFareFilter();
    this.trainFareFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  clearAllTrainFilters(): void {
    this.trainStopsFilter.set([]);
    this.trainClassFilter.set([]);
    this.trainDepartureFilter.set([]);
    this.trainOperatorFilter.set([]);
    this.trainFareFilter.set([]);
    this.trainSearch.set('');
  }

  startTrainSwap(dayDay: number, itemIndex: number): void {
    this.lastInventoryFetch = () => this.startTrainSwap(dayDay, itemIndex);
    const days = this.displayedDays();
    const day = days.find(d => d.day === dayDay);
    if (!day) return;
    const item = day.items[itemIndex];
    if (!item || item.type !== 'train') return;
    this.selectedTrainDetail.set(null);
    this.swappingTrainRef.set({ dayDay, itemIndex });
    this.clearAllTrainFilters();
    this.viewMode.set('swap-train');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Fetch dynamic train inventory
    this.contextualTrains.set([]);
    this.loadingSwap.set(true);
    const searchId = ++this.trainSearchId;
    this.tripService.searchInventory({
      type: 'train',
      dep: (item as DetailTrain).depLocation,
      arr: (item as DetailTrain).arrLocation,
      budget: this.budgetOption() || this.trip?.budget || 'standard',
    }).then(results => {
      if (searchId !== this.trainSearchId) return;
      const mapped = results.map(r => {
        const details = r.details || {};
        return {
          id: r.id || crypto.randomUUID(),
          carrier: String(details['operator'] || details['carrier'] || r.provider),
          trainNo: String(details['flight_number'] || r.title),
          class: String(details['cabin_class'] || 'Standard'),
          refundable: 'Non-Refundable',
          depDate: (item as DetailTrain).depDate,
          depTime: r.start_time || details['start_time'] || '09:00',
          depLocation: String(details['depLocation'] || details['departure'] || (item as DetailTrain).depLocation),
          arrDate: (item as DetailTrain).arrDate,
          arrTime: r.end_time || details['end_time'] || '13:00',
          arrLocation: String(details['arrLocation'] || details['arrival'] || (item as DetailTrain).arrLocation),
          duration: r.duration || details['duration'] || '4h 00m',
          stops: 'Direct',
          price: typeof r.price === 'object' ? (r.price?.amount ?? 0) : (r.price ?? 0),
          emission: '30 kg CO2',
          imageUrl: this.pickImageByKeyword(
            r.image_url, r.id || r.title || '',
            String(details['operator'] || details['carrier'] || r.provider || ''),
            { tgv: 'assets/images/trains/tgv.png', ave: 'assets/images/trains/ave.png',
              renfe: 'assets/images/trains/ave.png', ouigo: 'assets/images/trains/ouigo.png' },
            this.trainImagePool),
          bookable: details['bookable'] === true,
          partnerMetadata: details,
        };
      }) as AlternativeTrain[];

      this.contextualTrains.set(mapped);
      this.loadingSwap.set(false);
    }).catch(() => {
      this.loadingSwap.set(false);
    });
  }

  cancelTrainSwap(): void {
    this.viewMode.set('itinerary');
    this.swappingTrainRef.set(null);
    this.addingTransportRef.set(null);
    this.selectedTrainDetail.set(null);
  }

  openTrainDetail(train: AlternativeTrain): void {
    this.selectedTrainDetail.set(train);
    this.viewMode.set('train-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  backToTrainList(): void {
    this.selectedTrainDetail.set(null);
    this.viewMode.set('swap-train');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  incrementTrainTravelers(): void {
    this.trainDetailTravelers.update((count) => Math.min(9, count + 1));
  }

  decrementTrainTravelers(): void {
    this.trainDetailTravelers.update((count) => Math.max(1, count - 1));
  }

  selectAlternativeTrain(train: AlternativeTrain): void {
    const travelers = this.trip?.travelers || 2;
    const priced = train.price * travelers;
    const addRef = this.addingTransportRef();
    if (addRef?.transportType === 'train') {
      this.finishAddingTransport({
        type: 'train',
        carrier: train.carrier,
        route: `${train.depLocation} → ${train.arrLocation}`,
        depDate: train.depDate,
        depTime: train.depTime,
        depLocation: train.depLocation,
        arrDate: train.arrDate,
        arrTime: train.arrTime,
        arrLocation: train.arrLocation,
        duration: train.duration,
        stops: train.stops,
        price: priced,
        cost: `${CURRENCY_SYMBOLS[this.locale.currentCurrency()]}${priced}`,
        imageUrl: train.imageUrl,
        bookable: train.bookable,
        partnerMetadata: train.partnerMetadata,
      });
      this.selectedTrainDetail.set(null);
      return;
    }
    const ref = this.swappingTrainRef();
    if (!ref) return;
    const days = this.displayedDays();
    const day = days.find(d => d.day === ref.dayDay);
    const item = day?.items[ref.itemIndex];
    const itemKey = item ? this.getItemKey(item) : `${ref.dayDay}-${ref.itemIndex}`;
    const trainDay = ref.dayDay;

    const clonedTrain = { ...train, price: priced };

    const current = this.swappedTrains();
    this.swappedTrains.set({ ...current, [itemKey]: clonedTrain });
    this.selectedTrainDetail.set(null);
    this.viewMode.set('itinerary');
    this.swappingTrainRef.set(null);
    void (async () => {
      try {
        await this.enqueueTransferPlan(trainDay, { silent: true });
      } finally {
        await this.syncCustomizationsToBackend();
      }
    })();
  }

  private buildTrainDetailContent(train: AlternativeTrain): TrainDetailContent {
    return {
      overview: `Travel from ${train.depLocation} to ${train.arrLocation} aboard ${train.carrier} in ${train.class}. This ${train.stops.toLowerCase()} journey takes approximately ${train.duration} and is offered as a ${train.refundable.toLowerCase()} fare.`,
      includes: [
        `${train.class} seating`,
        'Power outlets at seat (where available)',
        'Onboard Wi-Fi on selected routes',
        'Luggage allowance: 2 bags + 1 carry-on',
        'Seat selection at booking (subject to availability)',
      ],
      excludes: [
        'Meals unless premium class booked',
        'Bicycle or oversized luggage without pre-booking',
        'Lounge access',
        'Travel insurance',
      ],
      departureInfo: `${train.depLocation} · ${train.depDate} at ${train.depTime}. Please arrive at the platform at least 20 minutes before departure.`,
      arrivalInfo: `${train.arrLocation} · ${train.arrDate} at ${train.arrTime}.`,
      onboardInfo: train.stops === 'Direct'
        ? 'This is a direct service with no changes required.'
        : `This service includes ${train.stops.toLowerCase()}. Please check your connection times on your ticket.`,
      cancellationPolicy: train.refundable === 'Refundable'
        ? 'Free cancellation up to 24 hours before departure. Partial refund for cancellations within 24 hours.'
        : 'This fare is non-refundable. Date or name changes may incur a fee subject to operator policy.',
      fareRules: [
        'Valid only on the booked train and date',
        'Passport or government ID required for international routes',
        'E-ticket must be presented (printed or mobile)',
        'Children under 4 may travel free when sharing a seat',
      ],
    };
  }

  private buildBusDetailContent(bus: AlternativeBus): BusDetailContent {
    return {
      overview: `Travel from ${bus.depLocation} to ${bus.arrLocation} aboard ${bus.carrier} in ${bus.class}. This ${bus.stops.toLowerCase()} journey takes approximately ${bus.duration} and is offered as a ${bus.refundable.toLowerCase()} fare.`,
      includes: [
        `${bus.class} · ${bus.seatType}`,
        'Air conditioning',
        'Luggage allowance: 1 bag + 1 carry-on',
        'Seat selection at booking (subject to availability)',
      ],
      excludes: [
        'Meals unless premium class booked',
        'Oversized luggage without pre-booking',
        'Travel insurance',
      ],
      departureInfo: `${bus.depLocation} · ${bus.depDate} at ${bus.depTime}. Please arrive at the boarding point at least 15 minutes before departure.`,
      arrivalInfo: `${bus.arrLocation} · ${bus.arrDate} at ${bus.arrTime}.`,
      onboardInfo: bus.stops === 'Direct'
        ? 'This is a direct service with no changes required.'
        : `This service includes ${bus.stops.toLowerCase()}. Please check your connection times on your ticket.`,
      cancellationPolicy: bus.refundable === 'Refundable'
        ? 'Free cancellation up to 24 hours before departure. Partial refund for cancellations within 24 hours.'
        : 'This fare is non-refundable. Date or name changes may incur a fee subject to operator policy.',
      fareRules: [
        'Valid only on the booked bus and date',
        'Government ID required at boarding',
        'E-ticket must be presented (printed or mobile)',
        'Children under 4 may travel free when sharing a seat',
      ],
    };
  }

  readonly swapTrainDepStation = computed(() => {
    const ref = this.swappingTrainRef();
    if (!ref) return '';
    const days = this.displayedDays();
    const day = days.find(d => d.day === ref.dayDay);
    if (!day) return '';
    const item = day.items[ref.itemIndex];
    if (!item || item.type !== 'train') return '';
    return `${(item as any).depLocation} - ${(item as any).depTime}`;
  });

  readonly swapTrainArrStation = computed(() => {
    const ref = this.swappingTrainRef();
    if (!ref) return '';
    const days = this.displayedDays();
    const day = days.find(d => d.day === ref.dayDay);
    if (!day) return '';
    const item = day.items[ref.itemIndex];
    if (!item || item.type !== 'train') return '';
    return `${(item as any).arrLocation} - ${(item as any).arrTime}`;
  });

  readonly swapTrainDuration = computed(() => {
    const ref = this.swappingTrainRef();
    if (!ref) return '';
    const days = this.displayedDays();
    const day = days.find(d => d.day === ref.dayDay);
    if (!day) return '';
    const item = day.items[ref.itemIndex];
    if (!item || item.type !== 'train') return '';
    return (item as any).duration;
  });

  // =============================================
  // CAR SWAPPING FILTERS, OPTIONS, LISTS, ACTIONS
  // =============================================
  readonly carPriceFilter = signal<string[]>([]);
  readonly carPickupFilter = signal<string[]>([]);
  readonly carDropFilter = signal<string[]>([]);
  readonly carVariantFilter = signal<string[]>([]);
  readonly carTransmissionFilter = signal<string[]>([]);
  readonly carSupplierFilter = signal<string[]>([]);
  readonly carSearch = signal<string>('');

  readonly carDetailPickupTime = signal<string>('10:00 AM');
  readonly carDetailDropoffTime = signal<string>('10:00 AM');

  /** Pending car awaiting rental-duration confirmation. */
  readonly pendingCarSelection = signal<AlternativeCar | null>(null);
  readonly showCarRentalDurationModal = signal(false);
  /** Inclusive return itinerary day for the pending rental. */
  readonly carRentalReturnDay = signal(1);

  readonly carRentalPickupDay = computed(() => {
    const addRef = this.addingTransportRef();
    if (addRef?.transportType === 'car') return this.dayOf(addRef.dayDay);
    const swapRef = this.swappingCarRef();
    if (swapRef) return this.dayOf(swapRef.dayDay);
    return 1;
  });

  readonly carRentalMaxDay = computed(() => {
    const days = this.displayedDays();
    return Math.max(1, ...days.map((d) => d.day), this.carRentalPickupDay());
  });

  /** Inclusive day count for the pending/selected rental. */
  readonly carRentalDayCount = computed(() => {
    const pickup = this.carRentalPickupDay();
    const returnDay = Math.max(pickup, Math.min(this.carRentalMaxDay(), this.carRentalReturnDay()));
    return returnDay - pickup + 1;
  });

  readonly carRentalSpanSummary = computed(() => {
    this.langTick();
    this.locale.currentLanguage();
    const pickup = this.carRentalPickupDay();
    const days = this.carRentalDayCount();
    const returnDay = pickup + days - 1;
    if (days === 1) {
      return this.translate.instant('ITINERARY.CAR.DURATION_TODAY', { day: pickup });
    }
    if (returnDay >= this.carRentalMaxDay() && this.carRentalMaxDay() > pickup) {
      return this.translate.instant('ITINERARY.CAR.DURATION_REST_OF_TRIP', {
        from: pickup,
        to: returnDay,
        days,
      });
    }
    return this.translate.instant('ITINERARY.CAR.DURATION_THROUGH_DAY', {
      from: pickup,
      to: returnDay,
      days,
    });
  });

  readonly carRentalEstimatedTotal = computed(() => {
    const car = this.pendingCarSelection() || this.selectedCarDetail();
    if (!car) return 0;
    return (Number(car.price) || 0) * this.carRentalDayCount();
  });

  setCarRentalDays(days: number): void {
    const pickup = this.carRentalPickupDay();
    const maxDays = this.carRentalMaxDay() - pickup + 1;
    const clamped = Math.max(1, Math.min(maxDays, Math.round(days)));
    this.carRentalReturnDay.set(pickup + clamped - 1);
  }

  adjustCarRentalDays(delta: number): void {
    this.setCarRentalDays(this.carRentalDayCount() + delta);
  }

  setCarRentalTodayOnly(): void {
    this.setCarRentalDays(1);
  }

  setCarRentalRestOfTrip(): void {
    const pickup = this.carRentalPickupDay();
    this.carRentalReturnDay.set(this.carRentalMaxDay());
    // Ensure at least today when trip is a single day.
    if (this.carRentalMaxDay() < pickup) this.carRentalReturnDay.set(pickup);
  }

  readonly carDetailContent = computed((): CarDetailContent => {
    const car = this.selectedCarDetail();
    if (!car) {
      return {
        overview: '',
        rentalIncludes: [],
        rentalExcludes: [],
        pickupDetails: '',
        dropoffDetails: '',
        driverRequirements: [],
        insuranceInfo: '',
        cancellationPolicy: '',
        additionalFees: [],
        operatingHours: '',
        pickupTimes: [],
        dropoffTimes: [],
      };
    }
    return this.buildCarDetailContent(car);
  });

  readonly carPriceOptions = [
    { value: '0-5000', label: '₹ 0 - ₹ 5,000' },
    { value: '5000-10000', label: '₹ 5,000 - ₹ 10,000' },
    { value: '10000-15000', label: '₹ 10,000 - ₹ 15,000' },
    { value: '15000-20000', label: '₹ 15,000 - ₹ 20,000' },
    { value: '20000-above', label: '₹ 20,000 Above' },
  ];
  readonly carPickupOptions = [
    'Paris (CDG - Roissy-Charles de Gaulle)',
    'Paris (ORY - Orly) France',
    'Paris (BVA - Beauvais) France',
    'Gare du Nord Paris, France',
    'Quartier Saint-Georges Paris, France',
    'Quartier Saint-Ambroise Paris, France',
  ];
  readonly carDropOptions = [
    'Paris (CDG - Roissy-Charles de Gaulle)',
    'Paris (ORY - Orly) France',
    'Paris (BVA - Beauvais) France',
    'Gare du Nord Paris, France',
    'Quartier Saint-Georges Paris, France',
    'Quartier Saint-Ambroise Paris, France',
  ];
  readonly carVariantOptions = [
    { value: 'Compact', label: 'ITINERARY.CAR.VARIANT_COMPACT' },
    { value: 'Hatchback', label: 'ITINERARY.CAR.VARIANT_HATCHBACK' },
    { value: 'Sedan', label: 'ITINERARY.CAR.VARIANT_SEDAN' },
    { value: 'SUV', label: 'ITINERARY.CAR.VARIANT_SUV' },
  ];
  readonly carTransmissionOptions = [
    { value: 'Automatic', label: 'ITINERARY.CAR.TRANSMISSION_AUTOMATIC' },
    { value: 'Manual', label: 'ITINERARY.CAR.TRANSMISSION_MANUAL' },
  ];
  readonly carSupplierOptions = ['Alamo', 'Avis', 'Budget', 'Enterprise', 'Hertz', 'Sixt'];

  
  readonly filteredCars = computed(() => {
    let cars = this.contextualCars();
    const variant = this.carVariantFilter();
    const trans = this.carTransmissionFilter();
    const supplier = this.carSupplierFilter();
    const pickup = this.carPickupFilter();
    const drop = this.carDropFilter();
    
    const prices = this.carPriceFilter();
    if (prices.length > 0) {
      cars = cars.filter(c => {
        return prices.some(p => {
          if (p === '0-5000') return c.price <= 5000;
          if (p === '5000-10000') return c.price > 5000 && c.price <= 10000;
          if (p === '10000-15000') return c.price > 10000 && c.price <= 15000;
          if (p === '15000-20000') return c.price > 15000 && c.price <= 20000;
          if (p === '20000-above') return c.price > 20000;
          return false;
        });
      });
    }

    if (variant.length > 0) {
      cars = cars.filter(c => variant.some(v => c.category.toLowerCase().includes(v.toLowerCase())));
    }
    if (trans.length > 0) {
      cars = cars.filter(c => trans.includes(c.gearbox));
    }
    if (supplier.length > 0) {
      cars = cars.filter(c => supplier.includes(c.supplier));
    }
    if (pickup.length > 0) {
      cars = cars.filter(c => pickup.includes(c.location));
    }
    if (drop.length > 0) {
      cars = cars.filter(c => drop.includes(c.location));
    }

    const search = this.carSearch().toLowerCase().trim();
    if (search) {
      cars = cars.filter(c =>
        c.model.toLowerCase().includes(search) ||
        c.category.toLowerCase().includes(search) ||
        c.location.toLowerCase().includes(search)
      );
    }
    return cars;
  });

  readonly hasActiveCarFilters = computed(() =>
    this.carPriceFilter().length > 0 ||
    this.carPickupFilter().length > 0 ||
    this.carDropFilter().length > 0 ||
    this.carVariantFilter().length > 0 ||
    this.carTransmissionFilter().length > 0 ||
    this.carSupplierFilter().length > 0
  );

  toggleCarPriceFilter(value: string): void {
    const current = this.carPriceFilter();
    this.carPriceFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  toggleCarPickupFilter(value: string): void {
    const current = this.carPickupFilter();
    this.carPickupFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  toggleCarDropFilter(value: string): void {
    const current = this.carDropFilter();
    this.carDropFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  toggleCarVariantFilter(value: string): void {
    const current = this.carVariantFilter();
    this.carVariantFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  toggleCarTransmissionFilter(value: string): void {
    const current = this.carTransmissionFilter();
    this.carTransmissionFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  toggleCarSupplierFilter(value: string): void {
    const current = this.carSupplierFilter();
    this.carSupplierFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  clearAllCarFilters(): void {
    this.carPriceFilter.set([]);
    this.carPickupFilter.set([]);
    this.carDropFilter.set([]);
    this.carVariantFilter.set([]);
    this.carTransmissionFilter.set([]);
    this.carSupplierFilter.set([]);
    this.carSearch.set('');
  }

  startCarSwap(dayDay: number, itemIndex: number): void {
    this.lastInventoryFetch = () => this.startCarSwap(dayDay, itemIndex);
    const days = this.displayedDays();
    const day = days.find(d => d.day === dayDay);
    if (!day) return;
    const item = day.items[itemIndex];
    if (!item || item.type !== 'car') return;
    this.selectedCarDetail.set(null);
    this.swappingCarRef.set({ dayDay, itemIndex });
    this.carRentalReturnDay.set(this.defaultCarRentalReturnDay());
    this.clearAllCarFilters();
    this.viewMode.set('swap-car');
    this.contextualCars.set([]);
    this.loadingSwap.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const route = this.routeForTransportDay(dayDay);
    const searchId = ++this.carSearchId;
    void this.loadTransferOptionsForDay(dayDay, route, itemIndex).finally(() => {
      if (searchId === this.carSearchId) this.loadingSwap.set(false);
    });
  }

  cancelCarSwap(): void {
    this.viewMode.set('itinerary');
    this.swappingCarRef.set(null);
    this.addingTransportRef.set(null);
    this.selectedCarDetail.set(null);
  }

  openCarDetail(car: AlternativeCar): void {
    this.selectedCarDetail.set(car);
    const detail = this.buildCarDetailContent(car);
    this.carDetailPickupTime.set(detail.pickupTimes[0] ?? '10:00 AM');
    this.carDetailDropoffTime.set(detail.dropoffTimes[0] ?? '10:00 AM');
    this.carRentalReturnDay.set(this.defaultCarRentalReturnDay());
    this.viewMode.set('car-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  backToCarList(): void {
    this.selectedCarDetail.set(null);
    this.viewMode.set('swap-car');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Open duration prompt (list), or confirm with sidebar duration (detail). */
  selectAlternativeCar(car: AlternativeCar): void {
    // Point-to-point transfers are single-day — skip the multi-day rental prompt.
    const isTransfer =
      car.fareSource === 'transfer' ||
      car.category === 'Transfer' ||
      !!car.partnerMetadata?.['product_id'] ||
      !!car.partnerMetadata?.['booking_type_id'];
    this.pendingCarSelection.set(car);
    if (isTransfer) {
      const pickup = this.carRentalPickupDay();
      this.carRentalReturnDay.set(pickup);
      this.confirmCarRentalDuration();
      return;
    }
    if (this.viewMode() === 'car-detail') {
      this.confirmCarRentalDuration();
      return;
    }
    this.carRentalReturnDay.set(this.defaultCarRentalReturnDay());
    this.showCarRentalDurationModal.set(true);
  }

  cancelCarRentalDuration(): void {
    this.showCarRentalDurationModal.set(false);
    this.pendingCarSelection.set(null);
  }

  confirmCarRentalDuration(): void {
    const car = this.pendingCarSelection();
    if (!car) return;
    const pickupDay = this.carRentalPickupDay();
    const returnDay = Math.min(
      this.carRentalMaxDay(),
      Math.max(pickupDay, this.carRentalReturnDay()),
    );
    this.showCarRentalDurationModal.set(false);
    this.pendingCarSelection.set(null);
    this.applyMultiDayCarRental(car, pickupDay, returnDay);
  }

  private defaultCarRentalReturnDay(): number {
    const pickup = this.carRentalPickupDay();
    const swapRef = this.swappingCarRef();
    if (swapRef) {
      const days = this.displayedDays();
      const day = days.find((d) => d.day === swapRef.dayDay);
      const item = day?.items[swapRef.itemIndex];
      if (item?.type === 'car') {
        const existing = item as DetailCar;
        if (existing.returnDay && existing.returnDay >= pickup) {
          return existing.returnDay;
        }
      }
    }
    return pickup;
  }

  /**
   * Persist one shared rental across pickup..return days. Price is charged once
   * on the pickup (or single) day; later days are zero-priced references.
   */
  private applyMultiDayCarRental(
    car: AlternativeCar,
    pickupDay: number,
    returnDay: number,
  ): void {
    const rentalDays = Math.max(1, returnDay - pickupDay + 1);
    const dailyPrice = Number(car.price) || 0;
    const totalPrice = dailyPrice * rentalDays;
    const rentalId = `rental-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

    // If swapping an existing multi-day rental, drop the old span first.
    const swapRef = this.swappingCarRef();
    if (swapRef) {
      const days = this.displayedDays();
      const day = days.find((d) => d.day === swapRef.dayDay);
      const item = day?.items[swapRef.itemIndex];
      if (item?.type === 'car') {
        const prev = item as DetailCar;
        if (prev.rentalId) this.clearCarRentalById(prev.rentalId);
      }
    }

    const spanLabel = this.formatRentalSpanLabel(pickupDay, returnDay);
    const distanceLabel =
      car.distanceKm != null ? ` · ${Number(car.distanceKm).toFixed(1)} km` : '';

    for (let day = pickupDay; day <= returnDay; day++) {
      const role = this.rentalRoleForDay(day, pickupDay, returnDay);
      const dayDateLabel = this.formatItineraryDayDate(day);
      const location =
        role === 'active'
          ? this.translate.instant('ITINERARY.CAR.ACTIVE_RENTAL_LOCATION', {
              model: car.model,
            })
          : car.location;
      const dates =
        rentalDays === 1
          ? `${dayDateLabel}${car.duration ? ` · ${car.duration}` : ''}${distanceLabel}`
          : `${spanLabel}${role === 'pickup' && car.duration ? ` · ${car.duration}` : ''}`;

      const detail: DetailCar = {
        type: 'car',
        id: `${rentalId}-d${day}`,
        model: car.model,
        category: car.category || 'Transfer',
        location,
        dates,
        passengers: car.passengers,
        gearbox: car.gearbox || 'Automatic',
        bags: car.bags,
        fuel: car.fuel || 'Included',
        imageUrl: car.imageUrl,
        deepLink: car.deepLink,
        provider: car.provider || car.supplier,
        price: role === 'pickup' || role === 'single' ? totalPrice : 0,
        bookable: car.bookable,
        partnerMetadata: {
          ...(car.partnerMetadata || {}),
          rentalDailyPrice: dailyPrice,
          rentalTotalPrice: totalPrice,
        },
        duration: role === 'active' ? undefined : car.duration,
        durationMinutes: role === 'active' ? undefined : car.durationMinutes,
        distanceKm: role === 'active' ? undefined : car.distanceKm ?? undefined,
        fromLocation: role === 'active' ? undefined : car.fromLocation,
        toLocation: role === 'active' ? undefined : car.toLocation,
        autoInserted: false,
        rentalId,
        rentalDays,
        pickupDay,
        returnDay,
        rentalRole: role,
      };

      // Upsert without transfer replan — preserve the chosen vehicle/span.
      this.upsertTransportOnDay(day, detail);
    }

    this.selectedCarDetail.set(null);
    this.viewMode.set('itinerary');
    this.swappingCarRef.set(null);
    this.addingTransportRef.set(null);
    this.tripSegmentsVersion.update((v) => v + 1);
    this.toast.success(
      rentalDays === 1
        ? this.translate.instant('ITINERARY.TOAST.TRANSFER_ADDED', {
            from: car.fromLocation || car.location?.split('→')[0]?.trim() || '',
            to: car.toLocation || car.location?.split('→')[1]?.trim() || '',
          })
        : this.translate.instant('ITINERARY.TOAST.CAR_RENTAL_ADDED', {
            model: car.model,
            days: rentalDays,
            from: pickupDay,
            to: returnDay,
          }),
    );
    void this.syncCustomizationsToBackend();
  }

  private rentalRoleForDay(
    day: number,
    pickupDay: number,
    returnDay: number,
  ): CarRentalRole {
    if (pickupDay === returnDay) return 'single';
    if (day === pickupDay) return 'pickup';
    if (day === returnDay) return 'return';
    return 'active';
  }

  private formatItineraryDayDate(dayDay: number): string {
    const start = new Date(this.tripStartDate());
    start.setDate(start.getDate() + dayDay - 1);
    const localeTag = UI_LOCALE_TAGS[this.locale.currentLanguage()] || 'en-US';
    return start.toLocaleDateString(localeTag, {
      weekday: 'short',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  private formatRentalSpanLabel(pickupDay: number, returnDay: number): string {
    const from = this.formatItineraryDayDate(pickupDay);
    if (pickupDay === returnDay) return from;
    const to = this.formatItineraryDayDate(returnDay);
    const days = returnDay - pickupDay + 1;
    return this.translate.instant('ITINERARY.CAR.RENTAL_SPAN_LABEL', {
      from,
      to,
      days,
    });
  }

  /** Remove every day-card sharing a rentalId (segments + addedTransport overlays). */
  private clearCarRentalById(rentalId: string): void {
    if (!rentalId) return;
    if (this.trip?.segments?.length) {
      this.trip.segments = this.trip.segments.filter(
        (seg) => !(seg.type === 'car' && (seg as DetailCar).rentalId === rentalId),
      );
    }
    this.addedTransport.set(
      this.addedTransport().filter(
        (t) => !(t.item.type === 'car' && (t.item as DetailCar).rentalId === rentalId),
      ),
    );
  }

  private isProtectedMultiDayRental(car: DetailCar | null | undefined): boolean {
    if (!car) return false;
    return !!(car.rentalId && (car.rentalDays ?? 1) > 1 && !car.autoInserted);
  }

  private buildCarDetailContent(car: AlternativeCar): CarDetailContent {
    const dates = this.swapCarDates();
    return {
      overview: `Rent a ${car.model} ${car.category.toLowerCase()} from ${car.supplier} for your trip. This vehicle seats up to ${car.passengers} passengers with ${car.bags} luggage capacity, ${car.gearbox.toLowerCase()} transmission, and ${car.mileage.toLowerCase()} mileage for the selected rental period (${dates}).`,
      rentalIncludes: [
        `${car.mileage} mileage`,
        'Collision Damage Waiver (basic)',
        'Theft Protection (basic)',
        '24/7 roadside assistance',
        'Airport / station counter service',
      ],
      rentalExcludes: [
        'Fuel charges (return with same level)',
        'Additional driver fee unless added',
        'Toll charges and parking fees',
        'Premium insurance upgrades',
      ],
      pickupDetails: `Collect your vehicle at ${car.location}. Please carry your driving licence, passport, and credit card used for the security deposit block.`,
      dropoffDetails: `Return the vehicle to the same rental location unless a one-way drop-off has been confirmed. Late returns may incur additional day charges.`,
      driverRequirements: [
        'Minimum age 21 years (25+ for premium vehicles)',
        'Valid driving licence held for at least 1 year',
        'Passport or government ID required at counter',
        'Credit card in the main driver\'s name for security deposit',
      ],
      insuranceInfo: `Basic rental cover is included. A refundable security deposit of ₹ ${car.security.toLocaleString()} will be blocked on your card at pick-up and released after the vehicle is returned in acceptable condition.`,
      cancellationPolicy: 'Free cancellation up to 48 hours before pick-up. Cancellations within 48 hours may incur a one-day rental charge. No-show bookings are non-refundable.',
      additionalFees: [
        `Refundable security deposit: ₹ ${car.security.toLocaleString()}`,
        'Young driver surcharge may apply for drivers under 25',
        'Cross-border travel not permitted unless stated',
      ],
      operatingHours: 'Counter open daily: 07:00 AM – 10:00 PM',
      pickupTimes: ['08:00 AM', '10:00 AM', '12:00 PM', '02:00 PM', '04:00 PM'],
      dropoffTimes: ['08:00 AM', '10:00 AM', '12:00 PM', '02:00 PM', '04:00 PM'],
    };
  }

  readonly swapCarModel = computed(() => {
    const ref = this.swappingCarRef();
    if (!ref) return '';
    const days = this.displayedDays();
    const day = days.find(d => d.day === ref.dayDay);
    if (!day) return '';
    const item = day.items[ref.itemIndex];
    if (!item || item.type !== 'car') return '';
    return (item as any).model;
  });

  readonly swapCarDates = computed(() => {
    const ref = this.swappingCarRef();
    if (!ref) return '';
    const days = this.displayedDays();
    const day = days.find(d => d.day === ref.dayDay);
    if (!day) return '';
    const item = day.items[ref.itemIndex];
    if (!item || item.type !== 'car') return '';
    return (item as any).dates || '3 Days';
  });

  // =============================================
  // BUS SWAPPING FILTERS, OPTIONS, LISTS, ACTIONS
  // =============================================
  readonly busTypeFilter = signal<string[]>([]);
  readonly busSeatFilter = signal<string[]>([]);
  readonly busDepartureFilter = signal<string[]>([]);
  readonly busOperatorFilter = signal<string[]>([]);
  readonly busRatingFilter = signal<string[]>([]);
  readonly busSearch = signal<string>('');

  readonly busTypeOptions = [
    { value: 'AC', label: 'ITINERARY.BUS.TYPE_AC' },
    { value: 'Non - AC', label: 'ITINERARY.BUS.TYPE_NON_AC' },
  ];
  readonly busSeatOptions = [
    { value: 'Sleeper', label: 'ITINERARY.BUS.SEAT_SLEEPER' },
    { value: 'Semi - Sleeper', label: 'ITINERARY.BUS.SEAT_SEMI_SLEEPER' },
    { value: 'Seater', label: 'ITINERARY.BUS.SEAT_SEATER' },
  ];
  readonly busOperatorOptions = ['ALSA', 'Flixbus', 'Bla Bla Car', 'Infobus', 'Agreda'];
  readonly busRatingOptions = [
    { value: '4.5', label: 'ITINERARY.BUS.RATING_45_ABOVE' },
    { value: '4.0', label: 'ITINERARY.BUS.RATING_40_ABOVE' },
    { value: '3.5', label: 'ITINERARY.BUS.RATING_35_ABOVE' },
  ];

  
  readonly filteredBuses = computed(() => {
    let buses = this.contextualBuses();
    const type = this.busTypeFilter();
    const seat = this.busSeatFilter();
    const dep = this.busDepartureFilter();
    const operator = this.busOperatorFilter();
    const rating = this.busRatingFilter();
    const search = this.busSearch().toLowerCase().trim();

    if (type.length > 0) {
      buses = buses.filter(b => type.includes(b.class));
    }
    if (seat.length > 0) {
      buses = buses.filter(b => seat.includes(b.seatType));
    }
    if (dep.length > 0) {
      buses = buses.filter(b => dep.includes(this.depTimeToBucket(b.depTime)));
    }
    if (operator.length > 0) {
      buses = buses.filter(b => operator.includes(b.operator));
    }
    if (rating.length > 0) {
      buses = buses.filter(b => {
        const val = parseFloat(b.rating);
        return rating.some(r => val >= parseFloat(r));
      });
    }
    if (search) {
      buses = buses.filter(b =>
        b.carrier.toLowerCase().includes(search) ||
        b.depLocation.toLowerCase().includes(search) ||
        b.arrLocation.toLowerCase().includes(search)
      );
    }
    return buses;
  });

  readonly hasActiveBusFilters = computed(() =>
    this.busTypeFilter().length > 0 ||
    this.busSeatFilter().length > 0 ||
    this.busDepartureFilter().length > 0 ||
    this.busOperatorFilter().length > 0 ||
    this.busRatingFilter().length > 0
  );

  toggleBusTypeFilter(value: string): void {
    const current = this.busTypeFilter();
    this.busTypeFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  toggleBusSeatFilter(value: string): void {
    const current = this.busSeatFilter();
    this.busSeatFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  toggleBusDepartureFilter(value: string): void {
    const current = this.busDepartureFilter();
    this.busDepartureFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  toggleBusOperatorFilter(value: string): void {
    const current = this.busOperatorFilter();
    this.busOperatorFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  toggleBusRatingFilter(value: string): void {
    const current = this.busRatingFilter();
    this.busRatingFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  clearAllBusFilters(): void {
    this.busTypeFilter.set([]);
    this.busSeatFilter.set([]);
    this.busDepartureFilter.set([]);
    this.busOperatorFilter.set([]);
    this.busRatingFilter.set([]);
    this.busSearch.set('');
  }

  startBusSwap(dayDay: number, itemIndex: number): void {
    this.lastInventoryFetch = () => this.startBusSwap(dayDay, itemIndex);
    const days = this.displayedDays();
    const day = days.find(d => d.day === dayDay);
    if (!day) return;
    const item = day.items[itemIndex];
    if (!item || item.type !== 'bus') return;
    this.swappingBusRef.set({ dayDay, itemIndex });
    this.clearAllBusFilters();
    this.viewMode.set('swap-bus');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.contextualBuses.set([]);
    this.loadingSwap.set(true);
    const searchId = ++this.busSearchId;
    this.tripService.searchInventory({
      type: 'bus',
      dep: (item as any).depLocation,
      arr: (item as any).arrLocation,
      budget: this.budgetOption() || this.trip?.budget || 'standard',
    }).then(results => {
      if (searchId !== this.busSearchId) return;
      const mapped = results.map(r => {
        const details = r.details || {};
        return {
          id: r.id || crypto.randomUUID(),
          carrier: String(details['operator'] || r.provider),
          depDate: (item as any).depDate || '2025-05-10',
          depTime: r.start_time || details['start_time'] || '08:00',
          depLocation: String(details['depLocation'] || details['departure'] || (item as any).depLocation),
          arrDate: (item as any).arrDate || '2025-05-10',
          arrTime: r.end_time || details['end_time'] || '14:00',
          arrLocation: String(details['arrLocation'] || details['arrival'] || (item as any).arrLocation),
          duration: r.duration || details['duration'] || '6h 00m',
          stops: 'Direct',
          class: 'Economy',
          seatType: 'Standard Recliner',
          operator: String(details['operator'] || r.provider),
          rating: '4.5',
          refundable: 'Non-Refundable',
          price: typeof r.price === 'object' ? (r.price?.amount ?? 0) : (r.price ?? 0),
          imageUrl: this.pickImageByKeyword(
            r.image_url, r.id || r.title || '',
            String(details['operator'] || r.provider || ''),
            this.busKeywordLogos, this.busImagePool),
        };
      }) as AlternativeBus[];

      this.contextualBuses.set(mapped);
      this.loadingSwap.set(false);
    }).catch(() => {
      this.loadingSwap.set(false);
    });
  }

  cancelBusSwap(): void {
    this.viewMode.set('itinerary');
    this.swappingBusRef.set(null);
    this.addingTransportRef.set(null);
    this.selectedBusDetail.set(null);
  }

  openBusDetail(bus: AlternativeBus): void {
    this.selectedBusDetail.set(bus);
    this.viewMode.set('bus-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  backToBusList(): void {
    this.selectedBusDetail.set(null);
    this.viewMode.set('swap-bus');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  incrementBusTravelers(): void {
    this.busDetailTravelers.update((count) => Math.min(9, count + 1));
  }

  decrementBusTravelers(): void {
    this.busDetailTravelers.update((count) => Math.max(1, count - 1));
  }

  selectAlternativeBus(bus: AlternativeBus): void {
    const travelers = this.trip?.travelers || 2;
    const priced = bus.price * travelers;
    const addRef = this.addingTransportRef();
    if (addRef?.transportType === 'bus') {
      this.finishAddingTransport({
        type: 'bus',
        carrier: bus.carrier,
        route: `${bus.depLocation} → ${bus.arrLocation}`,
        depDate: bus.depDate,
        depTime: bus.depTime,
        depLocation: bus.depLocation,
        arrDate: bus.arrDate,
        arrTime: bus.arrTime,
        arrLocation: bus.arrLocation,
        duration: bus.duration,
        stops: bus.stops,
        price: priced,
        cost: `${CURRENCY_SYMBOLS[this.locale.currentCurrency()]}${priced}`,
        imageUrl: bus.imageUrl,
      });
      this.selectedBusDetail.set(null);
      return;
    }
    const ref = this.swappingBusRef();
    if (!ref) return;
    const days = this.displayedDays();
    const day = days.find(d => d.day === ref.dayDay);
    const item = day?.items[ref.itemIndex];
    const itemKey = item ? this.getItemKey(item) : `${ref.dayDay}-${ref.itemIndex}`;
    const busDay = ref.dayDay;

    const clonedBus = { ...bus, price: priced };

    const current = this.swappedBuses();
    this.swappedBuses.set({ ...current, [itemKey]: clonedBus });
    this.selectedBusDetail.set(null);
    this.viewMode.set('itinerary');
    this.swappingBusRef.set(null);
    void (async () => {
      try {
        await this.enqueueTransferPlan(busDay, { silent: true });
      } finally {
        await this.syncCustomizationsToBackend();
      }
    })();
  }

  // =============================================
  // SWAP HOTEL STATE & LOGIC
  // =============================================
  
  
  readonly swappingHotelCity = computed(() => {
    const ref = this.swappingHotelRef();
    if (!ref) return '';
    const cities = this.cities();
    const dayDay = ref.dayDay;
    let currentDay = 1;
    for (const c of cities) {
      if (dayDay >= currentDay && dayDay < currentDay + c.nights) {
        return c.name;
      }
      currentDay += c.nights;
    }
    return '';
  });

  readonly swappingHotelDetails = computed(() => {
    const ref = this.swappingHotelRef();
    if (!ref) return null;
    if (ref.itemIndex === -1) {
      return {
        name: this.translate.instant('ITINERARY.HOTEL.ADD_STAY_TITLE'),
        dates: this.formatHotelDisplayDate(),
        isAdd: true,
      } as any;
    }
    const days = this.displayedDays();
    const day = days.find(d => d.day === ref.dayDay);
    if (!day) return null;
    const item = day.items[ref.itemIndex];
    if (!item || item.type !== 'hotel') return null;
    return item;
  });

  readonly swappingHotelNights = computed(() => {
    const ref = this.swappingHotelRef();
    if (!ref) return 1;
    const cities = this.cities();
    const dayDay = ref.dayDay;
    let currentDay = 1;
    for (const c of cities) {
      if (dayDay >= currentDay && dayDay < currentDay + c.nights) {
        return Math.max(1, c.nights);
      }
      currentDay += c.nights;
    }
    return 0;
  });

  readonly contextualHotels = signal<AlternativeHotel[]>([]);

  readonly filteredHotels = computed(() => {
    let hotels = this.contextualHotels();


    // Filter by search query
    const q = this.hotelSearch().toLowerCase().trim();
    if (q) {
      hotels = hotels.filter(h => h.name.toLowerCase().includes(q) || h.location.toLowerCase().includes(q));
    }

    // Filter by price
    const maxPrice = this.hotelPriceFilter();
    hotels = hotels.filter(h => h.price <= maxPrice);

    // Filter by Star Ratings
    const stars = this.hotelRatingFilter();
    if (stars.length > 0) {
      hotels = hotels.filter(h => stars.includes(Math.floor(h.rating)));
    }

    // Filter by Property Type
    const types = this.hotelTypeFilter();
    if (types.length > 0) {
      hotels = hotels.filter(h =>
        types.some(t =>
          h.roomType.toLowerCase().includes(t.toLowerCase()) ||
          h.name.toLowerCase().includes(t.toLowerCase())
        )
      );
    }

    // Filter by Amenities
    const amenities = this.hotelAmenitiesFilter();
    if (amenities.length > 0) {
      hotels = hotels.filter(h => amenities.every(a => h.amenities.includes(a)));
    }

    // Filter by Reservation Policy
    const policies = this.hotelPolicyFilter();
    if (policies.length > 0) {
      hotels = hotels.filter(h => policies.includes(h.cancellation));
    }

    // Filter by Distance
    const distances = this.hotelDistanceFilter();
    if (distances.length > 0) {
      hotels = hotels.filter(h => {
        const num = parseFloat(h.distance.replace(/[^0-9.]/g, ''));
        if (isNaN(num)) return true;
        return distances.some(d => {
          if (d === 'Less than 1 km') return num < 1.0;
          if (d === 'Less than 3 km') return num < 3.0;
          if (d === 'Less than 5 km') return num < 5.0;
          return true;
        });
      });
    }

    // Filter by Bed Preference
    const beds = this.hotelBedFilter();
    if (beds.length > 0) {
      hotels = hotels.filter(h => beds.includes(h.bedPreference));
    }

    // Filter by Popular Areas
    const areas = this.hotelAreaFilter();
    if (areas.length > 0) {
      hotels = hotels.filter(h =>
        areas.some(a => h.location.toLowerCase().includes(a.toLowerCase()))
      );
    }

    // TP Exclusive toggle — show only premium (4.5+) properties
    if (this.tpExclusive()) {
      hotels = hotels.filter(h => h.rating >= 4.5);
    }

    // Sorting
    const sort = this.hotelSort();
    hotels = [...hotels];
    if (sort === 'price-low') hotels.sort((a, b) => a.price - b.price);
    else if (sort === 'price-high') hotels.sort((a, b) => b.price - a.price);
    else if (sort === 'rating') hotels.sort((a, b) => b.rating - a.rating);

    return hotels;
  });

  readonly hotelSortLabel = computed(() => {
    switch (this.hotelSort()) {
      case 'price-low': return 'Price: Low to High';
      case 'price-high': return 'Price: High to Low';
      case 'rating': return 'Top Rated';
      default: return 'Most Recommended';
    }
  });

  readonly totalHotelPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredHotels().length / this.hotelPageSize))
  );

  readonly paginatedHotels = computed(() => {
    const page = Math.min(this.hotelCurrentPage(), this.totalHotelPages());
    const start = (page - 1) * this.hotelPageSize;
    return this.filteredHotels().slice(start, start + this.hotelPageSize);
  });

  setHotelSort(sort: 'recommended' | 'price-low' | 'price-high' | 'rating'): void {
    this.hotelSort.set(sort);
    this.hotelSortOpen.set(false);
    this.hotelCurrentPage.set(1);
  }

  goToHotelPage(page: number): void {
    if (page < 1 || page > this.totalHotelPages()) return;
    this.hotelCurrentPage.set(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  toggleHotelRatingFilter(value: number): void {
    const current = this.hotelRatingFilter();
    this.hotelRatingFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  toggleHotelAmenitiesFilter(value: string): void {
    const current = this.hotelAmenitiesFilter();
    this.hotelAmenitiesFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  toggleHotelTypeFilter(value: string): void {
    const current = this.hotelTypeFilter();
    this.hotelTypeFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  toggleHotelPolicyFilter(value: string): void {
    const current = this.hotelPolicyFilter();
    this.hotelPolicyFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  toggleHotelDistanceFilter(value: string): void {
    const current = this.hotelDistanceFilter();
    this.hotelDistanceFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  toggleHotelBedFilter(value: string): void {
    const current = this.hotelBedFilter();
    this.hotelBedFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  toggleHotelAreaFilter(value: string): void {
    const current = this.hotelAreaFilter();
    this.hotelAreaFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  clearAllHotelFilters(): void {
    this.hotelPriceFilter.set(60000);
    this.hotelRatingFilter.set([]);
    this.hotelAmenitiesFilter.set([]);
    this.hotelTypeFilter.set([]);
    this.hotelPolicyFilter.set([]);
    this.hotelDistanceFilter.set([]);
    this.hotelBedFilter.set([]);
    this.hotelAreaFilter.set([]);
    this.hotelSearch.set('');
    this.hotelCurrentPage.set(1);
  }
  hasActiveHotelFilters = computed(() => {
    return this.hotelPriceFilter() !== 60000 ||
      this.hotelRatingFilter().length > 0 ||
      this.hotelAmenitiesFilter().length > 0 ||
      this.hotelTypeFilter().length > 0 ||
      this.hotelPolicyFilter().length > 0 ||
      this.hotelDistanceFilter().length > 0 ||
      this.hotelBedFilter().length > 0 ||
      this.hotelAreaFilter().length > 0 ||
      this.hotelSearch() !== '';
  });

  startHotelSwap(dayDay: number, itemIndex: number): void {
    this.lastInventoryFetch = () => this.startHotelSwap(dayDay, itemIndex);
    const days = this.displayedDays();
    const day = days.find(d => d.day === dayDay);
    if (!day) return;
    const item = day.items[itemIndex];
    if (!item || item.type !== 'hotel') return;
    this.selectedHotelDetail.set(null);
    this.swappingHotelRef.set({ dayDay, itemIndex });
    this.clearAllHotelFilters();
    this.viewMode.set('swap-hotel');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const location =
      (item as DetailHotel).location ||
      this.cityForDay(dayDay) ||
      String(this.trip?.destination || '');
    this.fetchHotelInventory(location, dayDay);
  }

  private fetchHotelInventory(location: string, dayDay: number): void {
    this.lastInventoryFetch = () => this.fetchHotelInventory(location, dayDay);
    this.contextualHotels.set([]);
    this.loadingSwap.set(true);
    const searchId = ++this.hotelSearchId;
    this.tripService.searchInventory({
      type: 'hotel',
      location,
      date: this.isoDateForDay(dayDay),
      budget: this.trip?.budget || 'standard',
    }).then(results => {
      if (searchId !== this.hotelSearchId) return;
      const mapped = results.map(r => {
        const details = r.details || {};
        const ratingRaw = details['rating'] ?? details['stars'] ?? 4.5;
        const rating = typeof ratingRaw === 'number' ? ratingRaw : Number(ratingRaw) || 4.5;
        const amenities = Array.isArray(details['amenities']) && details['amenities'].length
          ? details['amenities'].map((a: unknown) => String(a))
          : ['Free WiFi'];
        if (details['meal_plan'] && !amenities.includes(String(details['meal_plan']))) {
          amenities.unshift(String(details['meal_plan']));
        }
        return {
          id: r.id || 'hot-' + Math.random(),
          name: r.title,
          rating,
          stars: typeof details['stars'] === 'number' ? details['stars'] : undefined,
          reviewCount: typeof details['number_of_reviews'] === 'number' ? details['number_of_reviews'] : undefined,
          location: details['address'] || details['location'] || location || 'City Center',
          city: details['location'] || location || 'City Center',
          distance: details['distance'] || '',
          maxGuests: 2,
          roomType: details['room_id'] ? 'Selected room' : 'Standard Double',
          bedPreference: 'Queen',
          cancellation: String(details['cancellation'] || 'See property policy'),
          parking: 'See property details',
          price: r.price || 150,
          taxes: Math.round((r.price || 150) * 0.12),
          imageUrl: this.pickImage(r.image_url || details['photo'], r.id || r.title || '', this.hotelImagePool),
          gallery: Array.isArray(details['gallery']) ? details['gallery'] : undefined,
          amenities,
          mealPlan: details['meal_plan'] ? String(details['meal_plan']) : undefined,
          deepLink: r.deep_link || details['deep_link'],
          provider: r.provider,
          bookable: details['bookable'] === true,
          partnerMetadata: details,
        };
      }) as AlternativeHotel[];

      this.contextualHotels.set(mapped);
      this.loadingSwap.set(false);
    }).catch(() => {
      this.loadingSwap.set(false);
    });
  }

  cancelHotelSwap(): void {
    this.viewMode.set('itinerary');
    this.swappingHotelRef.set(null);
    this.selectedHotelDetail.set(null);
    this.selectedHotelBedId.set('');
  }

  openHotelDetail(hotel: AlternativeHotel): void {
    this.selectedHotelDetail.set(hotel);
    const content = this.buildHotelDetailContent(hotel);
    const firstBed = content.roomTypes[0]?.beds[0];
    this.selectedHotelBedId.set(firstBed?.id ?? '');
    this.viewMode.set('hotel-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  backToHotelList(): void {
    this.selectedHotelDetail.set(null);
    this.selectedHotelBedId.set('');
    this.viewMode.set('swap-hotel');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  selectHotelBed(bedId: string): void {
    this.selectedHotelBedId.set(bedId);
    
    const ref = this.swappingHotelRef();
    if (!ref) return;
    const days = this.displayedDays();
    const day = days.find(d => d.day === ref.dayDay);
    const item = day?.items[ref.itemIndex];
    const itemKey = item ? this.getItemKey(item) : `${ref.dayDay}-${ref.itemIndex}`;
    
    const hotel = this.selectedHotelDetail();
    if (!hotel) return;

    let bedLabel = 'Double Bed';
    if (bedId.toLowerCase().includes('single')) bedLabel = 'Single Bed';
    else if (bedId.toLowerCase().includes('twin')) bedLabel = 'Twin Beds';
    else if (bedId.toLowerCase().includes('queen')) bedLabel = 'Queen Bed';
    else if (bedId.toLowerCase().includes('king')) bedLabel = 'King Bed';
    else if (bedId.toLowerCase().includes('double')) bedLabel = 'Double Bed';

    const content = this.buildHotelDetailContent(hotel);
    const roomType = content.roomTypes.find(r => r.beds.some(b => b.id === bedId));
    const bed = roomType?.beds.find(b => b.id === bedId);
    let baseNightlyPrice = hotel.price || 150;
    if (bed) {
      baseNightlyPrice = bed.price;
    }

    const nights = this.swappingHotelNights() || 1;
    const rooms = this.trip ? (this.trip.travelers === 1 ? 1 : Math.max(1, Math.ceil(this.trip.travelers / 2))) : 1;
    const updatedHotel = { ...hotel, bedPreference: bedLabel, price: baseNightlyPrice * nights * rooms };

    const current = this.swappedHotels();
    this.swappedHotels.set({ ...current, [itemKey]: updatedHotel });
    this.syncCustomizationsToBackend();
  }

  selectAlternativeHotel(hotel: AlternativeHotel): void {
    const ref = this.swappingHotelRef();
    if (!ref) return;
    const days = this.displayedDays();
    const day = days.find(d => d.day === ref.dayDay);
    const item = ref.itemIndex >= 0 ? day?.items[ref.itemIndex] : undefined;
    const itemKey = item ? this.getItemKey(item) : `hotel-add-${ref.dayDay}-${hotel.id || hotel.name}`;
    const current = this.swappedHotels();

    let baseNightlyPrice = hotel.price || 150;
    let bedPreference = hotel.bedPreference;
    const bedId = this.selectedHotelBedId();
    if (bedId) {
      let bedLabel = 'Double Bed';
      if (bedId.toLowerCase().includes('single')) bedLabel = 'Single Bed';
      else if (bedId.toLowerCase().includes('twin')) bedLabel = 'Twin Beds';
      else if (bedId.toLowerCase().includes('queen')) bedLabel = 'Queen Bed';
      else if (bedId.toLowerCase().includes('king')) bedLabel = 'King Bed';
      else if (bedId.toLowerCase().includes('double')) bedLabel = 'Double Bed';
      bedPreference = bedLabel;

      const content = this.buildHotelDetailContent(hotel);
      const roomType = content.roomTypes.find(r => r.beds.some(b => b.id === bedId));
      const bed = roomType?.beds.find(b => b.id === bedId);
      if (bed) {
        baseNightlyPrice = bed.price;
      }
    }

    const nights = this.swappingHotelNights() || 1;
    const rooms = this.trip ? (this.trip.travelers === 1 ? 1 : Math.max(1, Math.ceil(this.trip.travelers / 2))) : 1;
    const updatedHotel = { ...hotel, bedPreference, price: baseNightlyPrice * nights * rooms };

    // Adding a stay to a day that doesn't already have a hotel slot.
    if (ref.itemIndex === -1) {
      const detail = {
        ...this.toDetailHotel(updatedHotel),
        dates: this.formatHotelDisplayDate(),
        day: ref.dayDay,
        id: `slot-d${ref.dayDay}-hotel-${Date.now().toString(36).slice(-5)}`,
      } as DetailHotel;
      if (this.trip) {
        this.trip.segments = [...(this.trip.segments || []), detail as unknown as TripSegment];
        this.tripSegmentsVersion.update((v) => v + 1);
      }
      this.selectedHotelDetail.set(null);
      this.selectedHotelBedId.set('');
      this.viewMode.set('itinerary');
      const hotelDay = ref.dayDay;
      this.swappingHotelRef.set(null);
      void (async () => {
        try {
          await this.enqueueTransferPlan(hotelDay);
        } finally {
          await this.syncCustomizationsToBackend();
        }
      })();
      return;
    }

    this.swappedHotels.set({ ...current, [itemKey]: updatedHotel });
    this.selectedHotelDetail.set(null);
    this.selectedHotelBedId.set('');
    this.viewMode.set('itinerary');
    const hotelDay = ref.dayDay;
    this.swappingHotelRef.set(null);
    void (async () => {
      try {
        await this.enqueueTransferPlan(hotelDay);
      } finally {
        await this.syncCustomizationsToBackend();
      }
    })();
  }

  private buildHotelDetailContent(hotel: AlternativeHotel): HotelDetailContent {
    const nights = this.swappingHotelNights() || 1;
    const apiGallery = (hotel.gallery || []).filter(Boolean);
    const gallery = [
      hotel.imageUrl,
      ...apiGallery,
      'assets/images/hotels/marais.png',
      'assets/images/hotels/montmartre.png',
      'assets/images/hotels/grands_boulevards.png',
    ].filter((url, i, arr) => !!url && arr.indexOf(url) === i);

    const bedFeatures = (
      refundLabel: string,
      wifi: boolean,
      ac = true,
      parking = true,
      breakfast = true,
    ): { label: string; included: boolean }[] => [
      { label: refundLabel, included: true },
      { label: 'Wi-Fi', included: wifi },
      { label: 'Air conditioning', included: ac },
      { label: 'Parking Space', included: parking },
      { label: hotel.mealPlan || 'Breakfast', included: breakfast || !!hotel.mealPlan },
    ];

    const basePrice = hotel.price * nights;
    const taxes = hotel.taxes * nights;
    const cancelLabel = hotel.cancellation || 'See property policy';
    const roomTypes: HotelRoomTypeOption[] = [
      {
        id: `${hotel.id}-standard`,
        name: hotel.roomType || 'Standard Room',
        maxGuests: hotel.maxGuests || 2,
        imageUrl: hotel.imageUrl,
        beds: [
          {
            id: `${hotel.id}-queen`,
            name: hotel.bedPreference || 'Queen Bed',
            features: bedFeatures(cancelLabel, true),
            price: basePrice + taxes,
          },
          {
            id: `${hotel.id}-twin`,
            name: 'Twin Bed',
            features: bedFeatures(cancelLabel, true),
            price: basePrice + taxes + Math.round(hotel.price * 0.07 * nights),
          },
        ],
      },
    ];

    // Keep richer synthetic room options only when we don't have live Booking product data.
    if (!hotel.provider || hotel.provider.includes('mock')) {
      roomTypes.push(
        {
          id: `${hotel.id}-deluxe`,
          name: 'Deluxe Room',
          maxGuests: 4,
          imageUrl: gallery[1] ?? hotel.imageUrl,
          beds: [
            {
              id: `${hotel.id}-deluxe-king`,
              name: 'Deluxe King',
              features: bedFeatures('Non-Refundable', false),
              price: Math.round(basePrice * 1.48) + taxes,
            },
            {
              id: `${hotel.id}-deluxe-twin`,
              name: 'Deluxe Twin',
              features: bedFeatures('Refundable', true),
              price: Math.round(basePrice * 1.23) + taxes,
            },
          ],
        },
      );
    }

    return {
      gallery,
      reviewCount: hotel.reviewCount || Math.max(12, Math.round(hotel.rating * 40)),
      address: hotel.location,
      displayDate: this.formatHotelDisplayDate(),
      checkInLabel: this.formatHotelCheckInLabel(),
      checkOutLabel: this.formatHotelCheckOutLabel(),
      facilityColumns: [
        hotel.amenities.slice(0, 4),
        hotel.amenities.slice(4, 8),
      ],
      overviewParagraphs: [
        `A stay at ${hotel.name} places you in ${hotel.city}.` +
          (hotel.stars ? ` This ${hotel.stars}-star property` : ' This property') +
          ` is rated ${hotel.rating}/10` +
          (hotel.reviewCount ? ` from ${hotel.reviewCount} reviews` : '') +
          `.`,
        hotel.mealPlan
          ? `${hotel.mealPlan}. ${cancelLabel}.`
          : `${cancelLabel}. Check the partner site for the latest room and rate details.`,
      ],
      roomTypes,
    };
  }

  private formatHotelDisplayDate(): string {
    const start = this.trip?.startDate ? new Date(this.trip.startDate) : new Date();
    const day = start.getDate().toString().padStart(2, '0');
    const month = start.toLocaleDateString('en-GB', { month: 'long' });
    const year = start.getFullYear();
    return `${day} ${month}, ${year}`;
  }

  private formatHotelCheckInLabel(): string {
    const start = this.trip?.startDate ? new Date(this.trip.startDate) : new Date();
    return start.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
  }

  private formatHotelCheckOutLabel(): string {
    const nights = this.swappingHotelNights() || 1;
    const start = this.trip?.startDate ? new Date(this.trip.startDate) : new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + nights);
    return end.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
  }

  // =============================================
  // SWAP ACTIVITY STATE & LOGIC
  // =============================================
  readonly swappingActivityCity = computed(() => {
    const ref = this.swappingActivityRef();
    if (!ref) return '';
    return this.cityForDay(ref.dayDay);
  });

  readonly swappingActivityDetails = computed(() => {
    const ref = this.swappingActivityRef();
    if (!ref) return null;
    if (ref.itemIndex === -1) {
      return { title: this.translate.instant('ITINERARY.ACTIVITY.ADD_ACTIVITY_TITLE'), isAdd: true } as any;
    }
    const days = this.displayedDays();
    const day = days.find(d => d.day === ref.dayDay);
    if (!day) return null;
    const item = day.items[ref.itemIndex];
    if (!item || item.type !== 'activity') return null;
    return item as any;
  });

  readonly contextualActivities = signal<AlternativeActivity[]>([]);

  readonly filteredActivities = computed(() => {
    let acts = this.contextualActivities();



    // Filter by search query
    const q = this.activitySearch().toLowerCase().trim();
    if (q) {
      acts = acts.filter(a => a.title.toLowerCase().includes(q) || a.location.toLowerCase().includes(q));
    }

    // Filter by price range
    const maxPrice = this.activityPriceFilter();
    acts = acts.filter(a => a.price <= maxPrice);

    // Filter by time of day
    const times = this.activityTimeFilter();
    if (times.length > 0) {
      acts = acts.filter(a => times.includes(a.timeOfDay));
    }

    // Filter by duration
    const durs = this.activityDurationFilter();
    if (durs.length > 0) {
      acts = acts.filter(a => {
        const hours = parseFloat(a.duration.replace(/[^0-9.]/g, ''));
        if (isNaN(hours)) return true;
        return durs.some(d => {
          const limit = parseFloat(d.replace(/[^0-9.]/g, ''));
          return hours <= limit;
        });
      });
    }

    // Filter by attraction type
    const attrTypes = this.activityTypeFilter();
    if (attrTypes.length > 0) {
      acts = acts.filter(a => attrTypes.map(t => t.trim().toLowerCase()).includes(a.attractionType.trim().toLowerCase()));
    }

    // Filter by location type
    const locTypes = this.activityLocationFilter();
    if (locTypes.length > 0) {
      acts = acts.filter(a => locTypes.includes(a.locationType));
    }

    // Filter by highlights
    const highlights = this.activityHighlightFilter();
    if (highlights.length > 0) {
      acts = acts.filter(a => {
        return highlights.every(h => {
          if (h === 'Popular') return a.isPopular;
          if (h === 'Last-Minute Available') return a.isLastMinute;
          if (h === 'Rated 4.5+') return a.rating >= 4.5;
          if (h === 'Local Expert') return a.isLocalExpert;
          return true;
        });
      });
    }

    return acts;
  });

  startActivitySwap(dayDay: number, itemIndex: number): void {
    const days = this.displayedDays();
    const day = days.find(d => d.day === dayDay);
    if (!day) return;
    const item = day.items[itemIndex];
    if (!item || item.type !== 'activity') return;
    this.selectedActivityDetail.set(null);
    this.activityInventoryKind.set('activity');
    this.swappingActivityRef.set({ dayDay, itemIndex });
    this.clearAllActivityFilters();
    this.viewMode.set('swap-activity');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.fetchActivityInventory(this.cityForDay(dayDay), dayDay, 'activity');
  }

  startActivityAdd(dayDay: number): void {
    this.selectedActivityDetail.set(null);
    this.activityInventoryKind.set('activity');
    this.swappingActivityRef.set({ dayDay, itemIndex: -1 });
    this.clearAllActivityFilters();
    this.viewMode.set('swap-activity');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.fetchActivityInventory(this.cityForDay(dayDay), dayDay, 'activity');
  }

  startEventAdd(dayDay: number): void {
    this.selectedActivityDetail.set(null);
    this.activityInventoryKind.set('event');
    this.swappingActivityRef.set({ dayDay, itemIndex: -1 });
    this.clearAllActivityFilters();
    this.viewMode.set('swap-activity');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.fetchActivityInventory(this.cityForDay(dayDay), dayDay, 'event');
  }

  startCruiseAdd(dayDay: number): void {
    this.selectedActivityDetail.set(null);
    this.activityInventoryKind.set('cruise');
    this.swappingActivityRef.set({ dayDay, itemIndex: -1 });
    this.clearAllActivityFilters();
    this.viewMode.set('swap-activity');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.fetchActivityInventory(this.cityForDay(dayDay), dayDay, 'cruise');
  }

  startHolidayAdd(dayDay: number): void {
    this.selectedActivityDetail.set(null);
    this.activityInventoryKind.set('holiday');
    this.swappingActivityRef.set({ dayDay, itemIndex: -1 });
    this.clearAllActivityFilters();
    this.viewMode.set('swap-activity');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.fetchActivityInventory(this.cityForDay(dayDay), dayDay, 'holiday');
  }

  startHotelAdd(dayDay: number): void {
    this.selectedHotelDetail.set(null);
    this.swappingHotelRef.set({ dayDay, itemIndex: -1 });
    this.clearAllHotelFilters();
    this.viewMode.set('swap-hotel');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.fetchHotelInventory(this.cityForDay(dayDay) || String(this.trip?.destination || ''), dayDay);
  }

  startTransferAdd(dayDay: number): void {
    this.addingTransportRef.set({ dayDay, transportType: 'car' });
    const route = this.routeForTransportDay(dayDay);
    this.selectedCarDetail.set(null);
    this.carRentalReturnDay.set(this.dayOf(dayDay));
    this.clearAllCarFilters();
    this.viewMode.set('swap-car');
    this.contextualCars.set([]);
    this.loadingSwap.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const searchId = ++this.carSearchId;
    this.lastInventoryFetch = () => this.startTransferAdd(dayDay);
    this.tripService.searchInventory({
      type: 'transfer',
      location: route.depLocation,
      dep: route.depLocation,
      arr: route.arrLocation,
      date: this.isoDateForDay(dayDay),
      budget: this.budgetOption() || this.trip?.budget || 'standard',
    }).then((results) => {
      if (searchId !== this.carSearchId) return;
      this.contextualCars.set(results.map((r) => {
        const details = r.details || {};
        const from = String(details['from'] || route.depLocation);
        const to = String(details['to'] || route.arrLocation);
        return {
          id: r.id || crypto.randomUUID(),
          model: r.title || 'Private Transfer',
          category: String(details['vehicle_class'] || 'Transfer'),
          supplier: String(r.provider || 'TravelNext'),
          location: `${from} → ${to}`,
          dates: route.dateLabel,
          passengers: Number(details['passengers']) || 3,
          gearbox: 'Automatic',
          bags: Number(details['bags']) || 2,
          fuel: 'Included',
          mileage: 'Transfer',
          security: 0,
          price: typeof r.price === 'object' ? (r.price?.amount ?? 0) : (r.price ?? 0),
          imageUrl: this.pickImage(r.image_url, r.id || r.title || '', this.carImagePool),
          deepLink: r.deep_link,
          provider: r.provider,
          bookable: details['bookable'] === true,
          partnerMetadata: details,
          fromLocation: from,
          toLocation: to,
          duration: r.duration || undefined,
          fareSource: 'transfer' as const,
        };
      }) as AlternativeCar[]);
      this.loadingSwap.set(false);
    }).catch(() => {
      this.loadingSwap.set(false);
    });
  }

  /** Resolve which city a given itinerary day belongs to. */
  cityForDay(dayDay: number): string {
    const cities = this.cities();
    if (!cities.length) {
      const dest = this.trip?.destination || '';
      return dest.split(',')[0]?.trim() || 'Destination';
    }
    let cursor = 1;
    for (const c of cities) {
      if (dayDay < cursor + c.nights) {
        return c.name;
      }
      cursor += c.nights;
    }
    return cities[cities.length - 1]?.name || 'Destination';
  }

  /** Day number when travelling from city at index to the next city. */
  transferDayForCity(cityIndex: number): number | null {
    const cities = this.cities();
    if (cityIndex < 0 || cityIndex >= cities.length - 1) return null;
    let day = 1;
    for (let i = 0; i <= cityIndex; i++) {
      day += cities[i].nights;
    }
    return day - 1;
  }

  /** True when this day includes inter-city travel. */
  isTransferDay(dayDay: number): boolean {
    const cities = this.cities();
    let cursor = 1;
    for (let i = 0; i < cities.length - 1; i++) {
      if (dayDay === cursor + cities[i].nights - 1) return true;
      cursor += cities[i].nights;
    }
    return false;
  }

  private routeForTransportDay(dayDay: number): { dep: string; arr: string; depLocation: string; arrLocation: string; dateLabel: string } {
    const from = this.cityForDay(dayDay);
    const cities = this.cities();
    let to = from;
    let cursor = 1;
    for (let i = 0; i < cities.length; i++) {
      if (dayDay < cursor + cities[i].nights) {
        if (i < cities.length - 1) {
          to = cities[i + 1].name;
        }
        break;
      }
      cursor += cities[i].nights;
    }
    const start = new Date(this.tripStartDate());
    start.setDate(start.getDate() + dayDay - 1);
    const dateLabel = start.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' });
    return {
      dep: this.cityAirportCode(from),
      arr: this.cityAirportCode(to),
      depLocation: from,
      arrLocation: to,
      dateLabel,
    };
  }

  startTransportAdd(dayDay: number, transportType: 'flight' | 'train' | 'bus' | 'car'): void {
    this.addingTransportRef.set({ dayDay, transportType });
    const route = this.routeForTransportDay(dayDay);

    if (transportType === 'flight') {
      this.selectedFlightDetail.set(null);
      this.clearAllFilters();
      this.viewMode.set('swap-flight');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.tripService.searchInventory({
        type: 'flight',
        dep: route.dep,
        arr: route.arr,
        budget: this.budgetOption() || this.trip?.budget || 'standard',
      }).then(results => {
        this.contextualFlights.set(results.map(r => {
          const details = r.details || {};
          const airline = String(details['airline'] || details['carrier'] || r.provider || 'Airline');
          return {
            id: r.id || crypto.randomUUID(),
            carrier: airline,
            airlineCode: String(details['airline_code'] || airlineIataCode(airline)),
            flightNo: String(details['flight_number'] || r.title),
            logoUrl: safeAirlineLogoUrl(details['logoUrl'] as string | undefined) ?? airlineLogoAsset(airline),
            class: 'Economy',
            refundable: 'Partially Refundable',
            depDate: route.dateLabel,
            depTime: r.start_time || '10:00',
            depCode: route.dep,
            arrDate: route.dateLabel,
            arrTime: r.end_time || '14:00',
            arrCode: route.arr,
            duration: r.duration || '3h 00m',
            stops: 'Direct',
            status: 'Available',
            price: typeof r.price === 'object' ? (r.price?.amount ?? 0) : (r.price ?? 0),
            emission: '120 kg CO2',
          };
        }) as AlternativeFlight[]);
      });
      return;
    }

    if (transportType === 'train') {
      this.selectedTrainDetail.set(null);
      this.clearAllTrainFilters();
      this.viewMode.set('swap-train');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.tripService.searchInventory({
        type: 'train',
        dep: route.depLocation,
        arr: route.arrLocation,
        budget: this.budgetOption() || this.trip?.budget || 'standard',
      }).then(results => {
        this.contextualTrains.set(results.map(r => ({
          id: r.id || crypto.randomUUID(),
          carrier: String(r.details?.['operator'] || r.provider || 'Rail Express'),
          trainNo: String(r.details?.['flight_number'] || r.title),
          class: 'Standard',
          refundable: 'Partially Refundable',
          depDate: route.dateLabel,
          depTime: r.start_time || '08:00',
          depLocation: route.depLocation,
          arrDate: route.dateLabel,
          arrTime: r.end_time || '12:30',
          arrLocation: route.arrLocation,
          duration: r.duration || '4h 30m',
          stops: 'Direct',
          price: typeof r.price === 'object' ? (r.price?.amount ?? 0) : (r.price ?? 0),
          emission: '25 kg CO2',
          imageUrl: this.pickImage(r.image_url, r.id || r.title || '', this.trainImagePool),
          bookable: r.details?.['bookable'] === true,
          partnerMetadata: r.details || {},
        })) as AlternativeTrain[]);
      });
      return;
    }

    if (transportType === 'bus') {
      this.clearAllBusFilters();
      this.viewMode.set('swap-bus');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.tripService.searchInventory({
        type: 'bus',
        dep: route.depLocation,
        arr: route.arrLocation,
        budget: this.budgetOption() || this.trip?.budget || 'standard',
      }).then(results => {
        this.contextualBuses.set(results.map(r => ({
          id: r.id || crypto.randomUUID(),
          carrier: String(r.provider || 'Intercity Bus'),
          depDate: route.dateLabel,
          depTime: r.start_time || '07:30',
          depLocation: route.depLocation,
          arrDate: route.dateLabel,
          arrTime: r.end_time || '13:00',
          arrLocation: route.arrLocation,
          duration: r.duration || '5h 30m',
          stops: '1 Stop',
          class: 'Standard',
          seatType: 'Standard Recliner',
          operator: String(r.provider || 'Intercity Bus'),
          rating: '4.5',
          refundable: 'Non-Refundable',
          price: typeof r.price === 'object' ? (r.price?.amount ?? 0) : (r.price ?? 0),
          imageUrl: this.pickImageByKeyword(r.image_url, r.id || r.title || '', String(r.provider || ''), this.busKeywordLogos, this.busImagePool),
        })) as AlternativeBus[]);
      });
      return;
    }

    // car / transfer — resolve exact stops, drive duration, and live fares
    this.selectedCarDetail.set(null);
    this.carRentalReturnDay.set(this.dayOf(dayDay));
    this.clearAllCarFilters();
    this.viewMode.set('swap-car');
    this.contextualCars.set([]);
    this.loadingSwap.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const searchId = ++this.carSearchId;
    void this.loadTransferOptionsForDay(dayDay, route).finally(() => {
      if (searchId === this.carSearchId) this.loadingSwap.set(false);
    });
  }

  /** Geocode day stops → Google Routes duration → TravelNext/car fares. */
  private async loadTransferOptionsForDay(
    dayDay: number,
    route: { depLocation: string; arrLocation: string; dateLabel: string },
    aroundItemIndex?: number,
  ): Promise<void> {
    const day = this.displayedDays().find((d) => d.day === dayDay);
    const cityHint = route.depLocation || this.cityForDay(dayDay);
    const adjacent = day
      ? aroundItemIndex != null
        ? this.transferPlan.adjacentStopsAroundIndex(day.items, aroundItemIndex, cityHint)
        : this.transferPlan.adjacentStopsForDay(day.items, cityHint)
      : null;
    const from = adjacent?.from || { label: route.depLocation };
    const to = adjacent?.to || { label: route.arrLocation };
    const start = new Date(this.tripStartDate());
    start.setDate(start.getDate() + dayDay - 1);
    const dateIso = start.toISOString().slice(0, 10);

    try {
      const plan = await this.transferPlan.planLeg(from, to, {
        day: dayDay,
        dateIso,
        travelers: this.trip?.travelers || 2,
        budget: this.budgetOption() || this.trip?.budget || 'standard',
        cityHint: route.depLocation,
      });
      this.contextualCars.set(
        plan.legs.map((leg, idx) => this.legToAlternativeCar(leg, idx)),
      );
      if (plan.best && plan.legs.length > 1) {
        this.toast.info(
          this.translate.instant('ITINERARY.TOAST.TRANSFER_PLAN_READY', {
            from: plan.fromLabel,
            to: plan.toLabel,
            duration: plan.best.duration,
            fare: this.formatTransferFare(plan.best.price),
          }),
        );
      }
    } catch (err) {
      console.error('Transfer plan failed', err);
      // Fallback to plain car inventory at origin city (bounded so loading always clears)
      try {
        const results = await Promise.race([
          this.tripService.searchInventory({
            type: 'car',
            location: route.depLocation,
            budget: this.budgetOption() || this.trip?.budget || 'standard',
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('inventory timeout')), 4000),
          ),
        ]);
        this.contextualCars.set(
          results.map((r) => ({
            id: r.id || crypto.randomUUID(),
            model: String(r.title || 'Transfer Sedan'),
            category: 'Transfer',
            location: `${route.depLocation} → ${route.arrLocation}`,
            fromLocation: route.depLocation,
            toLocation: route.arrLocation,
            passengers: this.trip?.travelers || 2,
            gearbox: 'Automatic',
            bags: 2,
            fuel: 'Included',
            mileage: 'Route-based',
            security: 0,
            supplier: String(r.provider || 'Partner'),
            price: this.formatTransferFare(
              typeof r.price === 'object' ? (r.price?.amount ?? 0) : (r.price ?? 0),
            ),
            imageUrl: this.pickImage(r.image_url, r.id || r.title || '', this.carImagePool),
            fareSource: 'car' as const,
          })) as AlternativeCar[],
        );
      } catch {
        this.contextualCars.set([
          {
            id: `fallback-${dayDay}`,
            model: 'Private transfer',
            category: 'Transfer',
            location: `${route.depLocation} → ${route.arrLocation}`,
            fromLocation: route.depLocation,
            toLocation: route.arrLocation,
            passengers: this.trip?.travelers || 2,
            gearbox: 'Automatic',
            bags: 2,
            fuel: 'Included',
            mileage: 'Route-based',
            security: 0,
            supplier: 'Partner',
            price: 400,
            imageUrl: this.pickImage(undefined, 'Private transfer', this.carImagePool),
            fareSource: 'route_estimate' as const,
          } as AlternativeCar,
        ]);
      }
    }
  }

  private formatTransferFare(price: number): number {
    const n = Number(price);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n);
  }

  private legToAlternativeCar(leg: TransferLegPlan, idx: number): AlternativeCar {
    return {
      id: `leg-${idx}-${leg.model}`.replace(/\s+/g, '-').toLowerCase(),
      model: leg.model,
      category: leg.category || 'Transfer',
      location: `${leg.from.label} → ${leg.to.label}`,
      fromLocation: leg.from.label,
      toLocation: leg.to.label,
      passengers: this.trip?.travelers || 2,
      gearbox: 'Automatic',
      bags: Math.max(2, this.trip?.travelers || 2),
      fuel: 'Included',
      mileage: leg.distanceKm != null ? `${leg.distanceKm.toFixed(1)} km` : 'Route-based',
      security: 0,
      supplier: leg.provider || 'Partner',
      price: this.formatTransferFare(leg.price),
      imageUrl: leg.imageUrl || this.pickImage(undefined, leg.model, this.carImagePool),
      deepLink: leg.deepLink,
      provider: leg.provider,
      duration: leg.duration,
      durationMinutes: leg.durationMinutes,
      distanceKm: leg.distanceKm,
      fareSource: leg.source,
      bookable: leg.bookable,
      partnerMetadata: leg.partnerMetadata,
    };
  }

  private finishAddingTransport(item: DetailItem): void {
    const ref = this.addingTransportRef();
    if (!ref) return;
    const dayDay = ref.dayDay;
    this.upsertTransportOnDay(dayDay, item);
    this.addingTransportRef.set(null);
    this.viewMode.set('itinerary');
    void (async () => {
      try {
        await this.enqueueTransferPlan(dayDay, { silent: true });
      } finally {
        await this.syncCustomizationsToBackend();
      }
    })();
  }

  /**
   * Replace same-type transport on a day (segments SoT). Clears stale swap
   * overlays so the new selection is not covered by an old Change overlay.
   */
  private upsertTransportOnDay(dayDay: number, item: DetailItem): void {
    const withoutSame = this.addedTransport().filter(
      (t) => !(this.dayOf(t.dayDay) === this.dayOf(dayDay) && t.item.type === item.type),
    );
    const withId = {
      ...item,
      id:
        (item as { id?: string }).id ||
        `slot-d${this.dayOf(dayDay)}-${item.type}-${Date.now().toString(36).slice(-5)}`,
    } as DetailItem;

    if (this.trip) {
      let replaced = false;
      const clearedKeys: string[] = [];
      this.trip.segments = (this.trip.segments || []).map((seg) => {
        if (seg.type !== item.type || this.dayOf(seg.day) !== this.dayOf(dayDay)) return seg;
        if (replaced) return seg;
        replaced = true;
        clearedKeys.push(this.getItemKey(seg as unknown as DetailItem));
        if (seg.type === 'car' && (seg as DetailCar).model) {
          clearedKeys.push(`car-${(seg as DetailCar).model}`);
        }
        return {
          ...withId,
          day: dayDay,
          id: (seg as { id?: string }).id || (withId as { id?: string }).id,
        } as typeof seg;
      });
      if (!replaced) {
        this.trip.segments = [
          ...(this.trip.segments || []),
          { ...withId, day: dayDay } as (typeof this.trip.segments)[number],
        ];
      }
      this.addedTransport.set(withoutSame);
      if (
        item.type === 'train' ||
        item.type === 'bus' ||
        item.type === 'flight' ||
        item.type === 'car'
      ) {
        this.clearTransportSwapOverrides(item.type, dayDay, clearedKeys);
      }
      if (item.type === 'car') this.collapseDuplicateCarsOnDay(dayDay);
    } else {
      this.addedTransport.set([...withoutSame, { dayDay, item: withId }]);
    }
    this.tripSegmentsVersion.update((v) => v + 1);
  }

  /**
   * After an activity is added/swapped, recompute the transfer for adjacent
   * stops and update an existing car card (or insert one) with live location,
   * duration, distance, and fare.
   */
  private async autoPlanTransferAfterActivityChange(
    dayDay: number,
    opts?: { silent?: boolean },
  ): Promise<void> {
    const day = this.displayedDays().find((d) => d.day === dayDay);
    if (!day || day.items.length < 2) return;

    const existingOnDay = day.items.find((i) => i.type === 'car') as DetailCar | undefined;
    // User-booked multi-day rentals must not be replaced by A→B transfer replans.
    if (this.isProtectedMultiDayRental(existingOnDay)) return;

    const cityHint = this.cityForDay(dayDay);
    const adjacent = this.transferPlan.adjacentStopsForDay(day.items, cityHint);
    if (!adjacent) return;

    // Same stop both sides — nothing useful to replan.
    if (
      adjacent.from.label.trim().toLowerCase() ===
      adjacent.to.label.trim().toLowerCase()
    ) {
      return;
    }

    const start = new Date(this.tripStartDate());
    start.setDate(start.getDate() + dayDay - 1);
    const dateLabel = start.toLocaleDateString('en-US', {
      weekday: 'short',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const carIndex = this.findTransferCarIndexToRefresh(day.items, adjacent);
    const targetItem =
      carIndex >= 0
        ? day.items[carIndex]
        : day.items.find((i) => i.type === 'car') || null;

    // Optimistic UI: rewrite route/location immediately so the card never
    // stays stuck on a stale airport transfer while fares load.
    const optimistic: AlternativeCar = {
      id: `optimistic-${dayDay}`,
      model: targetItem?.type === 'car'
        ? this.cleanCarModel((targetItem as DetailCar).model)
        : 'Private transfer',
      category:
        targetItem?.type === 'car'
          ? (targetItem as DetailCar).category || 'Transfer'
          : 'Transfer',
      location: `${adjacent.from.label} → ${adjacent.to.label}`,
      fromLocation: adjacent.from.label,
      toLocation: adjacent.to.label,
      passengers: this.trip?.travelers || 2,
      gearbox: 'Automatic',
      bags: 2,
      fuel: 'Included',
      mileage: 'Route-based',
      security: 0,
      supplier:
        (targetItem?.type === 'car' && (targetItem as DetailCar).provider) ||
        'Partner',
      price:
        targetItem?.type === 'car'
          ? Number((targetItem as DetailCar).price) || 0
          : 0,
      imageUrl: targetItem?.type === 'car' ? (targetItem as DetailCar).imageUrl : undefined,
      duration: '…',
      fareSource: 'route_estimate',
    };
    if (targetItem?.type === 'car') {
      this.applyCarTransferUpdate(dayDay, targetItem, optimistic, dateLabel);
      this.collapseDuplicateCarsOnDay(dayDay);
      this.tripSegmentsVersion.update((v) => v + 1);
    }

    if (!opts?.silent) {
      this.toast.info(this.translate.instant('ITINERARY.TOAST.TRANSFER_PLANNING'));
    }
    try {
      const plan = await this.transferPlan.planLeg(adjacent.from, adjacent.to, {
        day: dayDay,
        dateIso: start.toISOString().slice(0, 10),
        travelers: this.trip?.travelers || 2,
        budget: this.budgetOption() || this.trip?.budget || 'standard',
        cityHint,
      });
      if (!plan.best) return;

      const alt = this.legToAlternativeCar(plan.best, 0);
      // Re-read day after optimistic patch / activity overlays.
      const latestDay = this.displayedDays().find((d) => d.day === dayDay);
      const latestCarIndex = latestDay
        ? this.findTransferCarIndexToRefresh(latestDay.items, adjacent)
        : carIndex;
      const latestItem =
        latestDay && latestCarIndex >= 0
          ? latestDay.items[latestCarIndex]
          : targetItem;

      // Always update an existing day car — never append a second transfer card.
      const existingCar =
        latestItem?.type === 'car'
          ? latestItem
          : latestDay?.items.find((i) => i.type === 'car') ||
            day.items.find((i) => i.type === 'car') ||
            null;
      if (existingCar?.type === 'car') {
        this.applyCarTransferUpdate(dayDay, existingCar, alt, dateLabel);
      } else {
        const car = this.transferPlan.toDetailCar(
          plan.best,
          dateLabel,
          this.trip?.travelers || 2,
        );
        this.upsertTransportOnDay(dayDay, {
          ...car,
          id: car.id || `slot-d${this.dayOf(dayDay)}-car`,
        } as DetailCar);
      }
      this.collapseDuplicateCarsOnDay(dayDay);

      this.tripSegmentsVersion.update((v) => v + 1);
      await this.syncCustomizationsToBackend();
      if (!opts?.silent) {
        this.toast.success(
          this.translate.instant('ITINERARY.TOAST.TRANSFER_AUTO_ADDED', {
            from: plan.fromLabel,
            to: plan.toLabel,
            duration: plan.best.duration,
            fare: this.formatTransferFare(plan.best.price),
          }),
        );
      }
    } catch (err) {
      console.warn('Auto transfer plan failed', err);
      if (!opts?.silent) {
        this.toast.error(
          this.translate.instant('ITINERARY.TOAST.TRANSFER_PLAN_FAILED'),
        );
      }
    }
  }

  /** Strip inventory suffixes like "in Goa → Goa" from car titles. */
  private cleanCarModel(model: string): string {
    const cleaned = String(model || '')
      .replace(/\s+in\s+.+$/i, '')
      .replace(/\s*[–—-]\s*$/g, '')
      .trim();
    return cleaned || model;
  }

  /**
   * Keep a single car/transfer card per day. Extra cards appear when auto-plan
   * previously appended while an inventory car already existed.
   */
  private collapseDuplicateCarsOnDay(dayDay: number): void {
    const dayOf = (value: unknown) => Number(value) || 1;

    if (this.trip?.segments?.length) {
      let keptSeg = false;
      this.trip.segments = this.trip.segments.filter((seg) => {
        if (seg.type !== 'car' || dayOf(seg.day) !== dayOf(dayDay)) return true;
        if (keptSeg) return false;
        keptSeg = true;
        return true;
      });
    }

    let keptAdded = false;
    const hasSegmentCar = (this.trip?.segments || []).some(
      (seg) => seg.type === 'car' && dayOf(seg.day) === dayOf(dayDay),
    );
    this.addedTransport.set(
      this.addedTransport().filter((t) => {
        if (this.dayOf(t.dayDay) !== dayOf(dayDay) || t.item.type !== 'car') return true;
        // Prefer the segment car; drop all addedTransport cars for the day.
        if (hasSegmentCar) return false;
        if (keptAdded) return false;
        keptAdded = true;
        return true;
      }),
    );
  }

  /**
   * Persist transfer fields onto the trip segment (source of truth) and
   * swappedCars under a stable per-slot id key only (never car-${model},
   * which collides across days and bleeds overlays).
   */
  private applyCarTransferUpdate(
    dayDay: number,
    currentItem: DetailItem,
    alt: AlternativeCar,
    dateLabel: string,
  ): void {
    if (
      currentItem.type === 'car' &&
      this.isProtectedMultiDayRental(currentItem as DetailCar)
    ) {
      return;
    }
    const distanceLabel =
      alt.distanceKm != null ? ` · ${Number(alt.distanceKm).toFixed(1)} km` : '';
    const location =
      alt.location ||
      [alt.fromLocation, alt.toLocation].filter(Boolean).join(' → ');
    const derived = this.toDetailCar(alt);
    const patch: Partial<DetailCar> = {
      ...derived,
      model: derived.model || this.cleanCarModel(alt.model),
      location,
      dates: `${dateLabel}${alt.duration ? ` · ${alt.duration}` : ''}${distanceLabel}`,
      fromLocation: alt.fromLocation,
      toLocation: alt.toLocation,
      price: alt.price,
      duration: alt.duration,
      durationMinutes: alt.durationMinutes,
      distanceKm: alt.distanceKm ?? undefined,
      category: derived.category || alt.category || 'Transfer',
      autoInserted: true,
    };

    const currentCar = currentItem as DetailCar;
    const currentKey = this.getItemKey(currentItem);
    const slotKeys = new Set<string>();
    const legacyModelAliases = new Set<string>();
    if (currentCar.model) legacyModelAliases.add(`car-${currentCar.model}`);
    if (alt.model) legacyModelAliases.add(`car-${this.cleanCarModel(alt.model)}`);

    if (this.trip?.segments?.length) {
      let matched = false;
      this.trip.segments = this.trip.segments.map((seg, index) => {
        if (seg.type !== 'car' || this.dayOf(seg.day) !== this.dayOf(dayDay)) return seg;
        const segCar = seg as DetailCar;
        const segKey = this.getItemKey(seg as unknown as DetailItem);
        const sameId = !!segCar.id && !!currentCar.id && segCar.id === currentCar.id;
        const sameModel =
          String(segCar.model || '') === String(currentCar.model || '');
        const staleAirport = /airport/i.test(String(segCar.location || ''));
        if (
          !matched &&
          (segKey === currentKey || sameId || sameModel || staleAirport)
        ) {
          matched = true;
          const stableId = segCar.id || `slot-d${this.dayOf(dayDay)}-i${index}`;
          slotKeys.add(`car-${stableId}`);
          if (segCar.model) legacyModelAliases.add(`car-${segCar.model}`);
          return {
            ...seg,
            ...patch,
            id: stableId,
            day: this.dayOf(seg.day),
            type: 'car' as const,
          };
        }
        return seg;
      });

      if (!matched) {
        let replaced = false;
        this.trip.segments = this.trip.segments.map((seg, index) => {
          if (
            replaced ||
            seg.type !== 'car' ||
            this.dayOf(seg.day) !== this.dayOf(dayDay)
          ) {
            return seg;
          }
          replaced = true;
          const segCar = seg as DetailCar;
          const stableId = segCar.id || `slot-d${this.dayOf(dayDay)}-i${index}`;
          slotKeys.add(`car-${stableId}`);
          if (segCar.model) legacyModelAliases.add(`car-${segCar.model}`);
          return {
            ...seg,
            ...patch,
            id: stableId,
            day: this.dayOf(seg.day),
            type: 'car' as const,
          };
        });
      }
    }

    if (
      this.addedTransport().some(
        (t) => this.dayOf(t.dayDay) === this.dayOf(dayDay) && t.item.type === 'car',
      )
    ) {
      this.addedTransport.set(
        this.addedTransport().map((t) => {
          if (this.dayOf(t.dayDay) !== this.dayOf(dayDay) || t.item.type !== 'car') {
            return t;
          }
          const prev = t.item as DetailCar;
          const stableId = prev.id || `slot-d${this.dayOf(dayDay)}-added`;
          slotKeys.add(`car-${stableId}`);
          if (prev.model) legacyModelAliases.add(`car-${prev.model}`);
          return {
            ...t,
            item: {
              ...prev,
              ...patch,
              id: stableId,
              type: 'car' as const,
            },
          };
        }),
      );
    }

    // Fallback key if no segment/added car was patched (should be rare).
    if (!slotKeys.size) {
      const stableId = currentCar.id || `slot-d${this.dayOf(dayDay)}-cur`;
      slotKeys.add(`car-${stableId}`);
    }

    const enrichedAlt: AlternativeCar = {
      ...alt,
      model: this.cleanCarModel(alt.model),
      location,
    };
    const next = { ...this.swappedCars() };
    // Drop legacy model-alias keys so Day A "Private transfer" cannot paint Day B.
    for (const alias of legacyModelAliases) {
      if (!slotKeys.has(alias)) delete next[alias];
    }
    for (const k of slotKeys) next[k] = enrichedAlt;
    this.swappedCars.set(next);
  }

  /** Prefer the car between the two place stops; else a stale/airport car; else last car. */
  private findTransferCarIndexToRefresh(
    items: DetailItem[],
    adjacent: { from: { label: string }; to: { label: string } },
  ): number {
    const cars = items
      .map((it, i) => ({ it, i }))
      .filter((x) => x.it.type === 'car');
    if (!cars.length) return -1;

    const placeIndices: number[] = [];
    items.forEach((it, i) => {
      if (it.type === 'activity' || it.type === 'hotel') placeIndices.push(i);
    });
    if (placeIndices.length >= 2) {
      const a = placeIndices[placeIndices.length - 2];
      const b = placeIndices[placeIndices.length - 1];
      const between = cars.find((c) => c.i > a && c.i < b);
      if (between) return between.i;
    }

    const routeNorm = `${adjacent.from.label}→${adjacent.to.label}`
      .toLowerCase()
      .replace(/\s+/g, '');
    const matching = cars.find((c) =>
      String((c.it as DetailCar).location || '')
        .toLowerCase()
        .replace(/\s+/g, '')
        .includes(routeNorm),
    );
    if (matching) return matching.i;

    const stale = cars.find((c) => {
      const car = c.it as DetailCar;
      const loc = String(car.location || '').toLowerCase();
      return (
        !!car.autoInserted ||
        loc.includes('airport') ||
        /goa\s*->\s*goa/.test(loc) ||
        car.durationMinutes == null
      );
    });
    if (stale) return stale.i;

    return cars[cars.length - 1].i;
  }

  // --- Inventory card imagery ---------------------------------------------
  // Provider images aren't always available on inventory items yet, so when one
  // is missing we fall back to a curated, type-appropriate pool. The choice is
  // deterministic per item (stable across re-renders and filtering) but varies
  // between items, so cards no longer all share a single placeholder.
  private readonly activityImagePool = [
    // Omit journey-thailand — it was the shared demo pic on every activity card.
    'assets/images/landing/journey-singapore.jpg',
    'assets/images/landing/journey-china.jpg',
    'assets/images/landing/journey-norway.jpg',
    'assets/images/landing/journey-kenya.jpg',
    'assets/images/landing/journey-philippines.jpg',
    'assets/images/landing/journey-abudhabi.jpg',
    'assets/images/landing/iconic-uae.jpg',
    'assets/images/landing/iconic-usa.jpg',
    'assets/images/landing/iconic-india.jpg',
    'assets/images/landing/iconic-australia.jpg',
    'assets/images/landing/iconic-switzerland.jpg',
    'assets/images/landing/europe-belgium.jpg',
    'assets/images/landing/europe-london.jpg',
    'assets/images/landing/europe-austria.jpg',
    'assets/images/landing/maldives.jpg',
    'assets/images/landing/seychelles.jpg',
    'assets/images/landing/mauritius.jpg',
    'assets/images/landing/malaysia.jpg',
    'assets/images/landing/sri-lanka.jpg',
  ];
  private readonly carImagePool = [
    'assets/images/cars/camry.png', 'assets/images/cars/citroen.png', 'assets/images/cars/kona.png',
    'assets/images/cars/kuga.png', 'assets/images/cars/peugeot.png', 'assets/images/cars/polo.png',
    'assets/images/cars/volvo.png',
  ];
  private readonly hotelImagePool = [
    'assets/images/hotels/banville.png', 'assets/images/hotels/bristol.png', 'assets/images/hotels/burgundy.png',
    'assets/images/hotels/eiffel_turenne.png', 'assets/images/hotels/grands_boulevards.png', 'assets/images/hotels/la_comtesse.png',
    'assets/images/hotels/marais.png', 'assets/images/hotels/marriott.png', 'assets/images/hotels/montmartre.png',
    'assets/images/hotels/porte_doree.png', 'assets/images/hotels/radisson_blu.png',
  ];
  private readonly busImagePool = [
    'assets/images/buses/alsa.png', 'assets/images/buses/bla_bla_car.png',
    'assets/images/buses/flixbus.png', 'assets/images/buses/infobus.png',
  ];
  private readonly trainImagePool = [
    'assets/images/trains/tgv.png', 'assets/images/trains/ave.png', 'assets/images/trains/ouigo.png',
  ];
  // Operator-name keyword -> matching bus logo (so e.g. FlixBus shows the FlixBus logo).
  private readonly busKeywordLogos: Record<string, string> = {
    flixbus: 'assets/images/buses/flixbus.png',
    flix: 'assets/images/buses/flixbus.png',
    alsa: 'assets/images/buses/alsa.png',
    'bla bla': 'assets/images/buses/bla_bla_car.png',
    blabla: 'assets/images/buses/bla_bla_car.png',
    infobus: 'assets/images/buses/infobus.png',
  };

  private isGenericItineraryImage(url: string | null | undefined): boolean {
    const img = (url || '').toLowerCase();
    return !img ||
      img.includes('/packages/') ||
      img.includes('/landing/') ||
      img.includes('/figma/') ||
      img.includes('/trips/') ||
      img.includes('journey-thailand') ||
      img.includes('hero-main') ||
      img.includes('hero-extra');
  }

  private isExternalImage(url: string | null | undefined): boolean {
    return /^https?:\/\//i.test((url || '').trim());
  }

  /** Prefer a real provider image; otherwise pick a stable, varied image from the pool by key. */
  private pickImage(preferred: string | null | undefined, key: string, pool: string[]): string {
    if (preferred && preferred.trim() && !this.isGenericItineraryImage(preferred)) return preferred;
    let hash = 0;
    const k = key || '';
    for (let i = 0; i < k.length; i++) hash = (hash * 31 + k.charCodeAt(i)) | 0;
    return pool[Math.abs(hash) % pool.length];
  }

  /** Prefer a real provider image, then a keyword (operator) match, then a varied pool image. */
  private pickImageByKeyword(
    preferred: string | null | undefined,
    key: string,
    keyword: string,
    keywordMap: Record<string, string>,
    pool: string[],
  ): string {
    if (preferred && preferred.trim() && !this.isGenericItineraryImage(preferred)) return preferred;
    const text = (keyword || '').toLowerCase();
    for (const kw of Object.keys(keywordMap)) {
      if (text.includes(kw)) return keywordMap[kw];
    }
    return this.pickImage(undefined, key, pool);
  }

  private isoDateForDay(dayDay: number): string {
    const start = new Date(this.tripStartDate());
    start.setDate(start.getDate() + dayDay - 1);
    return start.toISOString().slice(0, 10);
  }

  private fetchActivityInventory(
    city: string,
    dayDay?: number,
    kind: 'activity' | 'event' | 'cruise' | 'holiday' = 'activity',
  ): void {
    this.lastInventoryFetch = () => this.fetchActivityInventory(city, dayDay, kind);
    this.contextualActivities.set([]);
    this.loadingSwap.set(true);
    const searchId = ++this.activitySearchId;
    const date = dayDay != null ? this.isoDateForDay(dayDay) : undefined;
    this.tripService.searchInventory({
      type: kind,
      location: city,
      date,
      budget: this.trip?.budget || 'standard'
    }).then(results => {
      if (searchId !== this.activitySearchId) return;
      const defaultAttraction =
        kind === 'event' ? 'Event'
        : kind === 'cruise' ? 'Cruise'
        : kind === 'holiday' ? 'Holiday'
        : 'tours';
      const mapped = results.map(r => {
        const details = r.details || {};
        const ratingRaw = details['rating'] ?? 4.8;
        const rating = typeof ratingRaw === 'number' ? ratingRaw : Number(ratingRaw) || 4.8;
        const freeCancel = details['free_cancellation'] === true;
        const contentOnly =
          details['content_only'] === true ||
          details['bookable'] === false ||
          r.provider === 'tripadvisor' ||
          r.provider === 'google_places';
        const livePrice = typeof r.price === 'number' ? r.price : Number(r.price);
        const locationLabel =
          details['location'] ||
          details['venue'] ||
          details['city'] ||
          details['country'] ||
          city ||
          'City Center';
        return {
          id: r.id || 'act-' + Math.random(),
          title: r.title,
          rating,
          reviewCount: typeof details['number_of_reviews'] === 'number' ? details['number_of_reviews'] : undefined,
          location: locationLabel,
          city: city,
          distance: details['distance'] || '',
          refundable: freeCancel ? 'Free Cancellation' : String(details['refundable'] || 'See attraction policy'),
          // Content-only providers have no bookable price — keep 0 so UI can hide it.
          price: contentOnly ? 0 : (Number.isFinite(livePrice) && livePrice > 0 ? livePrice : 100),
          image: this.pickImage(r.image_url || details['photo'], r.id || r.title || '', this.activityImagePool),
          timeOfDay: 'Morning',
          duration: String(
            details['duration'] ||
            r.duration ||
            (kind === 'cruise' || kind === 'holiday' ? 'Multi-day' : '2h'),
          ),
          attractionType: String(
            details['attraction_type'] ||
            details['category'] ||
            details['travel_style'] ||
            (details['categories'] || [])[0] ||
            defaultAttraction,
          ).replace(/_/g, ' '),
          locationType: 'In City Center',
          deepLink: r.deep_link || details['deep_link'],
          provider: r.provider,
          contentOnly,
          lat: typeof details['lat'] === 'number' ? details['lat'] : Number(details['lat']) || undefined,
          lng: typeof details['lng'] === 'number' ? details['lng'] : Number(details['lng']) || undefined,
          placeId: details['place_id'] ? String(details['place_id']) : undefined,
          bookable: details['bookable'] === true,
          partnerMetadata: details,
        };
      }) as AlternativeActivity[];
      this.contextualActivities.set(mapped);
      this.loadingSwap.set(false);
    }).catch(() => {
      this.loadingSwap.set(false);
    });
  }

  cancelActivitySwap(): void {
    this.viewMode.set('itinerary');
    this.swappingActivityRef.set(null);
    this.selectedActivityDetail.set(null);
    this.activityInventoryKind.set('activity');
  }

  openActivityDetail(activity: AlternativeActivity): void {
    this.selectedActivityDetail.set(activity);
    this.activityGalleryIndex.set(0);
    this.activityDetailTravelers.set(2);
    const slots = this.buildActivityDetailContent(activity).timeSlots;
    this.activityDetailTimeSlot.set(slots[0] ?? '');
    this.viewMode.set('activity-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  backToActivityList(): void {
    this.selectedActivityDetail.set(null);
    this.viewMode.set('swap-activity');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  incrementActivityTravelers(): void {
    const max = this.activityDetailContent().maxGroupSize;
    this.activityDetailTravelers.update((count) => Math.min(max, count + 1));
  }

  decrementActivityTravelers(): void {
    this.activityDetailTravelers.update((count) => Math.max(1, count - 1));
  }

  selectAlternativeActivity(activity: AlternativeActivity): void {
    // Capture ref before clearing any swap UI state — a null ref used to
    // silently no-op, which felt like "Select" did nothing.
    const ref = this.swappingActivityRef();
    if (!ref) {
      this.toast.error(this.translate.instant('ITINERARY.TOAST.SAVE_CHANGES_FAILED'));
      return;
    }

    const timeOfDay = (this.activityDetailTimeSlot() || activity.timeOfDay || 'Morning') as AlternativeActivity['timeOfDay'];
    const travelers = this.activityDetailTravelers() || this.trip?.travelers || 2;
    const price = (activity.price || 0) * travelers;
    const clonedActivity: AlternativeActivity = {
      ...activity,
      id: activity.id || `added-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timeOfDay,
      price,
    };

    const targetDay = ref.dayDay;
    if (ref.itemIndex === -1) {
      const detail = this.toDetailActivity(clonedActivity);
      this.addedActivities.set([
        ...this.addedActivities(),
        { dayDay: targetDay, activity: clonedActivity },
      ]);
      // Also append into segments so the day timeline picks it up even if the
      // customizations merge path fails or is wiped by a reload.
      if (this.trip) {
        const segment = { ...detail, day: targetDay, type: 'activity' as const };
        this.trip.segments = [...(this.trip.segments || []), segment];
      }
    } else {
      const days = this.displayedDays();
      const day = days.find(d => d.day === targetDay);
      const item = day?.items[ref.itemIndex];
      const itemKey = item ? this.getItemKey(item) : `${targetDay}-${ref.itemIndex}`;
      if (item?.type === 'activity') {
        this.chatLearning.trackOutcome(this.trip?.id ?? null, {
          city: activity.city || this.cityForDay(targetDay),
          activity_title: item.title,
          event_type: 'swapped',
          budget_tier: this.trip?.budget || 'standard',
          day_number: targetDay,
          source: 'chat',
        });
      }
      this.swappedActivities.set({ ...this.swappedActivities(), [itemKey]: clonedActivity });
    }

    // Force timeline recompute + leave the picker before save (keep optimistic UI).
    this.tripSegmentsVersion.update((v) => v + 1);
    this.selectedActivityDetail.set(null);
    this.swappingActivityRef.set(null);
    this.viewMode.set('itinerary');
    this.activeDayTab.set(targetDay);

    this.toast.success(
      this.translate.instant('ITINERARY.TOAST.ACTIVITY_ADDED', { day: targetDay }),
    );
    setTimeout(() => this.scrollToDay(targetDay), 100);

    // Replan transfer then persist (sequential — parallel saves can overwrite the car patch).
    void (async () => {
      try {
        await this.enqueueTransferPlan(targetDay);
      } finally {
        await this.syncCustomizationsToBackend();
      }
    })();
  }

  private buildActivityDetailContent(act: AlternativeActivity): ActivityDetailContent {
    const galleryPool = [
      act.image,
      'assets/images/packages/paris_madrid.png',
      'assets/images/packages/rec_swiss.png',
      'assets/images/packages/rec_rome.png',
    ];
    const gallery = [...new Set(galleryPool)];

    const timeSlotsByDay: Record<string, string[]> = {
      Morning: ['08:00 AM', '09:30 AM'],
      Noon: ['11:00 AM', '01:30 PM'],
      Evening: ['04:00 PM', '06:30 PM'],
      Night: ['07:30 PM', '09:00 PM'],
      Halfday: ['09:00 AM', '02:00 PM'],
      Fullday: ['08:30 AM', '09:00 AM'],
    };

    return {
      overview: `Discover ${act.title} in ${act.city}. This ${act.duration.toLowerCase()} ${act.attractionType.toLowerCase()} experience is ideal for travellers who want a curated outing with local insight, convenient logistics, and a well-paced schedule. Meet your guide at the designated point and enjoy a memorable experience tailored for small groups.`,
      highlights: [
        `Rated ${act.rating} by verified travellers`,
        `${act.duration} guided experience in ${act.city}`,
        `${act.attractionType} with expert local commentary`,
        act.isPopular ? 'One of the most booked experiences in this city' : 'Carefully selected experience for your itinerary',
        act.isLocalExpert ? 'Led by a certified local expert guide' : 'Professional guide included',
        `${act.refundable} booking terms`,
      ],
      included: [
        'Professional guide',
        'Entry tickets where applicable',
        'Headsets for groups above 8 people',
        'Digital confirmation and mobile voucher',
      ],
      notIncluded: [
        'Hotel pickup unless stated',
        'Food and drinks unless specified',
        'Personal expenses and gratuities',
        'Travel insurance',
      ],
      meetingPoint: `${act.location} — ${act.distance}. Please arrive 15 minutes before the selected departure time.`,
      pickupInfo: act.locationType === 'Near Your Hotel'
        ? 'Pickup available from selected hotels in the city centre. Exact pickup time will be shared after booking.'
        : 'This experience starts at the meeting point. Transfers from your hotel are not included unless mentioned in the inclusions.',
      cancellationPolicy: `${act.refundable}. Changes to traveller count or time slot may be subject to availability. Please review the operator terms before confirming your selection.`,
      gallery,
      reviewCount: Math.round(180 + act.rating * 120),
      languages: ['English', 'French', act.city === 'Barcelona' || act.city === 'Madrid' ? 'Spanish' : 'Local language on request'],
      timeSlots: timeSlotsByDay[act.timeOfDay] ?? ['09:00 AM', '02:00 PM'],
      maxGroupSize: 15,
    };
  }

  toggleActivityTimeFilter(value: string): void {
    const current = this.activityTimeFilter();
    this.activityTimeFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  toggleActivityDurationFilter(value: string): void {
    const current = this.activityDurationFilter();
    this.activityDurationFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  toggleActivityTypeFilter(value: string): void {
    const current = this.activityTypeFilter();
    this.activityTypeFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  toggleActivityLocationFilter(value: string): void {
    const current = this.activityLocationFilter();
    this.activityLocationFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  toggleActivityHighlightFilter(value: string): void {
    const current = this.activityHighlightFilter();
    this.activityHighlightFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  clearAllActivityFilters(): void {
    this.activityPriceFilter.set(40000);
    this.activityTimeFilter.set([]);
    this.activityDurationFilter.set([]);
    this.activityTypeFilter.set([]);
    this.activityLocationFilter.set([]);
    this.activityHighlightFilter.set([]);
    this.activitySearch.set('');
  }
  hasActiveActivityFilters = computed(() => {
    return this.activityPriceFilter() !== 40000 ||
      this.activityTimeFilter().length > 0 ||
      this.activityDurationFilter().length > 0 ||
      this.activityTypeFilter().length > 0 ||
      this.activityLocationFilter().length > 0 ||
      this.activityHighlightFilter().length > 0 ||
      this.activitySearch() !== '';
  });

  readonly swapBusDepStation = computed(() => {
    const ref = this.swappingBusRef();
    if (!ref) return '';
    const days = this.displayedDays();
    const day = days.find(d => d.day === ref.dayDay);
    if (!day) return '';
    const item = day.items[ref.itemIndex];
    if (!item || item.type !== 'bus') return '';
    return `${(item as any).depLocation} - ${(item as any).depTime}`;
  });

  readonly swapBusArrStation = computed(() => {
    const ref = this.swappingBusRef();
    if (!ref) return '';
    const days = this.displayedDays();
    const day = days.find(d => d.day === ref.dayDay);
    if (!day) return '';
    const item = day.items[ref.itemIndex];
    if (!item || item.type !== 'bus') return '';
    return `${(item as any).arrLocation} - ${(item as any).arrTime}`;
  });

  readonly swapBusDuration = computed(() => {
    const ref = this.swappingBusRef();
    if (!ref) return '';
    const days = this.displayedDays();
    const day = days.find(d => d.day === ref.dayDay);
    if (!day) return '';
    const item = day.items[ref.itemIndex];
    if (!item || item.type !== 'bus') return '';
    return (item as any).duration;
  });

  // Computed subheading fields from swapping target
  readonly swapDepAirport = computed(() => {
    const ref = this.swappingFlightRef();
    if (!ref) return '';
    const days = this.displayedDays();
    const day = days.find(d => d.day === ref.dayDay);
    if (!day) return '';
    const item = day.items[ref.itemIndex];
    if (!item || item.type !== 'flight') return '';
    return `${(item as any).depCode} - ${(item as any).depTime}`;
  });

  readonly swapArrAirport = computed(() => {
    const ref = this.swappingFlightRef();
    if (!ref) return '';
    const days = this.displayedDays();
    const day = days.find(d => d.day === ref.dayDay);
    if (!day) return '';
    const item = day.items[ref.itemIndex];
    if (!item || item.type !== 'flight') return '';
    return `${(item as any).arrCode} - ${(item as any).arrTime}`;
  });

  readonly swapDuration = computed(() => {
    const ref = this.swappingFlightRef();
    if (!ref) return '';
    const days = this.displayedDays();
    const day = days.find(d => d.day === ref.dayDay);
    if (!day) return '';
    const item = day.items[ref.itemIndex];
    if (!item || item.type !== 'flight') return '';
    return (item as any).duration || '14h 55min';
  });

  // Computed subheading (kept for backward compat)
  readonly swapSubheading = computed(() => {
    const dep = this.swapDepAirport();
    const arr = this.swapArrAirport();
    if (!dep || !arr) return '';
    return `${dep} → ${arr}`;
  });

  // Helpers to check dep time bucket
  private depTimeToBucket(depTime: string): string {
    const parts = depTime.replace('AM','').replace('PM','').trim().split(':');
    let hours = parseInt(parts[0], 10);
    const isPM = depTime.toUpperCase().includes('PM') && hours !== 12;
    if (isPM) hours += 12;
    if (hours < 6) return 'before-6';
    if (hours < 12) return '6-12';
    if (hours < 18) return '12-18';
    return 'after-18';
  }

  // Filtered flights based on active filters + search
  readonly filteredFlights = computed(() => {
    let flights = this.contextualFlights();
    const stops = this.stopsFilter();
    const cls = this.classFilter();
    const dep = this.departureFilter();
    const airline = this.airlineFilter();
    const fare = this.fareFilter();
    const search = this.flightSearch().toLowerCase().trim();

    if (stops.length > 0) {
      flights = flights.filter(f => stops.includes(f.stops));
    }
    if (cls.length > 0) {
      flights = flights.filter(f => cls.includes(f.class));
    }
    if (dep.length > 0) {
      flights = flights.filter(f => dep.includes(this.depTimeToBucket(f.depTime)));
    }
    if (airline.length > 0) {
      flights = flights.filter(f => airline.some(a => f.carrier.toLowerCase().includes(a.toLowerCase())));
    }
    if (fare.length > 0) {
      flights = flights.filter(f => fare.some(fa => f.refundable.toLowerCase().includes(fa.toLowerCase())));
    }
    if (search) {
      flights = flights.filter(f =>
        f.carrier.toLowerCase().includes(search) ||
        f.flightNo.toLowerCase().includes(search) ||
        f.depCode.toLowerCase().includes(search) ||
        f.arrCode.toLowerCase().includes(search)
      );
    }
    return flights;
  });

  readonly hasActiveFilters = computed(() =>
    this.stopsFilter().length > 0 ||
    this.classFilter().length > 0 ||
    this.departureFilter().length > 0 ||
    this.airlineFilter().length > 0 ||
    this.fareFilter().length > 0
  );

  // Toggle filter helpers
  toggleStopsFilter(value: string): void {
    const current = this.stopsFilter();
    this.stopsFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  toggleClassFilter(value: string): void {
    const current = this.classFilter();
    this.classFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  toggleDepartureFilter(value: string): void {
    const current = this.departureFilter();
    this.departureFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  toggleAirlineFilter(value: string): void {
    const current = this.airlineFilter();
    this.airlineFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  toggleFareFilter(value: string): void {
    const current = this.fareFilter();
    this.fareFilter.set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }
  clearAllFilters(): void {
    this.stopsFilter.set([]);
    this.classFilter.set([]);
    this.departureFilter.set([]);
    this.airlineFilter.set([]);
    this.fareFilter.set([]);
    this.flightSearch.set('');
  }

  // Swap flow actions
  startFlightSwap(dayDay: number, itemIndex: number): void {
    this.lastInventoryFetch = () => this.startFlightSwap(dayDay, itemIndex);
    const days = this.displayedDays();
    const day = days.find(d => d.day === dayDay);
    if (!day) return;
    const item = day.items[itemIndex];
    if (!item || item.type !== 'flight') return;
    const isReturn = (item as DetailFlight).arrCode === this.homeHubCode();
    this.selectedFlightDetail.set(null);
    this.swappingFlightRef.set({ dayDay, itemIndex, isReturn });
    this.clearAllFilters();
    this.viewMode.set('swap-flight');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Fetch dynamic flight inventory
    this.contextualFlights.set([]);
    this.loadingSwap.set(true);
    const searchId = ++this.flightSearchId;
    this.tripService.searchInventory({
      type: 'flight',
      dep: (item as DetailFlight).depCode,
      arr: (item as DetailFlight).arrCode,
      budget: this.budgetOption() || this.trip?.budget || 'standard',
    }).then(results => {
      if (searchId !== this.flightSearchId) return;
      const mapped = results.map(r => {
        const details = r.details || {};
        const cabin = String(details['cabin_class'] || 'economy');
        const cabinLabel = cabin.charAt(0).toUpperCase() + cabin.slice(1).replace('_', ' ');
        const airline = String(details['airline'] || details['carrier'] || r.provider || 'Airline');
        const depCode = String(details['origin'] || details['depCode'] || (item as DetailFlight).depCode);
        const arrCode = String(details['destination'] || details['arrCode'] || (item as DetailFlight).arrCode);
        const depTime = r.start_time || details['start_time'] || '10:00';
        return {
          id: r.id || crypto.randomUUID(),
          carrier: airline,
          airlineCode: String(details['airline_code'] || airlineIataCode(airline)),
          flightNo: String(details['flight_number'] || r.title),
          logoUrl: safeAirlineLogoUrl(details['logoUrl'] as string | undefined) ?? airlineLogoAsset(airline),
          class: cabinLabel.includes('Business') ? 'Business Class' : cabinLabel.includes('First') ? 'First Class' : cabinLabel.includes('Premium') ? 'Premium' : 'Economy',
          refundable: 'Non-Refundable',
          depDate: (item as DetailFlight).depDate,
          depTime,
          depCode,
          arrDate: (item as DetailFlight).arrDate,
          arrTime: r.end_time || details['end_time'] || '14:00',
          arrCode,
          duration: r.duration || details['duration'] || '4h 00m',
          stops: String(details['stops'] || 'Direct'),
          status: 'Available',
          price: typeof r.price === 'object' ? (r.price?.amount ?? 0) : (r.price ?? 0),
          emission: '150 kg CO2',
        };
      }) as AlternativeFlight[];

      this.contextualFlights.set(mapped);
      this.loadingSwap.set(false);
    }).catch(() => {
      this.loadingSwap.set(false);
    });
  }

  cancelSwap(): void {
    this.viewMode.set('itinerary');
    this.swappingFlightRef.set(null);
    this.addingTransportRef.set(null);
    this.selectedFlightDetail.set(null);
  }

  openFlightDetail(flight: AlternativeFlight): void {
    this.selectedFlightDetail.set(flight);
    this.viewMode.set('flight-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  backToFlightList(): void {
    this.selectedFlightDetail.set(null);
    this.viewMode.set('swap-flight');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  incrementFlightTravelers(): void {
    this.flightDetailTravelers.update((count) => Math.min(9, count + 1));
  }

  decrementFlightTravelers(): void {
    this.flightDetailTravelers.update((count) => Math.max(1, count - 1));
  }

  selectAlternativeFlight(flight: AlternativeFlight): void {
    const addRef = this.addingTransportRef();
    if (addRef?.transportType === 'flight') {
      const travelers = this.trip?.travelers || 2;
      this.finishAddingTransport({
        type: 'flight',
        carrier: flight.carrier,
        flightNo: flight.flightNo,
        class: flight.class,
        refundable: flight.refundable,
        depDate: flight.depDate,
        depTime: flight.depTime,
        depCode: flight.depCode,
        arrDate: flight.arrDate,
        arrTime: flight.arrTime,
        arrCode: flight.arrCode,
        duration: flight.duration,
        stops: flight.stops,
        status: 'Pending',
        price: flight.price * travelers,
      });
      this.selectedFlightDetail.set(null);
      return;
    }
    const ref = this.swappingFlightRef();
    if (!ref) return;
    const days = this.displayedDays();
    const day = days.find(d => d.day === ref.dayDay);
    const item = day?.items[ref.itemIndex];
    const itemKey = item ? this.getItemKey(item) : `${ref.dayDay}-${ref.itemIndex}`;
    const flightDay = ref.dayDay;
    
    const travelers = this.trip?.travelers || 2;
    const clonedFlight = { ...flight, price: flight.price * travelers };

    const current = this.swappedFlights();
    this.swappedFlights.set({ ...current, [itemKey]: clonedFlight });
    this.selectedFlightDetail.set(null);
    this.viewMode.set('itinerary');
    this.swappingFlightRef.set(null);
    void (async () => {
      try {
        await this.enqueueTransferPlan(flightDay, { silent: true });
      } finally {
        await this.syncCustomizationsToBackend();
      }
    })();
  }

  private buildFlightDetailContent(flight: AlternativeFlight): FlightDetailContent {
    const layover = flight.stops === 'Direct'
      ? 'This is a non-stop flight with no layovers.'
      : `This itinerary includes ${flight.stops.toLowerCase()}. Connection times are subject to operational changes.`;
    return {
      overview: `Fly ${flight.depCode} to ${flight.arrCode} with ${flight.carrier} in ${flight.class}. Flight ${flight.flightNo} departs ${flight.depDate} and arrives ${flight.arrDate}. Total journey time is approximately ${flight.duration}. Estimated carbon emission: ${flight.emission}.`,
      includes: [
        `${flight.class} cabin baggage (7 kg)`,
        'Checked baggage allowance (23 kg)',
        'In-flight entertainment on long-haul sectors',
        'Standard meal service on international routes',
        'Seat selection at check-in',
      ],
      excludes: [
        'Extra baggage beyond allowance',
        'Seat selection fees (if applicable)',
        'Airport lounge access',
        'Travel insurance',
        'Visa and entry fees',
      ],
      departureInfo: `${flight.depCode} · ${flight.depDate} at ${flight.depTime}. Check-in opens 3 hours before departure for international flights.`,
      arrivalInfo: `${flight.arrCode} · ${flight.arrDate} at ${flight.arrTime}.`,
      layoverInfo: layover,
      baggageInfo: 'Standard allowance includes one cabin bag (max 7 kg) and one checked bag (max 23 kg) per adult passenger. Additional bags can be purchased at booking or check-in.',
      cancellationPolicy: flight.refundable === 'Refundable'
        ? 'Free cancellation up to 24 hours before departure. Partial refund applies for cancellations within 24 hours.'
        : 'This is a non-refundable fare. Date changes may be permitted for a fee subject to airline policy and fare difference.',
      fareRules: [
        'Valid only on the booked flight numbers and dates',
        'Passport required for international travel',
        'Name changes not permitted after ticketing',
        'No-show bookings are non-refundable',
      ],
    };
  }

  // Interactive budget tier
  readonly budgetOption = signal<'budget' | 'standard' | 'premium'>('standard');


  readonly activeDayTab = signal<'summary' | number>('summary');
  readonly heroSlideIndex = signal(0);

  prevHeroSlide(): void {
    const count = this.heroImages().length;
    if (count) this.heroSlideIndex.update((i) => (i - 1 + count) % count);
  }

  nextHeroSlide(): void {
    const count = this.heroImages().length;
    if (count) this.heroSlideIndex.update((i) => (i + 1) % count);
  }

  private static readonly DEFAULT_HERO_IMAGES = [
    'assets/images/packages/hero-main.png',
    'assets/images/packages/hero-extra.png',
    'assets/images/packages/hero-ireland.png',
    'assets/images/packages/hero-bottom-left.png',
  ];

  readonly heroImages = computed(() => {
    const primary = this.trip?.image;
    const extras = ItineraryPageComponent.DEFAULT_HERO_IMAGES.filter((img) => img !== primary);
    return primary ? [primary, ...extras].slice(0, 4) : ItineraryPageComponent.DEFAULT_HERO_IMAGES;
  });

  destinationName(): string {
    const trip = this.trip;
    if (!trip) return 'your destination';
    return trip.destination?.split(',')[0]?.trim() ||
      trip.title?.replace(/\s+Adventure$/i, '').trim() ||
      'your destination';
  }

  readonly isDomesticTrip = computed(() => {
    this.tripStartDate(); // establish reactivity dependency
    const trip = this.trip;
    if (!trip) return false;
    const dest = (trip.destination || '').toLowerCase();
    const title = (trip.title || '').toLowerCase();
    return dest.includes('india') || dest.includes('chalakudy') || dest.includes('kochi') || dest.includes('bangalore') || dest.includes('delhi') || title.includes('chalakudy');
  });

  readonly visaGuidanceText = computed(() => {
    this.langTick();
    this.locale.currentLanguage(); // re-translate when language changes
    this.tripStartDate(); // establish reactivity dependency
    if (this.isDomesticTrip()) {
      return this.translate.instant('ITINERARY.CHECKLIST.NO_VISA_REQUIRED');
    }
    const dest = this.destinationName();
    const destLower = dest.toLowerCase();
    const schengen = ['spain', 'france', 'germany', 'italy', 'greece', 'europe', 'netherlands', 'belgium', 'switzerland', 'austria', 'portugal'];
    const matched = schengen.find(c => destLower.includes(c));
    if (matched) {
      const countryLabel = matched === 'europe' ? 'Europe' : matched.charAt(0).toUpperCase() + matched.slice(1);
      return this.translate.instant('ITINERARY.CHECKLIST.SCHENGEN_VISA_GUIDANCE', { country: countryLabel });
    }
    return this.translate.instant('ITINERARY.CHECKLIST.DESTINATION_VISA_GUIDANCE', { destination: dest });
  });

  readonly tripDurationLabel = computed(() => {
    this.langTick();
    this.locale.currentLanguage();
    const nights = this.totalNights();
    const days = nights + 1;
    const key = nights === 1 ? 'ITINERARY.HEADER.DURATION_LABEL' : 'ITINERARY.HEADER.DURATION_LABEL_PLURAL';
    return this.translate.instant(key, { days, nights });
  });

  readonly travelersLabel = computed(() => {
    this.langTick();
    this.locale.currentLanguage();
    const pax = this.effectiveTravelers();
    const rooms = pax === 1 ? 1 : Math.max(1, Math.ceil(pax / 2));
    const key = rooms === 1 ? 'ITINERARY.HEADER.TRAVELERS_META' : 'ITINERARY.HEADER.TRAVELERS_META_PLURAL';
    return this.translate.instant(key, { pax, rooms });
  });

  private effectiveTravelers(): number {
    const style = this.trip?.travelStyle?.toLowerCase();
    const stylePax: Record<string, number> = { solo: 1, couple: 2, family: 4, friends: 2 };
    if (style && stylePax[style]) return stylePax[style];
    return Math.max(1, this.trip?.travelers ?? 1);
  }
  
  // Tab navigation anchor (legacy section scroll)
  readonly activeTab = signal<'overview' | 'stays' | 'activities' | 'transport' | 'checklist' | 'inclusions'>('overview');

  // Dynamic Cities & Timeline State
  readonly cities = signal<CityEntry[]>([]);

  readonly showAddCityInput = signal(false);

  readonly totalNights = computed(() => this.cities().reduce((sum, c) => sum + c.nights, 0));
  readonly totalCitiesCount = computed(() => this.cities().length);

  readonly tripDatesStr = computed(() => {
    this.langTick();
    const localeTag = UI_LOCALE_TAGS[this.locale.currentLanguage()];
    const start = new Date(this.tripStartDate());
    const end = new Date(start);
    end.setDate(start.getDate() + this.totalNights());
    
    const optionsStart: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const optionsEnd: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    
    return `${start.toLocaleDateString(localeTag, optionsStart)} - ${end.toLocaleDateString(localeTag, optionsEnd)}`;
  });

  /** Coerce a segment price for sidebar totals (already in display currency from the API). */
  private priceToUsd(item: { price?: number; currency?: string; provider?: string; type?: string }): number {
    return priceToUsd(item);
  }

  // Budget calculations — amounts already in the user's currency; templates format via appCurrency.
  readonly costFlights = computed(() => {
    let total = 0;
    this.displayedDays().forEach(d => {
      d.items.forEach(item => {
        if (item.type === 'flight') total += this.priceToUsd(item as any);
      });
    });
    return total;
  });

  readonly costStays = computed(() => {
    let total = 0;
    const seen = new Set<string>();
    this.displayedDays().forEach(d => {
      d.items.forEach(item => {
        if (item.type !== 'hotel') return;
        const hotel = item as DetailHotel;
        const key = `${hotel.name || ''}|${hotel.dates || ''}`;
        if (seen.has(key)) return;
        seen.add(key);
        total += this.priceToUsd(hotel as any);
      });
    });
    return total;
  });

  readonly costActivities = computed(() => {
    let total = 0;
    this.displayedDays().forEach(d => {
      d.items.forEach(item => {
        if (item.type === 'activity') total += this.priceToUsd(item as any);
      });
    });
    return total;
  });

  readonly costRental = computed(() => {
    let total = 0;
    const seenRentals = new Set<string>();
    this.displayedDays().forEach((d) => {
      d.items.forEach((item) => {
        if (item.type !== 'car') return;
        const car = item as DetailCar;
        if (car.rentalId) {
          if (seenRentals.has(car.rentalId)) return;
          seenRentals.add(car.rentalId);
        }
        // Continuation days are stored at price 0; still guard on role.
        if (car.rentalRole === 'active' || car.rentalRole === 'return') return;
        total += this.priceToUsd(car as any);
      });
    });
    return total;
  });

  readonly costTransport = computed(() => {
    let total = 0;
    this.displayedDays().forEach(d => {
      d.items.forEach(item => {
        if (item.type !== 'train' && item.type !== 'bus') return;
        const priced = item as { price?: number; cost?: string; currency?: string; provider?: string; type?: string };
        if (typeof priced.price === 'number' && Number.isFinite(priced.price)) {
          total += this.priceToUsd(priced);
          return;
        }
        const parsed = parseFloat(String(priced.cost || '').replace(/[^\d.]/g, ''));
        if (Number.isFinite(parsed)) total += this.priceToUsd({ ...priced, price: parsed });
      });
    });
    return total;
  });

  readonly costTotal = computed(() => {
    return this.costFlights() + this.costStays() + this.costActivities() + this.costRental() + this.costTransport();
  });

  selectBudget(tier: 'budget' | 'standard' | 'premium'): void {
    this.budgetOption.set(tier);
  }

  adjustNights(index: number, delta: number): void {
    const current = this.cities();
    const target = current[index];
    const newNights = Math.max(1, target.nights + delta);
    if (newNights === target.nights) return;

    const updated = [...current];
    updated[index] = {
      ...target,
      nights: newNights
    };
    this.cities.set(updated);
  }

  removeCity(index: number): void {
    const current = this.cities();
    if (current.length <= 1) return;

    const updated = current.filter((_, i) => i !== index);
    if (index === 0 && updated.length > 0) {
      const firstCity = updated[0].name;
      const code = this.cityAirportCode(firstCity);
      updated[0] = {
        ...updated[0],
        transit: {
          type: 'arrival',
          text: `Arrival at ${code}`,
          icon: 'airplane-landing'
        }
      };
    }
    this.cities.set(updated);
  }

  confirmAddCity(cityName: string): void {
    const name = cityName.trim();
    if (!name) {
      this.showAddCityInput.set(false);
      return;
    }
    const current = this.cities();
    const transitType = current.length % 2 === 0 ? 'flight' : 'train';
    const transitText = transitType === 'flight' ? 'Transfer by Flight' : 'Transfer by Train';
    const transitIcon = transitType === 'flight' ? 'plane' : 'train';

    this.cities.set([
      ...current,
      {
        name,
        nights: 2,
        transit: {
          type: transitType,
          text: transitText,
          icon: transitIcon
        }
      }
    ]);
    this.showAddCityInput.set(false);
  }

  // Smooth scroll
  scrollToSection(sectionId: string): void {
    this.activeTab.set(sectionId as any);
    const el = document.getElementById(sectionId);
    if (el) {
      const yOffset = -140;
      const y = el.getBoundingClientRect().top + window.scrollY + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }

  scrollToDay(target: 'summary' | number): void {
    this.activeDayTab.set(target);
    const elementId = target === 'summary' ? 'overview' : `day-${target}`;
    const el = document.getElementById(elementId);
    if (el) {
      const yOffset = -132;
      const y = el.getBoundingClientRect().top + window.scrollY + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    if (this.viewMode() !== 'itinerary') return;
    
    const overviewEl = document.getElementById('overview');
    let active: 'summary' | number = 'summary';
    
    if (overviewEl) {
      const rect = overviewEl.getBoundingClientRect();
      // Threshold is 140px from the top (navbar header height)
      if (rect.top <= 140 && rect.bottom > 140) {
        active = 'summary';
      }
    }
    
    const days = this.displayedDays();
    for (const day of days) {
      const el = document.getElementById(`day-${day.day}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= 140 && rect.bottom > 140) {
          active = day.day;
          break;
        }
      }
    }
    
    if (this.activeDayTab() !== active) {
      this.activeDayTab.set(active);
    }
  }

  moveItemUp(day: number, index: number): void {
    if (index <= 0) return;
    const days = this.displayedDays();
    const targetDay = days.find(d => d.day === day);
    if (!targetDay) return;
    
    const items = targetDay.items;
    const currentKeys = items.map(item => this.getItemKey(item));
    const itemKey = this.getItemKey(items[index]);
    
    this.customItemOrder.update(prev => {
      const next = { ...prev };
      const dayOrder = next[day] ? [...next[day]] : currentKeys;
      const sIdx = dayOrder.indexOf(itemKey);
      if (sIdx > 0) {
        const temp = dayOrder[sIdx - 1];
        dayOrder[sIdx - 1] = dayOrder[sIdx];
        dayOrder[sIdx] = temp;
      }
      next[day] = dayOrder;
      return next;
    });
    void (async () => {
      try {
        await this.enqueueTransferPlan(day, { silent: true });
      } finally {
        await this.syncCustomizationsToBackend();
      }
    })();
  }

  moveItemDown(day: number, index: number): void {
    const days = this.displayedDays();
    const targetDay = days.find(d => d.day === day);
    if (!targetDay) return;
    
    const items = targetDay.items;
    if (index >= items.length - 1) return;
    
    const currentKeys = items.map(item => this.getItemKey(item));
    const itemKey = this.getItemKey(items[index]);
    
    this.customItemOrder.update(prev => {
      const next = { ...prev };
      const dayOrder = next[day] ? [...next[day]] : currentKeys;
      const sIdx = dayOrder.indexOf(itemKey);
      if (sIdx !== -1 && sIdx < dayOrder.length - 1) {
        const temp = dayOrder[sIdx + 1];
        dayOrder[sIdx + 1] = dayOrder[sIdx];
        dayOrder[sIdx] = temp;
      }
      next[day] = dayOrder;
      return next;
    });
    void (async () => {
      try {
        await this.enqueueTransferPlan(day, { silent: true });
      } finally {
        await this.syncCustomizationsToBackend();
      }
    })();
  }


  // Raw templates for Paris, Barcelona, Madrid days (excluding flights and transit transfers which are inserted dynamically)
  
  // Compute the displayed itinerary days list reactively, applying flight swap overrides
  readonly displayedDays = computed(() => {
    this.tripSegmentsVersion();
    this.langTick();
    this.locale.currentLanguage(); // rebuild titles/dates when language changes
    const localeTag = UI_LOCALE_TAGS[this.locale.currentLanguage()];
    const instant = (key: string, params?: Record<string, unknown>) =>
      this.translate.instant(key, params);
    const resultDays: DetailDay[] = [];
    const startDate = new Date(this.tripStartDate());

    if (!this.trip?.segments || this.trip.segments.length === 0) return resultDays;

    const daysMap = new Map<number, DetailItem[]>();
    this.trip.segments.forEach(segment => {
      const dayNum = Number(segment.day) || 1;
      if (!daysMap.has(dayNum)) daysMap.set(dayNum, []);
      daysMap.get(dayNum)!.push(segment as unknown as DetailItem);
    });

    const added = this.addedActivities();
    const addedT = this.addedTransport();
    const maxDay = Math.max(
      ...Array.from(daysMap.keys()),
      ...added.map((a) => a.dayDay),
      ...addedT.map((t) => t.dayDay),
      1,
    );

    for (let dayCounter = 1; dayCounter <= maxDay; dayCounter++) {
      const currentDayStr = new Date(startDate);
      currentDayStr.setDate(startDate.getDate() + dayCounter - 1);
      const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' };
      const dateStr = currentDayStr.toLocaleDateString(localeTag, options);

      resultDays.push({
        day: dayCounter,
        title: localizeDayTitle(dayCounter, this.trip?.days?.[dayCounter - 1]?.title, instant),
        dateStr: dateStr,
        items: daysMap.get(dayCounter) || []
      } as DetailDay);
    }

    // Append user-added activities to their day (before overrides so they
    // render and remain individually swappable by index). Skip any already
    // present in segments (selectAlternativeActivity dual-writes both).
    if (added.length) {
      resultDays.forEach(day => {
        const existingIds = new Set(
          day.items.map((i) => (i as { id?: string }).id).filter(Boolean) as string[],
        );
        const existingTitles = new Set(
          day.items
            .filter((i) => i.type === 'activity')
            .map((i) => ((i as DetailActivity).title || '').trim().toLowerCase())
            .filter(Boolean),
        );
        const extra = added
          .filter((a) => a.dayDay === day.day)
          .map((a) => this.toDetailActivity(a.activity) as unknown as DetailItem)
          .filter((item) => {
            const id = (item as { id?: string }).id;
            if (id && existingIds.has(id)) return false;
            const title = ((item as DetailActivity).title || '').trim().toLowerCase();
            if (title && existingTitles.has(title)) return false;
            return true;
          });
        if (extra.length) day.items = [...day.items, ...extra];
      });
    }

    if (addedT.length) {
      resultDays.forEach(day => {
        const existingKeys = new Set(day.items.map((i) => this.getItemKey(i)));
        const existingTypes = new Set(day.items.map((i) => i.type));
        const extra = addedT
          .filter((t) => this.dayOf(t.dayDay) === this.dayOf(day.day))
          .map((t) => t.item)
          .filter((item) => {
            const id = (item as { id?: string }).id;
            if (id && existingKeys.has(`${item.type}-${id}`)) return false;
            if (existingKeys.has(this.getItemKey(item))) return false;
            // Same-type transport already on the day from segments — skip duplicate.
            if (
              ['car', 'train', 'bus', 'flight'].includes(item.type) &&
              existingTypes.has(item.type)
            ) {
              return false;
            }
            return true;
          });
        if (extra.length) day.items = [...day.items, ...extra];
      });
    }

    // Apply swapped item overrides (always preserve original id for stable keys).
    resultDays.forEach(day => {
      day.items = day.items.map((item) => {
        const itemKey = this.getItemKey(item);
        const keepId = (item as { id?: string }).id;
        if (item.type === 'flight' && this.swappedFlights()[itemKey]) {
          return {
            ...item,
            ...this.toDetailFlight(this.swappedFlights()[itemKey]),
            id: keepId,
          } as DetailItem;
        }
        if (item.type === 'hotel' && this.swappedHotels()[itemKey]) {
          return {
            ...item,
            ...this.toDetailHotel(this.swappedHotels()[itemKey]),
            id: keepId,
          } as DetailItem;
        }
        if (item.type === 'car' && this.swappedCars()[itemKey]) {
          const swap = this.swappedCars()[itemKey];
          const overlay = this.toDetailCar(swap);
          const dateBase = String((item as DetailCar).dates || '').split(' · ')[0];
          const distanceLabel =
            swap.distanceKm != null ? ` · ${Number(swap.distanceKm).toFixed(1)} km` : '';
          const dates =
            dateBase && swap.duration
              ? `${dateBase} · ${swap.duration}${distanceLabel}`
              : (item as DetailCar).dates;
          return {
            ...item,
            ...overlay,
            id: keepId,
            dates,
          } as DetailItem;
        }
        if (item.type === 'activity' && this.swappedActivities()[itemKey]) {
          return {
            ...item,
            ...this.toDetailActivity(this.swappedActivities()[itemKey]),
            id: keepId,
          } as DetailItem;
        }
        if (item.type === 'train' && this.swappedTrains()[itemKey]) {
          return {
            ...item,
            ...this.toDetailTrain(this.swappedTrains()[itemKey]),
            id: keepId,
          } as DetailItem;
        }
        if (item.type === 'bus' && this.swappedBuses()[itemKey]) {
          return {
            ...item,
            ...this.toDetailBus(this.swappedBuses()[itemKey]),
            id: keepId,
          } as DetailItem;
        }
        return item;
      });
    });

    // Apply custom item order if saved
    const orders = this.customItemOrder();
    const removed = this.removedItemKeys();
    resultDays.forEach(day => {
      day.items = day.items.filter(
        (item) => !removed.has(`${day.day}-${this.getItemKey(item)}`),
      );

      const dayOrder = orders[day.day];
      if (dayOrder && dayOrder.length > 0) {
        const orderMap = new Map<string, number>();
        dayOrder.forEach((k, idx) => orderMap.set(k, idx));
        
        day.items.sort((a, b) => {
          const keyA = this.getItemKey(a);
          const keyB = this.getItemKey(b);
          const idxA = orderMap.has(keyA) ? orderMap.get(keyA)! : 999;
          const idxB = orderMap.has(keyB) ? orderMap.get(keyB)! : 999;
          return idxA - idxB;
        });
      }
    });

    // Last pass: one car per day, route labels from neighboring stops.
    return this.reconcileStaleCarRoutes(this.dedupeCarsInDisplayedDays(resultDays));
  });

  /** Drop extra car cards on the same day (keep the richest transfer). */
  private dedupeCarsInDisplayedDays(days: DetailDay[]): DetailDay[] {
    return days.map((day) => {
      const carIndexes = day.items
        .map((item, index) => (item.type === 'car' ? index : -1))
        .filter((index) => index >= 0);
      if (carIndexes.length <= 1) return day;

      const score = (item: DetailItem): number => {
        const car = item as DetailCar;
        let n = 0;
        if (car.durationMinutes != null) n += 4;
        if (car.distanceKm != null) n += 3;
        if (car.price != null && Number(car.price) > 0) n += 2;
        if (car.fromLocation && car.toLocation) n += 2;
        if (car.autoInserted) n += 1;
        if (/airport/i.test(String(car.location || ''))) n -= 5;
        return n;
      };

      let keepIndex = carIndexes[0];
      let best = score(day.items[keepIndex]);
      for (const idx of carIndexes.slice(1)) {
        const s = score(day.items[idx]);
        if (s > best) {
          best = s;
          keepIndex = idx;
        }
      }
      const keepSet = new Set(carIndexes.filter((idx) => idx === keepIndex));
      return {
        ...day,
        items: day.items.filter((item, index) => item.type !== 'car' || keepSet.has(index)),
      };
    });
  }

  /**
   * Force car route labels to match adjacent place stops whenever the stored
   * car location is stale (airport, city→city, or unrelated to neighbors).
   */
  private reconcileStaleCarRoutes(days: DetailDay[]): DetailDay[] {
    return days.map((day) => {
      const city = this.cityForDay(day.day);
      const items = day.items.map((item, index) => {
        if (item.type !== 'car') return item;
        const adj =
          this.transferPlan.adjacentStopsAroundIndex(day.items, index, city) ||
          this.transferPlan.adjacentStopsForDay(day.items, city);
        if (!adj) return item;

        const expected = `${adj.from.label} → ${adj.to.label}`;
        const car = item as DetailCar;
        const loc = String(car.location || '').toLowerCase().replace(/\s+/g, ' ');
        const fromTok = adj.from.label.toLowerCase().split(',')[0].trim();
        const toTok = adj.to.label.toLowerCase().split(',')[0].trim();
        const aligned =
          !!fromTok &&
          !!toTok &&
          loc.includes(fromTok) &&
          loc.includes(toTok) &&
          fromTok !== toTok;
        const looksStale =
          !aligned ||
          /airport/i.test(loc) ||
          /goa\s*[→\->]+\s*goa/i.test(loc);

        if (!looksStale) return item;

        const model = this.cleanCarModel(car.model);
        let category = car.category;
        const modelClass = model.match(/\b(Sedan|SUV|Hatchback|Van|MPV|Luxury)\b/i)?.[1];
        if (modelClass) category = modelClass;

        return {
          ...car,
          model,
          category,
          location: expected,
          fromLocation: adj.from.label,
          toLocation: adj.to.label,
        } as DetailItem;
      });
      return { ...day, items };
    });
  }

  /** Convert a selected alternative activity into a day-renderable activity item. */
  private toDetailActivity(
    a: AlternativeActivity & { time?: string; meal?: string; autoInserted?: boolean },
  ): DetailActivity {
    const rawTime = a.time;
    const looksLikeClock =
      !!rawTime &&
      /\d/.test(rawTime) &&
      !/^(Morning|Noon|Evening|Night|Halfday|Fullday)$/i.test(rawTime.trim());
    return {
      type: 'activity',
      id: a.id,
      time: looksLikeClock ? rawTime! : a.timeOfDay || rawTime || 'Morning',
      title: a.title,
      rating: a.rating,
      location: a.location,
      refundable: a.refundable,
      image: this.pickImage(a.image, `${a.id || ''}-${a.title}-${a.location}`, this.activityImagePool),
      price: a.price,
      duration: a.duration,
      attractionType: a.attractionType,
      deepLink: a.deepLink,
      provider: a.provider,
      contentOnly: a.contentOnly,
      meal: a.meal,
      bookable: a.bookable,
      partnerMetadata: a.partnerMetadata,
      autoInserted: a.autoInserted,
      lat: a.lat,
      lng: a.lng,
      placeId: a.placeId,
    } as DetailActivity;
  }

  // The swap list builds Alternative* objects (no `type`, different field names).
  // These converters map them onto the Detail* shapes the itinerary day cards
  // render — without a `type` the swapped item matches no card and silently
  // vanishes. They are merged over the original item so fields not carried by the
  // alternative (e.g. car/hotel dates) are preserved.
  private toDetailFlight(a: AlternativeFlight): Partial<DetailFlight> {
    // Omit id — keep stable getItemKey() for the timeline slot.
    return {
      type: 'flight', carrier: a.carrier, flightNo: a.flightNo,
      class: a.class, refundable: a.refundable,
      depDate: a.depDate, depTime: a.depTime, depCode: a.depCode,
      arrDate: a.arrDate, arrTime: a.arrTime, arrCode: a.arrCode,
      duration: a.duration, stops: a.stops,
      status: 'Pending',
      price: a.price,
    };
  }
  private toDetailCar(a: AlternativeCar): Partial<DetailCar> {
    // Omit id so the timeline slot keeps a stable getItemKey() across swaps.
    const model = this.cleanCarModel(a.model);
    const modelClass = model.match(/\b(Sedan|SUV|Hatchback|Van|MPV|Luxury)\b/i)?.[1];
    return {
      type: 'car',
      model,
      category: modelClass || a.category,
      location: a.location,
      passengers: a.passengers,
      gearbox: a.gearbox,
      bags: a.bags,
      fuel: a.fuel,
      imageUrl: a.imageUrl,
      deepLink: a.deepLink,
      provider: a.provider || a.supplier,
      price: a.price,
      bookable: a.bookable,
      partnerMetadata: a.partnerMetadata,
      duration: a.duration,
      durationMinutes: a.durationMinutes,
      distanceKm: a.distanceKm ?? undefined,
      fromLocation: a.fromLocation,
      toLocation: a.toLocation,
    };
  }
  private toDetailTrain(a: AlternativeTrain): Partial<DetailTrain> {
    return {
      type: 'train', carrier: a.carrier,
      route: `${a.depLocation} → ${a.arrLocation}`,
      depDate: a.depDate, depTime: a.depTime, depLocation: a.depLocation,
      arrDate: a.arrDate, arrTime: a.arrTime, arrLocation: a.arrLocation,
      duration: a.duration, stops: a.stops,
      cost: `${CURRENCY_SYMBOLS[this.locale.currentCurrency()]}${a.price}`, price: a.price, imageUrl: a.imageUrl,
      bookable: a.bookable,
      partnerMetadata: a.partnerMetadata,
    };
  }
  private toDetailBus(a: AlternativeBus): Partial<DetailBus> {
    return {
      type: 'bus', carrier: a.carrier,
      route: `${a.depLocation} → ${a.arrLocation}`,
      depDate: a.depDate, depTime: a.depTime, depLocation: a.depLocation,
      arrDate: a.arrDate, arrTime: a.arrTime, arrLocation: a.arrLocation,
      duration: a.duration, stops: a.stops,
      cost: `${CURRENCY_SYMBOLS[this.locale.currentCurrency()]}${a.price}`, price: a.price, imageUrl: a.imageUrl,
    };
  }
  private toDetailHotel(a: AlternativeHotel): Partial<DetailHotel> {
    // Omit id — keep stable getItemKey() for the timeline slot.
    return {
      type: 'hotel', name: a.name, rating: a.rating,
      location: a.location, amenities: a.amenities, distance: a.distance,
      maxGuests: a.maxGuests, roomType: a.roomType, bedPreference: a.bedPreference,
      cancellation: a.cancellation, price: a.price, taxes: a.taxes, imageUrl: a.imageUrl,
      deepLink: a.deepLink, provider: a.provider, stars: a.stars, reviewCount: a.reviewCount,
      bookable: a.bookable, partnerMetadata: a.partnerMetadata,
    };
  }

  // Inclusions Data — use displayedDays so swaps/adds are reflected.
  readonly inclusions = computed(() => {
    this.langTick();
    this.locale.currentLanguage();
    const items = this.displayedDays().flatMap((d) => d.items);
    const flights = items.filter((s) => s.type === 'flight') as DetailFlight[];
    const flightItems = flights.map(f => `${f.depCode} → ${f.arrCode} (${f.carrier} ${f.flightNo})`);

    const standardRoom = this.translate.instant('ITINERARY.INCLUSIONS.STANDARD_ROOM');
    const stayFallback = this.translate.instant('ITINERARY.INCLUSIONS.STAY_FALLBACK');
    const stays = items.filter((s) => s.type === 'hotel') as DetailHotel[];
    const seenStays = new Set<string>();
    const stayItems = stays
      .filter((h) => {
        const key = `${h.name || ''}|${h.dates || ''}|${h.roomType || ''}`;
        if (seenStays.has(key)) return false;
        seenStays.add(key);
        return true;
      })
      .map(h => `${h.name} (${h.roomType || standardRoom}, ${h.dates || stayFallback})`);

    const activeRental = this.translate.instant('ITINERARY.INCLUSIONS.ACTIVE_RENTAL');
    const cars = items.filter((s) => s.type === 'car') as DetailCar[];
    const seenRentals = new Set<string>();
    const carItems = cars
      .filter((c) => {
        if (!c.rentalId) return true;
        if (seenRentals.has(c.rentalId)) return false;
        seenRentals.add(c.rentalId);
        return c.rentalRole === 'pickup' || c.rentalRole === 'single' || !c.rentalRole;
      })
      .map((c) => `${c.location} – ${c.model} (${c.dates || activeRental})`);

    const trainFallback = this.translate.instant('ITINERARY.INCLUSIONS.TRAIN_FALLBACK');
    const trains = items.filter((s) => s.type === 'train') as DetailTrain[];
    const trainItems = trains.map(t => `${t.depLocation} → ${t.arrLocation} (${t.carrier || trainFallback}, ${t.depTime} – ${t.arrTime})`);
    const buses = items.filter((s) => s.type === 'bus') as DetailBus[];
    const busItems = buses.map(b => `${b.depLocation} → ${b.arrLocation} (${b.carrier}, ${b.depTime} – ${b.arrTime})`);

    const activities = items.filter((s) => s.type === 'activity') as DetailActivity[];
    const activityItems = activities.map(a => `${a.title}`);

    const travelers = this.effectiveTravelers();
    const localTransportItems = [...trainItems, ...busItems];

    return [
      {
        title: 'ITINERARY.INCLUSIONS.CAT_FLIGHTS',
        items: flightItems.length > 0 ? flightItems : [this.translate.instant('ITINERARY.INCLUSIONS.NO_FLIGHTS')]
      },
      {
        title: 'ITINERARY.INCLUSIONS.CAT_STAYS',
        items: stayItems.length > 0 ? stayItems : [this.translate.instant('ITINERARY.INCLUSIONS.NO_STAYS')]
      },
      {
        title: 'ITINERARY.INCLUSIONS.CAT_RENTAL_CARS',
        items: carItems.length > 0 ? carItems : [this.translate.instant('ITINERARY.INCLUSIONS.NO_RENTAL_CARS')]
      },
      {
        title: 'ITINERARY.INCLUSIONS.CAT_TRAIN_TRANSFER',
        items: localTransportItems.length > 0 ? localTransportItems : [this.translate.instant('ITINERARY.INCLUSIONS.NO_TRAIN_TRANSFERS')]
      },
      {
        title: 'ITINERARY.INCLUSIONS.CAT_ACTIVITIES',
        items: activityItems.length > 0 ? activityItems : [this.translate.instant('ITINERARY.INCLUSIONS.NO_ACTIVITIES')]
      },
      {
        title: 'ITINERARY.INCLUSIONS.CAT_TRAVEL_SUPPORT',
        items: [
          this.isDomesticTrip() ? this.translate.instant('ITINERARY.INCLUSIONS.DOMESTIC_TRAVEL_SUPPORT') : this.visaGuidanceText(),
          this.isDomesticTrip() ? this.translate.instant('ITINERARY.INCLUSIONS.LOCAL_DRIVING_SUPPORT') : this.translate.instant('ITINERARY.INCLUSIONS.IDP_SUPPORT'),
          this.translate.instant('ITINERARY.INCLUSIONS.INSURANCE_SUMMARY', { count: travelers, plural: travelers > 1 ? 's' : '' })
        ]
      }
    ];
  });

  // Exclusions Data (translation keys, piped in template)
  readonly exclusions = [
    'ITINERARY.INCLUSIONS.EXCLUSION_FLIGHT_ISSUES',
    'ITINERARY.INCLUSIONS.EXCLUSION_BAGGAGE_FEES',
    'ITINERARY.INCLUSIONS.EXCLUSION_MEALS_PERSONAL',
    'ITINERARY.INCLUSIONS.EXCLUSION_UNLISTED_ACTIVITIES',
    'ITINERARY.INCLUSIONS.EXCLUSION_LOCAL_TRANSPORT',
    'ITINERARY.INCLUSIONS.EXCLUSION_HOTEL_EXTRAS',
    'ITINERARY.INCLUSIONS.EXCLUSION_VISA_PERMITS',
    'ITINERARY.INCLUSIONS.EXCLUSION_INSURANCE_CLAIMS',
    'ITINERARY.INCLUSIONS.EXCLUSION_ENTRY_FEES',
    'ITINERARY.INCLUSIONS.EXCLUSION_UNFORESEEN_EVENTS',
  ];

  private initializeTripContext(): void {
    const trip = this.trip;
    if (!trip) return;

    const displayName = this.authService.user()?.email?.split('@')[0] || 'Someone';
    this.tripPresence.join(trip.id, displayName);

    // Stable ids so getItemKey() survives train/bus/flight/car swaps without ids.
    if (trip.segments?.length) {
      trip.segments = trip.segments.map((seg, index) => {
        if ((seg as { id?: string }).id) return seg;
        if (!['train', 'bus', 'flight', 'car', 'hotel', 'activity'].includes(seg.type)) {
          return seg;
        }
        return {
          ...seg,
          id: `${seg.type}-d${this.dayOf(seg.day)}-i${index}`,
        };
      });
    }

    if (trip.customizations) {
      if (trip.customizations['hotels']) this.swappedHotels.set(trip.customizations['hotels']);
      if (trip.customizations['flights']) this.swappedFlights.set(trip.customizations['flights']);
      if (trip.customizations['activities']) this.swappedActivities.set(trip.customizations['activities']);
      if (trip.customizations['trains']) this.swappedTrains.set(trip.customizations['trains']);
      if (trip.customizations['buses']) this.swappedBuses.set(trip.customizations['buses']);
      if (trip.customizations['cars']) this.swappedCars.set(trip.customizations['cars']);
      if (trip.customizations['addedActivities']) {
        // Prefer the longer of server vs in-memory list so a mid-add reload
        // cannot wipe an activity the user just selected.
        const fromServer = trip.customizations['addedActivities'] as { dayDay: number; activity: any }[];
        const local = this.addedActivities();
        this.addedActivities.set(fromServer.length >= local.length ? fromServer : local);
      }
      if (trip.customizations['addedTransport']) this.addedTransport.set(trip.customizations['addedTransport']);
      if (trip.customizations['removedItems']) {
        this.removedItemKeys.set(new Set(trip.customizations['removedItems'] as string[]));
      }
      if (trip.customizations['itemOrder']) this.customItemOrder.set(trip.customizations['itemOrder']);
      if (Array.isArray(trip.customizations['notes'])) {
        this.tripNotes.set(trip.customizations['notes']);
      }
    }

    // Remove duplicate transfer cards left by earlier auto-plan inserts.
    const carDays = new Set<number>();
    for (const seg of trip.segments || []) {
      if (seg.type === 'car') carDays.add(Number(seg.day) || 1);
    }
    for (const t of this.addedTransport()) {
      if (t.item.type === 'car') carDays.add(t.dayDay);
    }
    for (const d of carDays) this.collapseDuplicateCarsOnDay(d);

    const parsedStart = new Date(trip.startDate);
    this.tripStartDate.set(Number.isNaN(parsedStart.getTime()) ? new Date() : parsedStart);

    const budget = trip.budget?.toLowerCase() ?? '';
    if (budget.includes('budget') || budget.includes('economy')) {
      this.budgetOption.set('budget');
    } else if (budget.includes('premium') || budget.includes('luxury')) {
      this.budgetOption.set('premium');
    } else {
      this.budgetOption.set('standard');
    }

    this.cities.set(this.deriveCitiesFromTrip(trip));
    this.flightDetailTravelers.set(trip.travelers || 2);
    this.trainDetailTravelers.set(trip.travelers || 2);
    this.activityDetailTravelers.set(trip.travelers || 2);

    const destination =
      trip.destination?.split(',')[0]?.trim() ||
      trip.title?.replace(/\s+Adventure$/i, '').trim() ||
      'your trip';
    if (trip.id) {
      this.chatContext.setTripPageContext(trip.id, destination);
    }
  }

  private deriveCitiesFromTrip(trip: SavedTrip): CityEntry[] {
    if (trip.cityDays?.length) {
      return trip.cityDays.map((entry, idx) => ({
        name: entry.city,
        nights: entry.nights,
        transit: idx === 0
          ? { type: 'arrival' as const, text: `Arrival in ${entry.city}`, icon: 'airplane-landing' }
          : {
              type: (idx % 2 === 0 ? 'flight' : 'train') as 'flight' | 'train',
              text: idx % 2 === 0 ? 'Transfer by Flight' : 'Transfer by Train',
              icon: idx % 2 === 0 ? 'plane' : 'train',
            },
      }));
    }

    const destinations = trip.destination
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);

    if (destinations.length === 0) {
      const fallback = trip.title.replace(/\s+Adventure$/i, '').trim() || 'Destination';
      destinations.push(fallback);
    }

    const totalNights = Math.max(1, trip.days.length - 1);
    const baseNights = Math.max(1, Math.floor(totalNights / destinations.length));
    let remainder = totalNights - baseNights * destinations.length;

    return destinations.map((name, idx) => {
      const extraNight = remainder > 0 ? 1 : 0;
      if (extraNight) remainder--;
      const nights = baseNights + extraNight;
      const transit: CityTransit = idx === 0
        ? { type: 'arrival', text: `Arrival in ${name}`, icon: 'airplane-landing' }
        : {
            type: idx % 2 === 0 ? 'flight' : 'train',
            text: idx % 2 === 0 ? 'Transfer by Flight' : 'Transfer by Train',
            icon: idx % 2 === 0 ? 'plane' : 'train',
          };
      return { name, nights, transit };
    });
  }

  cityNameForAirport(code: string): string {
    const known: Record<string, string> = {
      MAA: 'Chennai', CDG: 'Paris', MAD: 'Madrid', BCN: 'Barcelona', BOM: 'Mumbai',
      DEL: 'Delhi', DXB: 'Dubai', SIN: 'Singapore', BKK: 'Bangkok', SYD: 'Sydney',
    };
    if (known[code]) return known[code];
    const city = this.cities().find((c) => this.cityAirportCode(c.name) === code);
    return city?.name || code;
  }

  protected homeHubCode(): string {
    const depLoc = this.trip?.customizations?.['departureLocation'];
    if (depLoc) {
      if (depLoc.length === 3) return depLoc.toUpperCase();
      return this.cityAirportCode(depLoc);
    }
    const firstFlight = this.trip?.segments?.find(s => s.type === 'flight') as DetailFlight;
    if (firstFlight?.depCode) return firstFlight.depCode;

    const firstCity = this.cities()[0]?.name;
    if (firstCity) {
      return this.cityAirportCode(firstCity);
    }
    return 'MAA';
  }

  private cityAirportCode(cityName: string): string {
    const known: Record<string, string> = {
      paris: 'CDG', barcelona: 'BCN', madrid: 'MAD', chennai: 'MAA', mumbai: 'BOM',
      delhi: 'DEL', dubai: 'DXB', singapore: 'SIN', bangkok: 'BKK', sydney: 'SYD',
      london: 'LHR', rome: 'FCO', zurich: 'ZRH', tokyo: 'NRT', bali: 'DPS',
      maldives: 'MLE', thailand: 'BKK', malaysia: 'KUL', seychelles: 'SEZ',
    };
    const key = cityName.toLowerCase().trim();
    if (known[key]) return known[key];
    const cleaned = key.replace(/[^a-z]/g, '');
    return cleaned.slice(0, 3).toUpperCase().padEnd(3, 'X');
  }


  readonly contextualFlights = signal<AlternativeFlight[]>([]);

  readonly contextualTrains = signal<AlternativeTrain[]>([]);

  readonly contextualCars = signal<AlternativeCar[]>([]);

  readonly contextualBuses = signal<AlternativeBus[]>([]);

  
  
  
  
  
  
  ngOnInit(): void {
    this.route.fragment.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((frag) => {
      const targetMode = (frag as any) || 'itinerary';
      if (this.viewMode() !== targetMode) {
        this.suppressViewModeUrlSync = true;
        this.viewMode.set(targetMode);
        queueMicrotask(() => {
          this.suppressViewModeUrlSync = false;
        });
      }
    });

    // Subscribed (not a one-shot snapshot read) because Angular's default route
    // reuse strategy keeps this component instance alive across /itinerary/:id
    // navigations with a different id — a snapshot-only read here would leave the
    // previous trip's page/state on screen after clicking through to a new one.
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const tripId = params.get('id');
      if (!tripId) {
        // No id in the route at all — treat as "not found".
        this.trip = null;
        this.store.setTrip(null);
        return;
      }
      if (tripId === this.trip?.id) return;
      void this.updateTripState(tripId);
    });
  }

  /**
   * After a version-history restore, force-reload the (same-id) trip and its
   * swap/customization state. Explicitly reset first: updateTripState() only
   * clears customization signals when the trip id itself changes, but a restore
   * can replace/remove customizations on the SAME trip id (e.g. drop a hotel
   * swap the current state had) — without this, stale swaps would linger.
   */
  async onVersionRestored(): Promise<void> {
    const tripId = this.trip?.id;
    if (!tripId) return;
    this.store.resetTripState();
    await this.updateTripState(tripId);
    this.toast.success(this.translate.instant('ITINERARY.VERSION_HISTORY.RESTORED'));
  }

  /** Re-attempt the initial itinerary fetch after a load error. */
  async retryLoad(): Promise<void> {
    const tripId = this.route.snapshot.paramMap.get('id');
    if (!tripId) return;
    this.tripLoading.set(true);
    try {
      const rebuilt = await this.tripService.rebuildTrip(tripId);
      if (rebuilt) {
        this.trip = rebuilt;
        this.store.setTrip(rebuilt);
        this.initializeTripContext();
        this.loadBookingState();
        return;
      }
      await this.updateTripState(tripId);
    } finally {
      this.tripLoading.set(false);
    }
  }

  private tripNeedsPlanRebuild(trip: SavedTrip): boolean {
    if (Boolean(trip.customizations?.['packageId'])) return false;

    const segments = trip.segments || [];
    if (segments.length === 0) {
      return trip.status === 'failed' || trip.status === 'generating' || trip.status === 'ready';
    }

    const activityTitles = segments
      .filter((s) => s.type === 'activity')
      .map((s) => ((s as { title?: string; name?: string }).title || (s as { name?: string }).name || '').trim().toLowerCase());

    // Only rebuild on clearly generic AI placeholders — never on duplicate
    // real titles (two "City walk" stops), which wiped valid plans / adds.
    const genericCount = activityTitles.filter(
      (t) => !t || t === 'food tasting' || t === 'city experience' || t.startsWith('food tasting')
    ).length;
    if (genericCount >= 2) return true;

    const flight = segments.find((s) => s.type === 'flight') as { depDate?: string } | undefined;
    const tripStart = trip.startDate?.slice(0, 7);
    if (flight?.depDate && tripStart && !flight.depDate.includes(tripStart.slice(5))) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const expectedMonth = monthNames[parseInt(tripStart.slice(5, 7), 10) - 1];
      if (expectedMonth && !flight.depDate.includes(expectedMonth)) return true;
    }

    return false;
  }

  private async updateTripState(tripId: string): Promise<void> {
    this.tripLoading.set(true);
    this.tripLoadError.set(null);
    try {
      let trip = await this.tripService.getTripFromBackend(tripId);
      if (!trip) {
        this.trip = null;
        this.store.setTrip(null);
        // getTripFromBackend distinguishes a real failure (network/server) from
        // a genuine 404 via its tripLoadError signal — surface the former so the
        // user sees a retry instead of a misleading "not found".
        this.tripLoadError.set(this.tripService.tripLoadError());
        return;
      }

      // Auto-rebuild wizard trips that failed AI generation, are empty, or have stale generic content.
      if (this.tripNeedsPlanRebuild(trip)) {
        const rebuilt = await this.tripService.rebuildTrip(tripId);
        if (rebuilt) {
          trip = rebuilt;
        }
      }

      // Resets every swap/filter/customization signal when this is a different
      // trip than what was previously loaded (component instances are reused
      // across /itinerary/:id navigations by Angular's route reuse strategy),
      // BEFORE initializeTripContext() re-applies this trip's own customizations.
      this.store.setTrip(trip);
      this.trip = trip;
      this.tripIsConfirmed.set(Boolean(trip.is_confirmed));

      // Load collaboration data
      await this.collaborationService.loadForTrip(tripId);
      const user = this.authService.user();
      if (user) {
        const collab = this.collaborationService.collaborators().find(c => c.user_id === user.id || c.email === user.email);
        if (collab) {
          this.myCollabRole.set(collab.role);
        }
      }

      this.initializeTripContext();
      this.loadBookingState();
    } finally {
      this.tripLoading.set(false);
    }
  }

  hasPartnerBookingAction(item: {
    type?: string;
    provider?: string;
    bookable?: boolean;
    partnerMetadata?: Record<string, unknown>;
    deepLink?: string;
    deep_link?: string;
  } | null): boolean {
    if (!item) return false;

    const metadata = this.partnerMetadata(item);
    const bookable = item.bookable === true || metadata['bookable'] === true;
    if (!bookable) return false;

    if (item.type === 'car') {
      const sessionId = this.metadataString(metadata, 'sessionId', 'session_id');
      return !!sessionId && !!this.metadataString(metadata, 'referenceId', 'reference_id');
    }
    if (item.type === 'hotel') {
      return !!this.metadataString(metadata, 'resultToken', 'ResultToken');
    }
    if (item.type === 'activity') {
      return Boolean(
        this.metadataString(metadata, 'sessionId', 'session_id') &&
          this.metadataString(metadata, 'activityCode') &&
          this.metadataString(metadata, 'optionCode'),
      );
    }
    return false;
  }

  async bookWithPartner(item: any): Promise<void> {
    const itemName = item?.title || item?.name || item?.model || this.translate.instant('ITINERARY.TOAST.GENERIC_ITEM');
    const metadata = this.partnerMetadata(item);

    try {
      if (item?.type === 'car') {
        await this.attemptTravelNextCarBooking(item, metadata);
      } else if (item?.type === 'hotel') {
        await this.attemptTravelomatixHotelBooking(item, metadata);
      } else if (item?.type === 'activity') {
        await this.attemptTravelNextActivityBooking(item, metadata);
      } else {
        throw new Error('Unsupported partner booking item');
      }

      this.toast.success(
        this.translate.instant('ITINERARY.TOAST.PARTNER_BOOKING_SUCCESS', { item: itemName }),
      );
    } catch (err) {
      console.error('Partner booking attempt failed', err);
      this.toast.error(
        apiErrorMessage(
          err,
          this.translate.instant('ITINERARY.TOAST.PARTNER_BOOKING_FAILED', { item: itemName }),
        ),
      );
    }
  }

  bookItem(item: any): void {
    const deepLink = item?.deepLink || item?.deep_link;
    const itemName = item?.title || item?.name || item?.model || this.translate.instant('ITINERARY.TOAST.GENERIC_ITEM');

    // Partner deep link (TravelNext / TripAdvisor / Google) — open partner.
    if (deepLink && typeof deepLink === 'string' && this.isSafeHttpUrl(deepLink)) {
      window.open(deepLink, '_blank', 'noopener,noreferrer');
      this.toast.info(this.translate.instant('ITINERARY.TOAST.BOOKING_INITIATED', { item: itemName }));
      if (item?.type === 'activity' && item?.title) {
        const city = item.city || item.location || this.trip?.destination || '';
        this.chatLearning.trackOutcome(this.trip?.id ?? null, {
          city,
          activity_title: item.title,
          event_type: 'booked',
          budget_tier: this.trip?.budget || 'standard',
          source: 'chat',
        });
      }
      return;
    }

    // Content-only / unbookable items must not silently trigger Stripe trip checkout.
    const contentOnly =
      item?.contentOnly === true ||
      item?.bookable === false ||
      ['google_places', 'google', 'tripadvisor'].includes(
        String(item?.provider || '').toLowerCase(),
      );
    if (contentOnly || item?.type === 'activity' || item?.type === 'hotel' || item?.type === 'car') {
      this.toast.info(
        this.translate.instant('ITINERARY.TOAST.BOOKING_INITIATED', { item: itemName }) +
          this.translate.instant('ITINERARY.TOAST.BOOKING_INITIATED_HINT'),
      );
      return;
    }

    // Explicit whole-trip book only for non-inventory checklist-style items.
    void this.bookCompleteItinerary();
  }

  openPartnerLink(url?: string | null, event?: Event): void {
    event?.stopPropagation();
    if (!url || !this.isSafeHttpUrl(url)) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /** Guards window.open() against non-http(s) schemes (e.g. javascript:) from partner-supplied deep links. */
  private isSafeHttpUrl(url: string): boolean {
    try {
      const parsed = new URL(url, window.location.origin);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private partnerMetadata(item: { partnerMetadata?: Record<string, unknown> } | null | undefined): Record<string, unknown> {
    const metadata = item?.partnerMetadata;
    return metadata && typeof metadata === 'object' ? metadata : {};
  }

  private metadataString(metadata: Record<string, unknown>, ...keys: string[]): string {
    for (const key of keys) {
      const value = metadata[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
      }
    }
    return '';
  }

  private customerIdentity() {
    const email = this.authService.user()?.email || 'traveler@travlplanr.local';
    const localPart = email.split('@')[0] || 'Traveler';
    const words = localPart
      .replace(/[._-]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const firstName = words[0] || 'Traveler';
    const lastName = words.slice(1).join(' ') || 'Guest';
    return { email, firstName, lastName };
  }

  private async attemptTravelNextCarBooking(item: any, metadata: Record<string, unknown>): Promise<void> {
    const identity = this.customerIdentity();
    const sessionId = this.metadataString(metadata, 'sessionId', 'session_id');
    const referenceId = this.metadataString(metadata, 'referenceId', 'reference_id');
    if (!sessionId || !referenceId) {
      throw new Error('Missing TravelNext car booking metadata');
    }

    await this.travelNextCars.book({
      sessionId,
      referenceId,
      noOfPassenger: String(this.effectiveTravelers()),
      clientReference: `tp-car-${Date.now()}`,
      remark: `Travl Planr partner booking for ${item?.model || 'car rental'}`,
      paxDetails: {
        leadPassenger: {
          firstName: identity.firstName,
          lastName: identity.lastName,
          email: identity.email,
        },
      },
      paymentDetails: {
        method: 'partner_hold',
      },
    });
  }

  private async attemptTravelomatixHotelBooking(item: any, metadata: Record<string, unknown>): Promise<void> {
    const identity = this.customerIdentity();
    const resultToken = this.metadataString(metadata, 'resultToken', 'ResultToken');
    if (!resultToken) {
      throw new Error('Missing Travelomatix hotel ResultToken');
    }

    const roomUniqueId = this.metadataString(metadata, 'roomUniqueId', 'RoomUniqueId');
    await this.travelomatixHotels.book({
      ResultToken: resultToken,
      RoomUniqueId: roomUniqueId ? [roomUniqueId] : undefined,
      customerEmail: identity.email,
      customerPhone: this.metadataString(metadata, 'customerPhone') || '0000000000',
      title: 'Mr',
      firstName: identity.firstName,
      lastName: identity.lastName,
    });
  }

  private async attemptTravelNextActivityBooking(item: any, metadata: Record<string, unknown>): Promise<void> {
    const identity = this.customerIdentity();
    const sessionId = this.metadataString(metadata, 'sessionId', 'session_id');
    const activityCode = this.metadataString(metadata, 'activityCode');
    const optionCode = this.metadataString(metadata, 'optionCode');
    if (!sessionId || !activityCode || !optionCode) {
      throw new Error('Missing TravelNext activity booking metadata');
    }


    await this.travelNextActivities.book({
      sessionId,
      clientReference: `tp-activity-${Date.now()}`,
      leadPassenger: {
        firstName: identity.firstName,
        lastName: identity.lastName,
        email: identity.email,
      },
      activities: [
        {
          activityCode,
          optionCode,
          adults: this.activityDetailTravelers() || this.effectiveTravelers(),
          children: 0,
        },
      ],
    });
  }

  bookInsurance(): void {
    this.bookItem({ title: this.translate.instant('ITINERARY.CHECKLIST.INSURANCE_TITLE') });
  }

  bookVisaAssistance(): void {
    this.bookItem({ title: this.translate.instant('ITINERARY.CHECKLIST.VISA_TITLE') });
  }

  bookIdpSupport(): void {
    this.bookItem({ title: this.translate.instant('ITINERARY.CHECKLIST.IDP_TITLE') });
  }

  editDates(): void {
    this.dateStartInput.set(this.trip?.startDate || '');
    this.dateEndInput.set(this.trip?.endDate || '');
    this.showDateEditModal.set(true);
  }

  saveDates(): void {
    const start = this.dateStartInput();
    const end = this.dateEndInput();
    if (start && end && this.trip) {
      const parsedStart = new Date(start);
      const parsedEnd = new Date(end);
      if (!isNaN(parsedStart.getTime()) && !isNaN(parsedEnd.getTime()) && parsedEnd >= parsedStart) {
        this.trip.startDate = start;
        this.trip.endDate = end;
        this.tripStartDate.set(parsedStart);
        this.syncCustomizationsToBackend();
        this.toast.success(this.translate.instant('ITINERARY.TOAST.DATES_UPDATED'));
        this.showDateEditModal.set(false);
      } else {
        this.toast.error(this.translate.instant('ITINERARY.TOAST.INVALID_DATES_FORMAT'));
      }
    } else {
      this.toast.error(this.translate.instant('ITINERARY.TOAST.INVALID_DATES_FORMAT'));
    }
  }

  editTravelers(): void {
    this.travelerCountInput.set(`${this.effectiveTravelers()}`);
    this.showTravelerCountModal.set(true);
  }

  saveTravelerCount(): void {
    const count = this.travelerCountInput();
    if (count) {
      const num = parseInt(count, 10);
      if (!isNaN(num) && num > 0 && num <= 20 && this.trip) {
        this.trip.travelers = num;
        this.flightDetailTravelers.set(num);
        this.trainDetailTravelers.set(num);
        this.activityDetailTravelers.set(num);
        this.syncCustomizationsToBackend();
        this.toast.success(this.translate.instant('ITINERARY.TOAST.TRAVELER_COUNT_UPDATED'));
        this.showTravelerCountModal.set(false);
      } else {
        this.toast.error(this.translate.instant('ITINERARY.TOAST.INVALID_TRAVELER_COUNT'));
      }
    }
  }

  async bookCompleteItinerary(): Promise<void> {
    if (!this.trip?.id || this.bookingInProgress()) return;
    this.bookingInProgress.set(true);
    try {
      await this.markTripListedInMyTrips();
      const { firstValueFrom } = await import('rxjs');
      const response = await firstValueFrom(this.http.post<any>(apiUrl('/checkout'), {
        trip_id: this.trip.id,
        amount: this.costTotal()
      }));
      const url: string = response?.checkout_url ?? '';
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.error('Failed to book', err);
      this.toast.error(this.translate.instant('ITINERARY.TOAST.BOOK_FAILED'));
    } finally {
      this.bookingInProgress.set(false);
    }
  }

  /** Persist itinerary edits and flag the trip for My Trips (Save / Book). */
  private async markTripListedInMyTrips(): Promise<void> {
    if (!this.trip) return;
    // Merge saved flags through the same sync queue so Save/Book cannot race
    // a concurrent customizations PUT.
    const run = async (): Promise<boolean> => {
      if (!this.trip) return false;
      this.trip.customizations = {
        ...this.trip.customizations,
        hotels: this.swappedHotels(),
        flights: this.swappedFlights(),
        activities: this.swappedActivities(),
        trains: this.swappedTrains(),
        buses: this.swappedBuses(),
        cars: this.swappedCars(),
        addedActivities: this.addedActivities(),
        addedTransport: this.addedTransport(),
        removedItems: Array.from(this.removedItemKeys()),
        itemOrder: this.customItemOrder(),
        notes: this.tripNotes(),
        savedToMyTrips: true,
        savedAt: new Date().toISOString(),
      };
      await this.tripService.saveTrip(this.trip);
      return true;
    };
    const queued = this.syncQueue.then(run, run);
    this.syncQueue = queued.then(
      () => true,
      () => true,
    );
    await queued;
    this.tripService.refreshTrips();
  }

  private bookingStorageKey(): string {
    return `travlplanr_booked_${this.trip?.id ?? 'trip'}`;
  }

  private loadBookingState(): void {
    if (!this.trip) {
      return;
    }
    this.isBooked.set(this.trip.status === 'booked');
  }

  async downloadItineraryPdf(): Promise<void> {
    if (!this.trip || this.pdfDownloading()) {
      return;
    }

    const data = this.buildPdfData();
    this.pdfExportData.set(data);
    this.pdfDownloading.set(true);

    try {
      await this.waitForPdfTemplateRender();
      const root = this.pdfExportRoot?.nativeElement.querySelector('.pdf-root') as HTMLElement | null;
      if (!root) {
        return;
      }
      await this.itineraryPdfService.download(root, this.itineraryPdfService.buildFilename(data));
    } catch {
      this.toast.error(this.translate.instant('ITINERARY.TOAST.PDF_GENERATION_FAILED'));
    } finally {
      this.pdfDownloading.set(false);
    }
  }

  private async waitForPdfTemplateRender(): Promise<void> {
    await Promise.resolve();
    if (typeof window === 'undefined') return;
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  }

  private async syncCustomizationsToBackend(): Promise<boolean> {
    if (!this.trip) return false;

    // Serialize saves so overlapping PUTs cannot wipe a newer snapshot.
    const run = async (): Promise<boolean> => {
      if (!this.trip) return false;
      this.trip.customizations = {
        ...this.trip.customizations,
        hotels: this.swappedHotels(),
        flights: this.swappedFlights(),
        activities: this.swappedActivities(),
        trains: this.swappedTrains(),
        buses: this.swappedBuses(),
        cars: this.swappedCars(),
        addedActivities: this.addedActivities(),
        addedTransport: this.addedTransport(),
        removedItems: Array.from(this.removedItemKeys()),
        itemOrder: this.customItemOrder(),
        notes: this.tripNotes(),
      };
      try {
        await this.tripService.saveTrip(this.trip);
        return true;
      } catch (err: any) {
        console.error('Failed to sync customizations to backend', err);
        const msg = apiErrorMessage(err, this.translate.instant('ITINERARY.TOAST.SAVE_CHANGES_FAILED'));
        this.toast.error(msg);
        return false;
      }
    };

    const queued = this.syncQueue.then(run, run);
    this.syncQueue = queued.then(
      () => true,
      () => true,
    );
    return queued;
  }

  private async applyTripNote(note: string, day?: number): Promise<void> {
    const ready = await this.waitForTripReady();
    if (!ready) {
      this.toast.error(this.translate.instant('ITINERARY.TOAST.STILL_LOADING_NOTE_RETRY'));
      return;
    }
    const entry = { text: note, day, createdAt: new Date().toISOString() };
    this.tripNotes.update((notes) => [...notes, entry]);
    await this.syncCustomizationsToBackend();
    this.toast.success(
      day
        ? this.translate.instant('ITINERARY.TOAST.NOTE_SAVED_FOR_DAY', { day })
        : this.translate.instant('ITINERARY.TOAST.NOTE_SAVED')
    );
  }

  private async waitForRegeneration(): Promise<void> {
    const tripId = this.trip?.id;
    if (!tripId) return;
    this.tripLoading.set(true);
    try {
      const trip = await this.tripService.waitForTripReady(tripId, 180_000);
      if (trip) {
        this.trip = trip;
        this.initializeTripContext();
        this.toast.success(this.translate.instant('ITINERARY.TOAST.REGENERATED'));
      } else {
        this.toast.error(this.translate.instant('ITINERARY.TOAST.REGENERATION_SLOW'));
      }
    } finally {
      this.tripLoading.set(false);
    }
  }

  async saveItinerary(): Promise<void> {
    if (!this.trip) {
      return;
    }

    try {
      await this.markTripListedInMyTrips();
      this.toast.success(this.translate.instant('ITINERARY.TOAST.SAVED_TO_MY_TRIPS'));
    } catch (err: any) {
      const msg = apiErrorMessage(err, this.translate.instant('ITINERARY.TOAST.SAVE_ITINERARY_FAILED'));
      this.toast.error(msg);
    }
  }



  private buildPdfData(): ItineraryPdfData {
    const trip = this.trip!;
    const cities = this.cities();
    const days = this.displayedDays();
    const nights = this.totalNights();
    const booked = this.isBooked();
    const inclusionCounts = this.countPdfInclusions(days);

    const pdfCount = (base: string, count: number) =>
      this.translate.instant(`ITINERARY.PDF.${base}_${count > 1 ? 'PLURAL' : 'SINGULAR'}`, { count });

    const inclusionParts: string[] = [];
    if (inclusionCounts.flights) inclusionParts.push(pdfCount('INCLUSION_FLIGHTS', inclusionCounts.flights));
    if (inclusionCounts.trains) inclusionParts.push(pdfCount('INCLUSION_TRAINS', inclusionCounts.trains));
    if (inclusionCounts.buses) inclusionParts.push(pdfCount('INCLUSION_BUSES', inclusionCounts.buses));
    if (inclusionCounts.hotels) inclusionParts.push(pdfCount('INCLUSION_HOTELS', inclusionCounts.hotels));
    if (inclusionCounts.activities) inclusionParts.push(pdfCount('INCLUSION_ACTIVITIES', inclusionCounts.activities));
    if (inclusionCounts.cars) inclusionParts.push(pdfCount('INCLUSION_RENTAL_CARS', inclusionCounts.cars));

    const start = new Date(this.tripStartDate());
    const end = new Date(start);
    end.setDate(start.getDate() + nights);

    const destinationLabel = cities.map((c) => c.name).join(', ');
    const durationLabel = this.translate.instant('ITINERARY.PDF.DURATION_LABEL', { days: nights + 1, nights });

    return {
      variant: booked ? 'post-booking' : 'pre-booking',
      tripTitle: booked
        ? this.translate.instant('ITINERARY.PDF.BOOKED_TRIP_TITLE', { days: nights + 1, destination: destinationLabel })
        : trip.title,
      dateRange: `${this.formatPdfDate(start)} to ${this.formatPdfDate(end)}`,
      destinations: destinationLabel,
      duration: durationLabel,
      travellers: this.formatPdfTravellers(trip),
      inclusion: inclusionParts.join(', ') || this.translate.instant('ITINERARY.PDF.DEFAULT_INCLUSION'),
      price: `${CURRENCY_SYMBOLS[this.locale.currentCurrency()]} ${this.costTotal().toLocaleString('en-IN')}`,
      priceNote: booked
        ? undefined
        : this.translate.instant('ITINERARY.PDF.PRICE_NOTE', { date: this.formatPdfTaxDate(new Date()) }),
      bookingUrl: this.pdfBookingUrl(trip),
      departureReturn: this.formatPdfDepartureReturn(start, end),
      days: days.map((day) => ({
        day: day.day,
        title: day.title,
        dateStr: day.dateStr,
        items: day.items.map((item) => this.mapDetailItemToPdfItem(item)),
      })),
      partners: PARTNER_LOGOS.map((p) => p.name),
      summarySections: this.inclusions().map((section) => ({
        title: this.translate.instant(section.title),
        items: section.items,
      })),
      faqItems: this.buildPdfFaq(),
    };
  }

  private formatPdfTravellers(trip: SavedTrip): string {
    const travellers = Math.max(1, trip.travelers || this.effectiveTravelers());
    return this.translate.instant(`ITINERARY.PDF.TRAVELLERS_COUNT_${travellers > 1 ? 'PLURAL' : 'SINGULAR'}`, { count: travellers });
  }

  private pdfBookingUrl(trip: SavedTrip): string | undefined {
    if (!trip.id || typeof window === 'undefined') return undefined;
    return new URL(`/itinerary/${trip.id}`, window.location.origin).toString();
  }

  private countPdfInclusions(days: DetailDay[]): {
    flights: number;
    trains: number;
    buses: number;
    hotels: number;
    activities: number;
    cars: number;
  } {
    const counts = { flights: 0, trains: 0, buses: 0, hotels: 0, activities: 0, cars: 0 };
    for (const day of days) {
      for (const item of day.items) {
        if (item.type === 'flight') counts.flights++;
        else if (item.type === 'train') counts.trains++;
        else if (item.type === 'bus') counts.buses++;
        else if (item.type === 'hotel') counts.hotels++;
        else if (item.type === 'activity') counts.activities++;
        else if (item.type === 'car') counts.cars++;
      }
    }
    return counts;
  }

  /** Formats a segment price for the PDF in the active display currency. */
  private formatPdfCost(item: { price?: number; currency?: string; provider?: string; type?: string }): string | undefined {
    const amount = this.priceToUsd(item);
    if (amount <= 0) return undefined;
    const symbol = CURRENCY_SYMBOLS[this.locale.currentCurrency()];
    return `${symbol}${Math.round(amount).toLocaleString()}`;
  }

  private mapDetailItemToPdfItem(item: DetailItem): ItineraryPdfItem {
    switch (item.type) {
      case 'flight':
        return {
          kind: 'flight',
          title: `Flight to ${this.cityNameForAirport(item.arrCode)}`,
          subtitle: `${item.carrier} • ${item.flightNo}`,
          classLabel: item.class,
          refundable: item.refundable,
          depDate: item.depDate,
          depTime: item.depTime,
          depLocation: item.depCode,
          arrDate: item.arrDate,
          arrTime: item.arrTime,
          arrLocation: item.arrCode,
          duration: item.duration,
          stops: item.stops,
          cost: this.formatPdfCost(item),
        };
      case 'train':
        return {
          kind: 'train',
          title: item.route,
          subtitle: item.carrier,
          depDate: item.depDate,
          depTime: item.depTime,
          depLocation: item.depLocation,
          arrDate: item.arrDate,
          arrTime: item.arrTime,
          arrLocation: item.arrLocation,
          duration: item.duration,
          stops: item.stops,
          cost: this.formatPdfCost(item) ?? item.cost,
          imageUrl: item.imageUrl,
        };
      case 'bus':
        return {
          kind: 'bus',
          title: item.route,
          subtitle: item.carrier,
          depDate: item.depDate,
          depTime: item.depTime,
          depLocation: item.depLocation,
          arrDate: item.arrDate,
          arrTime: item.arrTime,
          arrLocation: item.arrLocation,
          duration: item.duration,
          stops: item.stops,
          cost: this.formatPdfCost(item) ?? item.cost,
          imageUrl: item.imageUrl,
        };
      case 'hotel':
        return {
          kind: 'hotel',
          title: item.name,
          rating: item.rating,
          location: item.location,
          dates: item.dates,
          imageUrl: item.imageUrl,
          amenities: item.amenities,
          cost: this.formatPdfCost(item),
        };
      case 'activity':
        return {
          kind: 'activity',
          title: item.title,
          time: item.time,
          location: item.location,
          refundable: item.refundable,
          imageUrl: item.image,
          cost: this.formatPdfCost(item),
        };
      case 'car':
        return {
          kind: 'car',
          title: item.model,
          subtitle: item.category,
          location: item.location,
          dates: item.dates,
          imageUrl: item.imageUrl,
          cost: this.formatPdfCost(item),
        };
      default:
        return { kind: 'activity', title: 'Itinerary item' };
    }
  }

  private formatPdfDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  private formatPdfTaxDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private formatPdfDepartureReturn(start: Date, end: Date): string {
    const fmt = new Intl.DateTimeFormat('en-US', { month: 'long', day: '2-digit' });
    return `${fmt.format(start)}, ${fmt.format(end)}`;
  }

  getItemKey(item: DetailItem): string {
    const itemId = (item as any).id;
    if (itemId) return `${item.type}-${itemId}`;
    if (item.type === 'flight') return `flight-${item.carrier || ''}-${item.flightNo || ''}-${item.depTime || ''}`;
    if (item.type === 'hotel') return `hotel-${item.name || ''}`;
    if (item.type === 'car') return `car-${item.model || ''}`;
    if (item.type === 'activity') return `activity-${item.title || ''}`;
    if (item.type === 'train') return `train-${item.carrier || ''}-${item.depTime || ''}`;
    if (item.type === 'bus') return `bus-${item.carrier || ''}-${item.depTime || ''}`;
    return 'unknown';
  }

  private async applyItineraryEdit(edit: ItineraryEditPayload): Promise<void> {
    switch (edit.edit) {
      case 'add_activity': {
        const title = (edit.title ?? '').trim();
        // Guardrail: a title that is generic, empty, or still carries a
        // "day N" fragment must never become a literal card — it means the
        // request was a bulk "add activities" ask, so fetch real ones instead
        // of echoing the command text back as an activity.
        const wantsSuggested =
          edit.autoSuggest || !title || isGenericActivityTitle(title) || /\bday\s*\d+/i.test(title);
        if (wantsSuggested) {
          await this.addSuggestedActivitiesFromChat(edit.day ?? 1, edit.count ?? 1);
        } else {
          this.addActivityFromChat(edit.day ?? 1, title);
        }
        break;
      }
      case 'add_transport':
        await this.addTransportFromChat(edit.day ?? 1, edit.transportType ?? 'train');
        break;
      case 'remove_item':
        this.removeItemFromChat(edit.day, edit.titleMatch ?? '', edit.itemType);
        break;
      case 'swap_transport':
        await this.swapTransportFromChat(
          edit.day ?? 1,
          edit.toType ?? 'bus',
          edit.fromTitleMatch,
          edit.fromType ?? 'car',
        );
        break;
    }
  }

  private addActivityFromChat(
    dayDay: number,
    title: string,
    opts?: Partial<Pick<AlternativeActivity, 'timeOfDay' | 'duration' | 'attractionType' | 'image'>>,
  ): void {
    const city = this.cityForDay(dayDay);
    const cityImage = activityImageForCity(city);
    const activity: AlternativeActivity = {
      id: crypto.randomUUID(),
      title,
      rating: 4.6,
      location: city,
      city,
      distance: '2 km from hotel',
      refundable: 'Free cancellation',
      price: 0,
      image: opts?.image || cityImage || this.pickImage(undefined, `${city}-${title}`, this.activityImagePool),
      timeOfDay: opts?.timeOfDay ?? 'Morning',
      duration: opts?.duration ?? '3 hours',
      attractionType: opts?.attractionType ?? 'Experience',
      locationType: 'In City Center',
      isPopular: false,
    };
    this.addedActivities.set([...this.addedActivities(), { dayDay, activity }]);
    this.chatLearning.trackOutcome(this.trip?.id ?? null, {
      city,
      activity_title: title,
      event_type: 'kept',
      budget_tier: this.trip?.budget || 'standard',
      day_number: dayDay,
      source: 'chat',
    });
  }

  private existingActivityTitlesOnDay(dayDay: number): Set<string> {
    const titles = new Set<string>();
    const day = this.displayedDays().find((d) => d.day === dayDay);
    if (day) {
      for (const item of day.items) {
        if (item.type === 'activity') titles.add(item.title.toLowerCase());
      }
    }
    for (const added of this.addedActivities()) {
      if (added.dayDay === dayDay) titles.add(added.activity.title.toLowerCase());
    }
    return titles;
  }

  private async addSuggestedActivitiesFromChat(dayDay: number, count: number): Promise<void> {
    const city = this.cityForDay(dayDay);
    const existing = this.existingActivityTitlesOnDay(dayDay);
    const curated = getSuggestedActivitiesForCity(city, count + 4);
    const slots: SuggestedActivity['timeOfDay'][] = ['Morning', 'Noon', 'Evening', 'Night'];
    let candidates: SuggestedActivity[] = [];

    if (this.trip?.id) {
      try {
        candidates = await this.chatLearning.fetchRankedSuggestions({
          tripId: this.trip.id,
          day: dayDay,
          count,
          existingTitles: [...existing],
          curatedCandidates: curated,
        });
      } catch {
        /* fall through to local ranking */
      }
    }

    if (!candidates.length) {
      try {
        const results = await this.tripService.searchInventory({
          type: 'activity',
          location: city,
          budget: this.trip?.budget || 'standard',
        });
        results.forEach((r, i) => {
          candidates.push({
            title: r.title,
            timeOfDay: slots[i % slots.length],
            duration: r.duration || '2 hours',
            attractionType: 'Tour',
          });
        });
      } catch {
        /* inventory optional */
      }
      for (const suggestion of curated) {
        if (candidates.length >= count + 4) break;
        if (!candidates.some((c) => c.title.toLowerCase() === suggestion.title.toLowerCase())) {
          candidates.push(suggestion);
        }
      }
    }

    let added = 0;
    for (const candidate of candidates) {
      if (added >= count) break;
      if (existing.has(candidate.title.toLowerCase())) continue;
      this.chatLearning.trackOutcome(this.trip?.id ?? null, {
        city,
        activity_title: candidate.title,
        event_type: 'suggested',
        budget_tier: this.trip?.budget || 'standard',
        day_number: dayDay,
        source: 'chat',
      });
      this.addActivityFromChat(dayDay, candidate.title, {
        timeOfDay: toItineraryTimeSlot(candidate.timeOfDay || slots[added % slots.length]),
        duration: candidate.duration,
        attractionType: candidate.attractionType,
        image: (candidate as SuggestedActivity & { image?: string }).image,
      });
      existing.add(candidate.title.toLowerCase());
      added++;
    }

    if (added === 0) {
      this.toast.info(
        this.translate.instant('ITINERARY.TOAST.NO_ACTIVITIES_FOUND', { city }),
      );
    } else if (added < count) {
      this.toast.info(
        this.translate.instant('ITINERARY.TOAST.ADDED_FEWER_ACTIVITIES', { added, city }),
      );
    }
  }

  private async addTransportFromChat(dayDay: number, transportType: 'train' | 'bus' | 'flight' | 'car'): Promise<void> {
    const item = await this.createTransportDetailItem(dayDay, transportType);
    if (!item) return;
    this.upsertTransportOnDay(dayDay, item);
    await this.enqueueTransferPlan(dayDay, { silent: true });
  }

  private async createTransportDetailItem(
    dayDay: number,
    transportType: 'train' | 'bus' | 'flight' | 'car',
  ): Promise<DetailItem | null> {
    const route = this.routeForTransportDay(dayDay);
    const start = new Date(this.tripStartDate());
    start.setDate(start.getDate() + dayDay - 1);
    const dateLabel = start.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' });

    if (transportType === 'bus') {
      const inventoryBus = await this.fetchFirstBusForDay(dayDay, route);
      if (inventoryBus) return inventoryBus;
    }

    if (transportType === 'train') {
      return {
        type: 'train',
        carrier: 'Regional Rail',
        route: `${route.depLocation} → ${route.arrLocation}`,
        depDate: dateLabel,
        depTime: '09:00 AM',
        depLocation: route.depLocation,
        arrDate: dateLabel,
        arrTime: '12:30 PM',
        arrLocation: route.arrLocation,
        duration: '3h 30m',
        stops: 'Direct',
        cost: 'Included',
        imageUrl: this.trainImagePool[0],
      };
    }
    if (transportType === 'bus') {
      return {
        type: 'bus',
        carrier: 'Intercity Bus',
        route: `${route.depLocation} → ${route.arrLocation}`,
        depDate: dateLabel,
        depTime: '10:00 AM',
        depLocation: route.depLocation,
        arrDate: dateLabel,
        arrTime: '02:00 PM',
        arrLocation: route.arrLocation,
        duration: '4h',
        stops: '1 Stop',
        cost: 'Included',
        imageUrl: this.busImagePool[0],
      };
    }
    if (transportType === 'flight') {
      return {
        type: 'flight',
        carrier: 'Airline',
        flightNo: 'TP101',
        class: 'Economy',
        refundable: 'Partially refundable',
        depDate: dateLabel,
        depTime: '08:00 AM',
        depCode: route.dep,
        arrDate: dateLabel,
        arrTime: '10:30 AM',
        arrCode: route.arr,
        duration: '2h 30m',
        stops: 'Non-stop',
        status: 'Suggested',
      };
    }
    return {
      type: 'car',
      model: 'Private Transfer',
      category: 'Sedan',
      location: `${route.depLocation} → ${route.arrLocation}`,
      dates: dateLabel,
      passengers: this.trip?.travelers || 2,
      gearbox: 'Automatic',
      bags: 2,
      fuel: 'Included',
      imageUrl: this.carImagePool[0],
    };
  }

  private async fetchFirstBusForDay(
    dayDay: number,
    route: { depLocation: string; arrLocation: string; dateLabel: string },
  ): Promise<DetailBus | null> {
    try {
      const results = await this.tripService.searchInventory({
        type: 'bus',
        location: route.depLocation,
        budget: this.budgetOption() || this.trip?.budget || 'standard',
      });
      const r = results[0];
      if (!r) return null;
      return {
        type: 'bus',
        carrier: String(r.provider || r.title || 'Intercity Bus'),
        route: `${route.depLocation} → ${route.arrLocation}`,
        depDate: route.dateLabel,
        depTime: String(r.dep_time || '10:00 AM'),
        depLocation: route.depLocation,
        arrDate: route.dateLabel,
        arrTime: String(r.arr_time || '02:00 PM'),
        arrLocation: route.arrLocation,
        duration: String(r.duration || '4h'),
        stops: String(r.stops || '1 Stop'),
        cost: typeof r.price === 'object'
          ? `${CURRENCY_SYMBOLS[this.locale.currentCurrency()]} ${(r.price?.amount ?? 0).toLocaleString('en-IN')}`
          : `${CURRENCY_SYMBOLS[this.locale.currentCurrency()]} ${Number(r.price || 0).toLocaleString('en-IN')}`,
        imageUrl: this.pickImageByKeyword(
          r.image_url,
          r.id || r.title || '',
          String(r.provider || ''),
          this.busKeywordLogos,
          this.busImagePool,
        ),
      };
    } catch {
      return null;
    }
  }

  private async swapTransportFromChat(
    dayDay: number,
    toType: 'train' | 'bus' | 'flight' | 'car',
    fromTitleMatch?: string,
    fromType: 'train' | 'bus' | 'flight' | 'car' = 'car',
  ): Promise<void> {
    const replacement = await this.createTransportDetailItem(dayDay, toType);
    if (!replacement) return;

    const replacedInSegments = this.replaceTransportInSegments(
      dayDay,
      fromType,
      replacement,
      fromTitleMatch,
    );

    if (replacedInSegments) {
      this.tripSegmentsVersion.update((v) => v + 1);
      this.clearTransportSwapOverrides(
        fromType,
        replacedInSegments.day,
        replacedInSegments.clearedKeys,
      );
      this.stripAddedTransport(fromType, fromTitleMatch, replacedInSegments.day);
      await this.enqueueTransferPlan(replacedInSegments.day, {
        silent: true,
      });
      return;
    }

    const removed = this.removeTransportOnDay(dayDay, fromType, fromTitleMatch);
    if (!removed) {
      for (let d = 1; d <= 14; d++) {
        if (d === dayDay) continue;
        if (this.removeTransportOnDay(d, fromType, fromTitleMatch)) break;
      }
    }
    const withoutSame = this.addedTransport().filter(
      (t) => !(this.dayOf(t.dayDay) === this.dayOf(dayDay) && t.item.type === toType),
    );
    this.addedTransport.set([...withoutSame, { dayDay, item: replacement }]);
    await this.enqueueTransferPlan(dayDay, { silent: true });
  }

  private replaceTransportInSegments(
    preferredDay: number,
    fromType: 'train' | 'bus' | 'flight' | 'car',
    replacement: DetailItem,
    fromTitleMatch?: string,
  ): { day: number; index: number; clearedKeys: string[] } | null {
    if (!this.trip?.segments?.length) return null;

    const findCandidates = (titleNeedle?: string, restrictDay?: number) => {
      const candidates: Array<{ index: number; day: number }> = [];
      this.trip!.segments!.forEach((segment, index) => {
        if (segment.type !== fromType) return;
        const day = this.dayOf(segment.day);
        if (restrictDay !== undefined && day !== this.dayOf(restrictDay)) return;
        const item = segment as unknown as DetailItem;
        if (titleNeedle && !this.itemTitle(item).toLowerCase().includes(titleNeedle)) return;
        candidates.push({ index, day });
      });
      return candidates;
    };

    const needle = normalizeFromTitleMatch(fromTitleMatch)?.toLowerCase();
    let candidates = findCandidates(needle);
    if (!candidates.length && needle) {
      candidates = findCandidates(undefined, preferredDay);
    }
    if (!candidates.length) {
      candidates = findCandidates(undefined, preferredDay);
    }
    if (!candidates.length) return null;

    const preferred = this.dayOf(preferredDay);
    const onPreferredDay = candidates.find((c) => c.day === preferred);
    const target = onPreferredDay ?? candidates[0];
    const { day } = target;
    const before = this.trip.segments[target.index] as unknown as DetailItem;
    const clearedKeys = [this.getItemKey(before)];

    const nextSegment = { day, ...replacement, id: (before as { id?: string }).id };
    this.trip.segments = this.trip.segments.map((segment, index) =>
      index === target.index ? nextSegment : segment,
    );

    return { ...target, clearedKeys };
  }

  private clearTransportSwapOverrides(
    fromType: 'train' | 'bus' | 'flight' | 'car',
    day: number,
    extraKeys: string[] = [],
  ): void {
    // Keys are `flight-…` / `car-…` etc., not `${day}-…`. Clear by matching
    // any segment/added item of that type on the day, plus keys captured before
    // a segment type was replaced.
    const keysToClear = new Set<string>(extraKeys);
    for (const seg of this.trip?.segments || []) {
      if (seg.type !== fromType || this.dayOf(seg.day) !== this.dayOf(day)) continue;
      keysToClear.add(this.getItemKey(seg as unknown as DetailItem));
      // Legacy non-unique model/carrier keys that could bleed across days.
      if (fromType === 'car' && (seg as DetailCar).model) {
        keysToClear.add(`car-${(seg as DetailCar).model}`);
      }
    }
    for (const t of this.addedTransport()) {
      if (this.dayOf(t.dayDay) !== this.dayOf(day) || t.item.type !== fromType) continue;
      keysToClear.add(this.getItemKey(t.item));
      if (fromType === 'car' && (t.item as DetailCar).model) {
        keysToClear.add(`car-${(t.item as DetailCar).model}`);
      }
    }
    // Also clear legacy day-prefixed keys if any remain.
    const prefix = `${day}-`;

    const clearMap = <T,>(signal: { (): Record<string, T>; set(v: Record<string, T>): void }) => {
      const next = { ...signal() };
      for (const key of Object.keys(next)) {
        if (keysToClear.has(key) || key.startsWith(prefix)) delete next[key];
      }
      signal.set(next);
    };

    if (fromType === 'car') clearMap(this.swappedCars);
    else if (fromType === 'train') clearMap(this.swappedTrains);
    else if (fromType === 'bus') clearMap(this.swappedBuses);
    else if (fromType === 'flight') clearMap(this.swappedFlights);
  }

  private stripAddedTransport(
    fromType: 'train' | 'bus' | 'flight' | 'car',
    fromTitleMatch: string | undefined,
    day: number,
  ): void {
    const needle = fromTitleMatch?.toLowerCase().replace(/^the\s+/, '').trim();
    this.addedTransport.update((prev) =>
      prev.filter((entry) => {
        if (this.dayOf(entry.dayDay) !== this.dayOf(day)) return true;
        if (entry.item.type !== fromType) return true;
        if (needle && !this.itemTitle(entry.item).toLowerCase().includes(needle)) return true;
        return false;
      }),
    );
  }

  private async waitForTripReady(timeoutMs = 15000): Promise<boolean> {
    const tripId = this.route.snapshot.paramMap.get('id');
    if (!tripId) return false;

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.trip?.id === tripId && (this.trip.segments?.length ?? 0) > 0) {
        return true;
      }
      if (!this.tripLoading()) {
        await this.updateTripState(tripId);
        if (this.trip?.id === tripId && (this.trip.segments?.length ?? 0) > 0) {
          return true;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return Boolean(this.trip?.segments?.length);
  }

  private removeTransportOnDay(
    day: number,
    type: 'train' | 'bus' | 'flight' | 'car',
    titleMatch?: string,
  ): boolean {
    const needle = normalizeFromTitleMatch(titleMatch)?.toLowerCase();
    const removed = new Set(this.removedItemKeys());
    let found = false;
    let rentalIdToClear: string | null = null;

    if (this.trip?.segments?.length) {
      for (const segment of this.trip.segments) {
        const dayNum = this.dayOf(segment.day);
        if (dayNum !== this.dayOf(day)) continue;
        const item = segment as unknown as DetailItem;
        if (item.type !== type) continue;
        if (needle && !this.itemTitle(item).toLowerCase().includes(needle)) continue;
        removed.add(`${dayNum}-${this.getItemKey(item)}`);
        if (type === 'car') {
          const rid = (item as DetailCar).rentalId;
          if (rid) rentalIdToClear = rid;
        }
        found = true;
      }
    }

    if (!found && needle) {
      for (const segment of this.trip?.segments || []) {
        const dayNum = this.dayOf(segment.day);
        if (dayNum !== this.dayOf(day)) continue;
        if (segment.type !== type) continue;
        const item = segment as unknown as DetailItem;
        removed.add(`${dayNum}-${this.getItemKey(item)}`);
        if (type === 'car') {
          const rid = (item as DetailCar).rentalId;
          if (rid) rentalIdToClear = rid;
        }
        found = true;
        break;
      }
    }

    if (!found) {
      this.addedTransport.update((prev) => {
        const next = prev.filter((entry) => {
          if (entry.dayDay !== day) return true;
          if (entry.item.type !== type) return true;
          if (needle && !this.itemTitle(entry.item).toLowerCase().includes(needle)) return true;
          if (type === 'car') {
            const rid = (entry.item as DetailCar).rentalId;
            if (rid) rentalIdToClear = rid;
          }
          found = true;
          return false;
        });
        return next;
      });
    }

    if (rentalIdToClear) {
      for (const segment of this.trip?.segments || []) {
        if (segment.type !== 'car') continue;
        if ((segment as DetailCar).rentalId !== rentalIdToClear) continue;
        const dayNum = this.dayOf(segment.day);
        removed.add(`${dayNum}-${this.getItemKey(segment as unknown as DetailItem)}`);
        found = true;
      }
      this.addedTransport.update((prev) =>
        prev.filter(
          (entry) =>
            !(
              entry.item.type === 'car' &&
              (entry.item as DetailCar).rentalId === rentalIdToClear
            ),
        ),
      );
    }

    this.removedItemKeys.set(removed);
    return found;
  }

  private removeItemFromChat(
    day: number | undefined,
    titleMatch: string,
    itemType?: 'activity' | 'transport',
  ): void {
    const needle = titleMatch.toLowerCase().trim();
    if (!needle) return;

    if (!itemType || itemType === 'activity') {
      for (const entry of this.addedActivities()) {
        if (day && entry.dayDay !== day) continue;
        if (entry.activity.title.toLowerCase().includes(needle)) {
          this.chatLearning.trackOutcome(this.trip?.id ?? null, {
            city: entry.activity.city || this.cityForDay(entry.dayDay),
            activity_title: entry.activity.title,
            event_type: 'removed',
            budget_tier: this.trip?.budget || 'standard',
            day_number: entry.dayDay,
            source: 'chat',
          });
        }
      }
    }

    this.addedActivities.update((prev) =>
      prev.filter((entry) => {
        if (day && entry.dayDay !== day) return true;
        return !entry.activity.title.toLowerCase().includes(needle);
      }),
    );

    this.addedTransport.update((prev) =>
      prev.filter((entry) => {
        if (day && entry.dayDay !== day) return true;
        return !this.itemTitle(entry.item).toLowerCase().includes(needle);
      }),
    );

    const removed = new Set(this.removedItemKeys());
    if (this.trip?.segments?.length) {
      for (const segment of this.trip.segments) {
        const dayNum = this.dayOf(segment.day);
        if (day != null && dayNum !== this.dayOf(day)) continue;
        const item = segment as unknown as DetailItem;
        if (itemType === 'activity' && item.type !== 'activity') continue;
        if (itemType === 'transport' && !['train', 'bus', 'flight', 'car'].includes(item.type)) continue;
        if (this.itemTitle(item).toLowerCase().includes(needle)) {
          removed.add(`${dayNum}-${this.getItemKey(item)}`);
        }
      }
    }
    this.removedItemKeys.set(removed);
  }

  private itemTitle(item: DetailItem): string {
    if (item.type === 'activity') return item.title;
    if (item.type === 'train' || item.type === 'bus') return `${item.route} ${item.carrier}`;
    if (item.type === 'flight') return `${item.carrier} ${item.flightNo}`;
    if (item.type === 'car') return item.model;
    if (item.type === 'hotel') return item.name;
    return '';
  }

  getCarImageUrl(item: { model: string; imageUrl?: string }): string {
    const img = item.imageUrl || '';
    if (this.isExternalImage(img)) return img;

    const model = (item.model || '').toLowerCase();
    if (model.includes('camry')) return 'assets/images/cars/camry.png';
    if (model.includes('kona')) return 'assets/images/cars/kona.png';
    if (model.includes('peugeot')) return 'assets/images/cars/peugeot.png';
    if (model.includes('volvo')) return 'assets/images/cars/volvo.png';
    if (model.includes('polo')) return 'assets/images/cars/polo.png';
    if (model.includes('citroen') || model.includes('citroën')) return 'assets/images/cars/citroen.png';
    if (model.includes('kuga')) return 'assets/images/cars/kuga.png';

    // Fallback if the image URL is a package or landing image (which are city highlights)
    if (this.isGenericItineraryImage(img)) {
      return this.pickImage(null, item.model || '', this.carImagePool);
    }
    return img || 'assets/images/cars/camry.png';
  }

  /** Prefer API/Unsplash photos; remap the shared demo placeholder per activity. */
  getActivityImageUrl(item: { title?: string; location?: string; image?: string; id?: string }): string {
    const img = item.image || '';
    if (this.isExternalImage(img) && !this.isGenericItineraryImage(img)) return img;
    if (img && !this.isGenericItineraryImage(img)) return img;
    return this.pickImage(
      undefined,
      `${item.id || ''}-${item.title || 'activity'}-${item.location || ''}`,
      this.activityImagePool,
    );
  }

  getFlightLogoUrl(item: DetailFlight): string | undefined {
    return airlineLogoAsset(item.carrier);
  }

  getAirlineIataCode(carrier: string): string {
    return airlineIataCode(carrier || '');
  }

  getTrainImageUrl(item: DetailTrain): string {
    const img = item.imageUrl || '';
    if (this.isExternalImage(img)) return img;

    const carrier = (item.carrier || '').toLowerCase();
    if (carrier.includes('tgv')) return 'assets/images/trains/tgv.png';
    if (carrier.includes('ave') || carrier.includes('renfe')) return 'assets/images/trains/ave.png';
    if (carrier.includes('ouigo')) return 'assets/images/trains/ouigo.png';

    // Fallback if the image URL is a package or landing image (which are city highlights)
    if (this.isGenericItineraryImage(img)) {
      return this.pickImage(null, item.carrier || '', this.trainImagePool);
    }
    return img || 'assets/images/trains/tgv.png';
  }

  getBusImageUrl(item: DetailBus): string {
    const img = item.imageUrl || '';
    if (this.isExternalImage(img)) return img;

    const carrier = (item.carrier || '').toLowerCase();
    for (const kw of Object.keys(this.busKeywordLogos)) {
      if (carrier.includes(kw)) {
        return this.busKeywordLogos[kw];
      }
    }

    // Fallback if the image URL is a package or landing image (which are city highlights)
    if (this.isGenericItineraryImage(img)) {
      return this.pickImage(null, item.carrier || '', this.busImagePool);
    }
    return img || 'assets/images/buses/flixbus.png';
  }

  onItemDropped(event: CdkDragDrop<{ day: number; items: DetailItem[] }>): void {
    if (event.previousContainer === event.container) {
      if (event.previousIndex === event.currentIndex) {
        return;
      }

      const { day, items } = event.container.data;
      const currentKeys = items.map(item => this.getItemKey(item));
      const itemKey = this.getItemKey(items[event.previousIndex]);

      this.customItemOrder.update(prev => {
        const next = { ...prev };
        const dayOrder = next[day] ? [...next[day]] : currentKeys;
        const sIdx = dayOrder.indexOf(itemKey);
        if (sIdx !== -1) {
          dayOrder.splice(sIdx, 1);
        }
        dayOrder.splice(event.currentIndex, 0, itemKey);
        next[day] = dayOrder;
        return next;
      });

      void (async () => {
        try {
          await this.enqueueTransferPlan(day, { silent: true });
        } finally {
          await this.syncCustomizationsToBackend();
        }
      })();
    } else {
      // Drag and drop between different days
      const sourceDay = event.previousContainer.data.day;
      const targetDay = event.container.data.day;
      const sourceItems = event.previousContainer.data.items;
      const targetItems = event.container.data.items;

      const itemToMove = sourceItems[event.previousIndex];
      const itemKey = this.getItemKey(itemToMove);

      const sourceKeys = sourceItems.map(item => this.getItemKey(item));
      const targetKeys = targetItems.map(item => this.getItemKey(item));

      // 1. Update addedActivities or addedTransport if it was a user-added item
      let isAdded = false;
      
      this.addedActivities.update(prev => {
        const idx = prev.findIndex(a => a.dayDay === sourceDay && this.getItemKey(this.toDetailActivity(a.activity)) === itemKey);
        if (idx !== -1) {
          isAdded = true;
          const next = [...prev];
          next[idx] = { ...next[idx], dayDay: targetDay };
          return next;
        }
        return prev;
      });

      if (!isAdded) {
        this.addedTransport.update(prev => {
          const idx = prev.findIndex(t => t.dayDay === sourceDay && this.getItemKey(t.item) === itemKey);
          if (idx !== -1) {
            isAdded = true;
            const next = [...prev];
            next[idx] = { ...next[idx], dayDay: targetDay };
            return next;
          }
          return prev;
        });
      }

      // 2. Update original segment in trip segments if it was not user-added
      if (!isAdded && this.trip && this.trip.segments) {
        const segment = this.trip.segments.find(s => {
          const segmentItem = s as unknown as DetailItem;
          if (s.id && (itemToMove as any).id) return s.id === (itemToMove as any).id;
          return this.getItemKey(segmentItem) === itemKey;
        });

        if (segment) {
          // Swap overrides are keyed by getItemKey (stable id), not day-index.
          // Keep the same key; only the segment day changes.
          segment.day = targetDay;
          this.trip.segments = [...this.trip.segments];
        }
      }

      // 3. Update ordering keys for both days
      this.customItemOrder.update(prev => {
        const next = { ...prev };
        
        const sourceOrder = next[sourceDay] ? [...next[sourceDay]] : sourceKeys;
        const targetOrder = next[targetDay] ? [...next[targetDay]] : targetKeys;

        const sIdx = sourceOrder.indexOf(itemKey);
        if (sIdx !== -1) {
          sourceOrder.splice(sIdx, 1);
        }
        next[sourceDay] = sourceOrder;

        const tIdx = targetOrder.indexOf(itemKey);
        if (tIdx !== -1) {
          targetOrder.splice(tIdx, 1);
        }
        targetOrder.splice(event.currentIndex, 0, itemKey);
        next[targetDay] = targetOrder;

        return next;
      });

      void (async () => {
        try {
          await this.enqueueTransferPlan(sourceDay, { silent: true });
          await this.enqueueTransferPlan(targetDay, { silent: true });
        } finally {
          await this.syncCustomizationsToBackend();
        }
      })();
    }
  }

  private migrateSwapOverride(oldKey: string, newKey: string, type: string): void {
    if (type === 'flight' && this.swappedFlights()[oldKey]) {
      const val = this.swappedFlights()[oldKey];
      this.swappedFlights.update(prev => {
        const next = { ...prev };
        delete next[oldKey];
        next[newKey] = val;
        return next;
      });
    } else if (type === 'hotel' && this.swappedHotels()[oldKey]) {
      const val = this.swappedHotels()[oldKey];
      this.swappedHotels.update(prev => {
        const next = { ...prev };
        delete next[oldKey];
        next[newKey] = val;
        return next;
      });
    } else if (type === 'car' && this.swappedCars()[oldKey]) {
      const val = this.swappedCars()[oldKey];
      this.swappedCars.update(prev => {
        const next = { ...prev };
        delete next[oldKey];
        next[newKey] = val;
        return next;
      });
    } else if (type === 'activity' && this.swappedActivities()[oldKey]) {
      const val = this.swappedActivities()[oldKey];
      this.swappedActivities.update(prev => {
        const next = { ...prev };
        delete next[oldKey];
        next[newKey] = val;
        return next;
      });
    } else if (type === 'train' && this.swappedTrains()[oldKey]) {
      const val = this.swappedTrains()[oldKey];
      this.swappedTrains.update(prev => {
        const next = { ...prev };
        delete next[oldKey];
        next[newKey] = val;
        return next;
      });
    } else if (type === 'bus' && this.swappedBuses()[oldKey]) {
      const val = this.swappedBuses()[oldKey];
      this.swappedBuses.update(prev => {
        const next = { ...prev };
        delete next[oldKey];
        next[newKey] = val;
        return next;
      });
    }
  }
}
