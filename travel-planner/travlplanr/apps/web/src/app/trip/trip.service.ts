import { Injectable, signal, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { apiUrl } from '../shared/utils/api-url';

export interface TripDay {
  day: number;
  title: string;
  activities: string[];
}

export interface TripCityDay {
  city: string;
  nights: number;
}

export interface DetailFlight {
  id?: string;
  day?: number;
  type: 'flight';
  carrier: string;
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
  status: string;
  price?: number;
}

export type CarRentalRole = 'single' | 'pickup' | 'active' | 'return';

export interface DetailCar {
  id?: string;
  day?: number;
  type: 'car';
  model: string;
  category: string;
  location: string;
  dates: string;
  passengers: number;
  gearbox: string;
  bags: number;
  fuel: string;
  imageUrl?: string;
  deepLink?: string;
  provider?: string;
  price?: number;
  currency?: string;
  duration?: string;
  durationMinutes?: number;
  distanceKm?: number;
  fromLocation?: string;
  toLocation?: string;
  bookable?: boolean;
  partnerMetadata?: Record<string, unknown>;
  autoInserted?: boolean;
  /** Shared id when the same rental spans multiple itinerary days. */
  rentalId?: string;
  /** Total calendar days the vehicle is held (inclusive). */
  rentalDays?: number;
  pickupDay?: number;
  returnDay?: number;
  /** Position of this day card within a multi-day rental. */
  rentalRole?: CarRentalRole;
}

export interface DetailHotel {
  id?: string;
  day?: number;
  type: 'hotel';
  name: string;
  rating: number;
  location: string;
  dates: string;
  amenities: string[];
  distance?: string;
  maxGuests?: number;
  roomType?: string;
  bedPreference?: string;
  cancellation?: string;
  parking?: string;
  price?: number;
  taxes?: number;
  imageUrl?: string;
  deepLink?: string;
  provider?: string;
  stars?: number;
  reviewCount?: number;
  bookable?: boolean;
  partnerMetadata?: Record<string, unknown>;
}

export interface DetailActivity {
  id?: string;
  day?: number;
  type: 'activity';
  time: string;
  title: string;
  rating: number;
  location: string;
  refundable: string;
  image: string;
  price?: number;
  duration?: string;
  distance?: string;
  attractionType?: string;
  deepLink?: string;
  provider?: string;
  lat?: number;
  lng?: number;
  placeId?: string;
  /** Drive time from the previous same-day stop (Google Routes). */
  travelMinutes?: number;
  travelDuration?: string;
  travelDistanceKm?: number;
  travelFrom?: string;
  contentOnly?: boolean;
  meal?: string;
  bookable?: boolean;
  partnerMetadata?: Record<string, unknown>;
  autoInserted?: boolean;
}

export interface DetailTrain {
  id?: string;
  day?: number;
  type: 'train';
  carrier: string;
  route: string;
  depDate: string;
  depTime: string;
  depLocation: string;
  arrDate: string;
  arrTime: string;
  arrLocation: string;
  duration: string;
  stops: string;
  cost?: string;
  price?: number;
  imageUrl?: string;
  bookable?: boolean;
  partnerMetadata?: Record<string, unknown>;
}

export interface DetailBus {
  id?: string;
  day?: number;
  type: 'bus';
  carrier: string;
  route: string;
  depDate: string;
  depTime: string;
  depLocation: string;
  arrDate: string;
  arrTime: string;
  arrLocation: string;
  duration: string;
  stops: string;
  cost?: string;
  price?: number;
  imageUrl?: string;
}

export type TripSegment = DetailFlight | DetailHotel | DetailCar | DetailActivity | DetailTrain | DetailBus;

export interface TripVersionSummary {
  id: string;
  versionNumber: number;
  reason: string | null;
  title: string | null;
  segmentCount: number;
  createdAt: string;
}

export interface SavedTrip {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  travelStyle?: string;
  travelMethod?: string;
  budget?: string;
  interests?: string[];
  foodPreferences?: string[];
  status: 'draft' | 'generating' | 'ready' | 'pending' | 'booked' | 'cancelled' | 'created' | 'failed';
  image: string;
  days: TripDay[];
  cityDays?: TripCityDay[];
  segments?: TripSegment[];
  customizations?: any;
  coverageTier?: 'full' | 'draft';
  createdAt: string;
  is_confirmed?: boolean;
}

export { isListedInMyTrips } from './trip-listing.util';

@Injectable({ providedIn: 'root' })
export class TripService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);
  private readonly tripsSignal = signal<SavedTrip[]>([]);
  private readonly loadingSignal = signal<boolean>(true);
  private readonly loadErrorSignal = signal<string | null>(null);
  // Surfaced when a single-trip fetch (getTripFromBackend) fails, so the
  // itinerary page can distinguish a network error from a genuine 404.
  private readonly tripLoadErrorSignal = signal<string | null>(null);
  // Surfaced when an inventory search genuinely FAILS (network/server), as
  // opposed to succeeding with zero results. The itinerary swap views read this.
  private readonly inventoryErrorSignal = signal<string | null>(null);

  readonly trips = this.tripsSignal.asReadonly();
  readonly isLoading = this.loadingSignal.asReadonly();
  readonly loadError = this.loadErrorSignal.asReadonly();
  readonly tripLoadError = this.tripLoadErrorSignal.asReadonly();
  readonly inventoryError = this.inventoryErrorSignal.asReadonly();

  constructor() {
    // This effect reacts to auth changes and updates loading/trips signals, so it
    // must opt into signal writes (Angular forbids them in effects by default).
    effect(() => {
      const user = this.auth.user();
      if (user) {
        this.refreshTrips();
      } else {
        this.tripsSignal.set([]);
        this.loadingSignal.set(false);
        this.loadErrorSignal.set(null);
      }
    }, { allowSignalWrites: true });
  }

  /** Load (or retry loading) the customer's trips; surfaces failures via loadError. */
  refreshTrips(): void {
    this.loadingSignal.set(true);
    this.loadErrorSignal.set(null);
    this.loadTrips()
      .then((trips) => {
        this.tripsSignal.set(trips);
        this.loadingSignal.set(false);
      })
      .catch((e) => {
        console.error('Failed to load trips from API', e);
        this.tripsSignal.set([]);
        this.loadErrorSignal.set(this.translate.instant('TRIPS.LOAD_TRIPS_ERROR'));
        this.loadingSignal.set(false);
      });
  }

  getTrip(id: string): SavedTrip | undefined {
    return this.tripsSignal().find((t) => t.id === id);
  }


  async createFromWizard(input: {
    destinations: string[];
    startDate: string;
    endDate: string;
    aiDates?: boolean;
    cityDays?: { city: string; nights: number }[];
    travelers: number;
    travelStyle: string;
    travelMethod: string;
    budget: string;
    interests: string[];
    foodPreferences: string[];
    departureLocation?: string;
    arrivalLocation?: string;
    coverageTier?: 'full' | 'draft';
  }): Promise<string> {
    let start = input.startDate;
    let end = input.endDate;

    if (input.aiDates) {
      const now = new Date();
      start = now.toISOString().split('T')[0];
      const future = new Date(now);
      const totalNights = input.cityDays?.reduce((acc, curr) => acc + curr.nights, 0) || 6;
      future.setDate(now.getDate() + totalNights);
      end = future.toISOString().split('T')[0];
    }
    
    const payload = {
      ...input,
      startDate: start,
      endDate: end,
    };

    const res: any = await firstValueFrom(this.http.post(apiUrl('/trips'), payload));
    // Keep the in-memory trips list current so anything reading `trips()`
    // right after creation (e.g. the chat greeting's "last trip") sees it.
    this.refreshTrips();
    return res.id;
  }

  /**
   * Fetch a single trip. Returns undefined on failure (caller decides how to
   * render that), but also surfaces network/server failures via `tripLoadError`
   * so callers can distinguish a real failure from a genuine "not found".
   */
  async getTripFromBackend(id: string): Promise<SavedTrip | undefined> {
    this.tripLoadErrorSignal.set(null);
    try {
      const res: any = await firstValueFrom(this.http.get(apiUrl(`/trips/${id}`)));
      return res as SavedTrip;
    } catch (e: any) {
      console.error('Failed to get trip from backend', e);
      // A 404 means the trip genuinely doesn't exist — leave the error signal
      // clear so the caller shows its "not found" state. Any other failure is a
      // load error worth surfacing with a retry.
      if (e?.status !== 404) {
        this.tripLoadErrorSignal.set(this.translate.instant('TRIPS.LOAD_ITINERARY_ERROR'));
      }
      return undefined;
    }
  }

  /** Snapshots taken before each AI regen/rebuild — see services/planner TripVersion. */
  async getTripVersions(id: string): Promise<TripVersionSummary[]> {
    try {
      const res: any = await firstValueFrom(this.http.get(apiUrl(`/trips/${id}/versions`)));
      return res as TripVersionSummary[];
    } catch (e) {
      console.error('Failed to load trip versions', e);
      return [];
    }
  }

  /**
   * Roll the trip back to a previously saved version. The backend snapshots
   * the trip's current state first (reason "pre_restore"), so this itself is undoable.
   * Returns the reloaded trip on success, or undefined on failure.
   */
  async restoreTripVersion(tripId: string, versionId: string): Promise<SavedTrip | undefined> {
    try {
      await firstValueFrom(this.http.post(apiUrl(`/trips/${tripId}/versions/${versionId}/restore`), {}));
      return await this.getTripFromBackend(tripId);
    } catch (e) {
      console.error('Failed to restore trip version', e);
      return undefined;
    }
  }

  async deleteTrip(id: string): Promise<void> {
    try {
      await firstValueFrom(this.http.delete(apiUrl(`/trips/${id}`)));
      const updated = this.tripsSignal().filter((t) => t.id !== id);
      this.tripsSignal.set(updated);
    } catch (err) {
      console.error('Failed to delete trip from backend', err);
      throw err;
    }
  }

  async rebuildTrip(id: string): Promise<SavedTrip | undefined> {
    try {
      await firstValueFrom(this.http.post(apiUrl(`/trips/${id}/rebuild`), {}));
      return this.getTripFromBackend(id);
    } catch (e) {
      console.error('Failed to rebuild trip itinerary', e);
      return undefined;
    }
  }

  async regenerateTrip(id: string, day?: number, style?: string, route?: { departureLocation?: string; arrivalLocation?: string }): Promise<SavedTrip | undefined> {
    const result = await firstValueFrom(
      this.http.post<{
        id: string;
        status: string;
        regenerating?: boolean;
        routeUpdated?: boolean;
      }>(apiUrl(`/trips/${id}/regenerate`), {
        day: day ?? null,
        style: style ?? null,
        departureLocation: route?.departureLocation ?? null,
        arrivalLocation: route?.arrivalLocation ?? null,
      }),
    );
    // Surgical route corrections return ready immediately — reload now.
    if (result?.routeUpdated || result?.regenerating === false) {
      return this.getTripFromBackend(id);
    }
    return this.waitForTripReady(id);
  }

  /** Poll until a newly created trip has segments ready (or timeout). */
  async waitForTripReady(tripId: string, timeoutMs = 120_000): Promise<SavedTrip | undefined> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const trip = await this.getTripFromBackend(tripId);
      if (trip?.status === 'ready' && (trip.segments?.length ?? 0) > 0) {
        return trip;
      }
      if (trip?.status === 'failed') {
        const rebuilt = await this.rebuildTrip(tripId);
        if (rebuilt && (rebuilt.segments?.length ?? 0) > 0) {
          return rebuilt;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return this.getTripFromBackend(tripId);
  }

  async searchInventory(params: {
    type: string;
    location?: string;
    dep?: string;
    arr?: string;
    date?: string;
    budget?: string;
  }): Promise<any[]> {
    // Clear any prior error so the swap views start from a clean state.
    this.inventoryErrorSignal.set(null);
    const budget = this.normalizeInventoryBudget(params.budget);
    const attempts = [
      { ...params, budget },
      { ...params, budget: 'standard' },
    ];

    try {
      for (const attempt of attempts) {
        const results = await this.fetchInventorySearch(attempt);
        if (results.length > 0) {
          return results;
        }
      }
      // Fallback to mock inventory matching the requested budget tier if search returns nothing.
      // Tagged (not a silent success) since these are fabricated placeholder results, not real
      // bookable inventory — callers/UI can key off `provider === 'mock'` / `bookable === false`.
      console.warn(`Inventory search for "${params.type}" returned no real results — showing mock fallback data`);
      return this.tagAsMockInventory(this.getMockInventoryFallback(params.type, budget, params));
    } catch (e) {
      console.error('Failed to search inventory', e);
      console.warn(`Inventory search for "${params.type}" failed — showing mock fallback data`);
      // Fallback to mock inventory matching the requested budget tier on actual error.
      return this.tagAsMockInventory(this.getMockInventoryFallback(params.type, budget, params));
    }
  }

  private tagAsMockInventory(items: any[]): any[] {
    return items.map((item) => ({ ...item, provider: 'mock', bookable: false }));
  }

  private getMockInventoryFallback(type: string, budget: string, params: any): any[] {
    const isPremium = budget === 'premium';
    const isEconomy = budget === 'economy';
    const priceMultiplier = isPremium ? 1.5 : isEconomy ? 0.7 : 1.0;

    if (type === 'flight') {
      const depCode = params.dep || 'MAA';
      const arrCode = params.arr || 'CDG';
      return [
        {
          id: `mock-flight-1-${budget}`,
          carrier: isPremium ? 'Emirates' : isEconomy ? 'IndiGo' : 'Air India',
          airlineCode: isPremium ? 'EK' : isEconomy ? '6E' : 'AI',
          flightNo: isPremium ? 'EK543' : isEconomy ? '6E202' : 'AI143',
          class: isPremium ? 'Business Class' : 'Economy Class',
          refundable: 'Refundable with fee',
          depDate: params.date || 'Tomorrow',
          depTime: '08:30 AM',
          depCode,
          arrDate: params.date || 'Tomorrow',
          arrTime: '03:15 PM',
          arrCode,
          duration: '6h 45m',
          stops: 'Direct',
          price: Math.round(45000 * priceMultiplier),
          emission: 'Typical emissions',
        },
        {
          id: `mock-flight-2-${budget}`,
          carrier: isPremium ? 'Qatar Airways' : isEconomy ? 'SpiceJet' : 'Lufthansa',
          airlineCode: isPremium ? 'QR' : isEconomy ? 'SG' : 'LH',
          flightNo: isPremium ? 'QR529' : isEconomy ? 'SG889' : 'LH756',
          class: isPremium ? 'First Class' : 'Economy Class',
          refundable: 'Fully Refundable',
          depDate: params.date || 'Tomorrow',
          depTime: '11:45 AM',
          depCode,
          arrDate: params.date || 'Tomorrow',
          arrTime: '09:30 PM',
          arrCode,
          duration: '9h 45m',
          stops: '1 Stop',
          price: Math.round(58000 * priceMultiplier),
          emission: '12% fewer emissions',
        }
      ];
    }

    if (type === 'hotel') {
      const city = params.location || 'Paris';
      return [
        {
          id: `mock-hotel-1-${budget}`,
          name: isPremium ? 'Grand Palace & Spa Resort' : isEconomy ? 'Budget Inn Express' : 'Regent Central Hotel',
          rating: isPremium ? 4.9 : isEconomy ? 3.8 : 4.3,
          location: city,
          city,
          distance: '0.8 km from center',
          maxGuests: 2,
          roomType: isPremium ? 'Presidential Suite' : 'Standard Room',
          bedPreference: 'Double Bed',
          cancellation: 'Free Cancellation',
          parking: 'Free Parking',
          price: Math.round(12000 * priceMultiplier),
          taxes: Math.round(1800 * priceMultiplier),
          imageUrl: 'assets/images/packages/rec_swiss.png',
          amenities: ['Free WiFi', 'Pool', 'Gym', 'Breakfast Included'],
        },
        {
          id: `mock-hotel-2-${budget}`,
          name: isPremium ? 'Royal Boutique Hotel' : isEconomy ? 'City Center Hostel' : 'City Plaza Business Hotel',
          rating: isPremium ? 4.7 : isEconomy ? 3.5 : 4.1,
          location: city,
          city,
          distance: '1.5 km from center',
          maxGuests: 2,
          roomType: isPremium ? 'Deluxe Room' : 'Compact Double Room',
          bedPreference: 'Queen Bed',
          cancellation: 'Non-Refundable',
          parking: 'Valet Parking',
          price: Math.round(8500 * priceMultiplier),
          taxes: Math.round(1200 * priceMultiplier),
          imageUrl: 'assets/images/packages/rec_swiss.png',
          amenities: ['Free WiFi', 'Air Conditioning', 'Bar'],
        }
      ];
    }

    if (type === 'car') {
      const location = params.location || 'Paris';
      return [
        {
          id: `mock-car-1-${budget}`,
          model: isPremium ? 'Tesla Model S' : isEconomy ? 'Hyundai i10' : 'Toyota Corolla',
          category: isPremium ? 'Premium Electric' : isEconomy ? 'Economy Hatchback' : 'Standard Sedan',
          location,
          passengers: isPremium ? 5 : isEconomy ? 4 : 5,
          gearbox: isPremium ? 'Automatic' : isEconomy ? 'Manual' : 'Automatic',
          bags: isPremium ? 3 : isEconomy ? 1 : 2,
          fuel: isPremium ? 'Electric' : 'Petrol',
          mileage: 'Unlimited',
          security: Math.round(15000 * priceMultiplier),
          supplier: 'Hertz',
          price: Math.round(3500 * priceMultiplier),
          imageUrl: 'assets/images/packages/rec_swiss.png',
        },
        {
          id: `mock-car-2-${budget}`,
          model: isPremium ? 'Range Rover Sport' : isEconomy ? 'Maruti Swift' : 'Hyundai Creta',
          category: isPremium ? 'Luxury SUV' : isEconomy ? 'Compact Hatchback' : 'Compact SUV',
          location,
          passengers: isPremium ? 7 : isEconomy ? 4 : 5,
          gearbox: 'Automatic',
          bags: isPremium ? 5 : isEconomy ? 2 : 3,
          fuel: 'Diesel',
          mileage: 'Unlimited',
          security: Math.round(25000 * priceMultiplier),
          supplier: 'Avis',
          price: Math.round(5000 * priceMultiplier),
          imageUrl: 'assets/images/packages/rec_swiss.png',
        }
      ];
    }

    if (type === 'train') {
      const depLocation = params.dep || 'Paris';
      const arrLocation = params.arr || 'Brussels';
      return [
        {
          id: `mock-train-1-${budget}`,
          carrier: isPremium ? 'Eurostar Business' : 'TGV Lyria',
          depDate: params.date || 'Tomorrow',
          depTime: '09:00 AM',
          depLocation,
          arrDate: params.date || 'Tomorrow',
          arrTime: '10:30 AM',
          arrLocation,
          duration: '1h 30m',
          stops: 'Direct',
          class: isPremium ? 'First Class' : 'Standard Class',
          refundable: 'Fully Refundable',
          price: Math.round(3200 * priceMultiplier),
        },
        {
          id: `mock-train-2-${budget}`,
          carrier: 'ICE Express',
          depDate: params.date || 'Tomorrow',
          depTime: '01:15 PM',
          depLocation,
          arrDate: params.date || 'Tomorrow',
          arrTime: '03:00 PM',
          arrLocation,
          duration: '1h 45m',
          stops: 'Direct',
          class: 'Standard Class',
          refundable: 'Non-Refundable',
          price: Math.round(2100 * priceMultiplier),
        }
      ];
    }

    if (type === 'bus') {
      const depLocation = params.dep || 'Paris';
      const arrLocation = params.arr || 'Brussels';
      return [
        {
          id: `mock-bus-1-${budget}`,
          carrier: 'FlixBus Premium',
          depDate: params.date || 'Tomorrow',
          depTime: '07:30 AM',
          depLocation,
          arrDate: params.date || 'Tomorrow',
          arrTime: '12:00 PM',
          arrLocation,
          duration: '4h 30m',
          stops: 'Direct',
          class: 'Premium Seat',
          seatType: 'Window / Aisle',
          operator: 'FlixBus',
          rating: '4.2',
          refundable: 'Refundable with fee',
          price: Math.round(1500 * priceMultiplier),
        },
        {
          id: `mock-bus-2-${budget}`,
          carrier: 'BlaBlaCar Bus',
          depDate: params.date || 'Tomorrow',
          depTime: '10:45 AM',
          depLocation,
          arrDate: params.date || 'Tomorrow',
          arrTime: '03:30 PM',
          arrLocation,
          duration: '4h 45m',
          stops: 'Direct',
          class: 'Standard Seat',
          seatType: 'Window',
          operator: 'BlaBlaCar',
          rating: '3.9',
          refundable: 'Non-Refundable',
          price: Math.round(950 * priceMultiplier),
        }
      ];
    }

    if (type === 'activity') {
      const city = params.location || 'Paris';
      return [
        {
          id: `mock-activity-1-${budget}`,
          title: isPremium ? 'Private VIP Guided Museum Tour' : 'General Admission Entry Ticket',
          time: '10:00 AM',
          rating: 4.8,
          location: city,
          refundable: 'Refundable up to 24h',
          image: 'assets/images/packages/rec_swiss.png',
          price: Math.round(2500 * priceMultiplier),
        },
        {
          id: `mock-activity-2-${budget}`,
          title: isPremium ? 'Luxury Private Yacht Sunset Cruise' : 'Group Walking Tour with Local Guide',
          time: '04:30 PM',
          rating: 4.6,
          location: city,
          refundable: 'Non-Refundable',
          image: 'assets/images/packages/rec_swiss.png',
          price: Math.round(4500 * priceMultiplier),
        }
      ];
    }

    if (type === 'event') {
      const city = params.location || 'Paris';
      return [
        {
          id: `mock-event-1-${budget}`,
          title: isPremium ? `${city} Championship Finals` : `${city} Live Concert Night`,
          price: Math.round(8500 * priceMultiplier),
          currency: 'USD',
          image_url: 'assets/images/packages/rec_swiss.png',
          details: {
            location: `${city} Arena`,
            venue: `${city} Arena`,
            category: 'Live Event',
            bookable: true,
            event_date: params.date,
          },
        },
        {
          id: `mock-event-2-${budget}`,
          title: isPremium ? `${city} Opera Gala` : `${city} Street Festival Pass`,
          price: Math.round(4200 * priceMultiplier),
          currency: 'USD',
          image_url: 'assets/images/packages/rec_swiss.png',
          details: {
            location: `${city} Center`,
            venue: `${city} Center`,
            category: 'Culture',
            bookable: true,
            event_date: params.date,
          },
        },
      ];
    }

    if (type === 'cruise') {
      const city = params.location || 'Dubai';
      return [
        {
          id: `mock-cruise-1-${budget}`,
          title: isPremium ? `${city} Luxury 4-Night Cruise` : `${city} Coastal 3-Night Cruise`,
          price: Math.round(28000 * priceMultiplier),
          currency: 'USD',
          duration: isPremium ? '4 night(s)' : '3 night(s)',
          image_url: 'assets/images/packages/rec_swiss.png',
          details: {
            location: city,
            city,
            category: 'Cruise',
            bookable: true,
          },
        },
        {
          id: `mock-cruise-2-${budget}`,
          title: isPremium ? `${city} Private Yacht Week` : `${city} Weekend Island Hop`,
          price: Math.round(18000 * priceMultiplier),
          currency: 'USD',
          duration: isPremium ? '7 night(s)' : '2 night(s)',
          image_url: 'assets/images/packages/rec_swiss.png',
          details: {
            location: city,
            city,
            category: 'Cruise',
            bookable: true,
          },
        },
      ];
    }

    if (type === 'holiday') {
      const city = params.location || 'Paris';
      return [
        {
          id: `mock-holiday-1-${budget}`,
          title: isPremium ? `${city} Signature Escape` : `${city} Classic Getaway`,
          price: Math.round(65000 * priceMultiplier),
          currency: 'USD',
          duration: '5 days / 4 nights',
          image_url: 'assets/images/packages/rec_swiss.png',
          details: {
            location: city,
            country: city,
            travel_style: 'Leisure',
            category: 'Holiday',
            bookable: true,
          },
        },
        {
          id: `mock-holiday-2-${budget}`,
          title: isPremium ? `${city} Luxury Circuit` : `${city} Highlights Tour`,
          price: Math.round(48000 * priceMultiplier),
          currency: 'USD',
          duration: '7 days / 6 nights',
          image_url: 'assets/images/packages/rec_swiss.png',
          details: {
            location: city,
            country: city,
            travel_style: 'Culture',
            category: 'Holiday',
            bookable: true,
          },
        },
      ];
    }

    if (type === 'transfer') {
      const from = params.dep || params.location || 'Airport';
      const to = params.arr || params.location || 'City Center';
      return [
        {
          id: `mock-transfer-1-${budget}`,
          title: isPremium ? 'Private Luxury Sedan Transfer' : 'Shared Shuttle Transfer',
          price: Math.round(4500 * priceMultiplier),
          currency: 'USD',
          duration: '45m',
          image_url: 'assets/images/packages/rec_swiss.png',
          details: {
            from,
            to,
            location: `${from} → ${to}`,
            vehicle_class: isPremium ? 'Luxury' : 'Standard',
            passengers: isPremium ? 3 : 8,
            bags: isPremium ? 3 : 6,
            product_id: `mock-transfer-1-${budget}`,
            bookable: true,
          },
        },
        {
          id: `mock-transfer-2-${budget}`,
          title: isPremium ? 'Private Van Transfer' : 'Economy Car Transfer',
          price: Math.round(3200 * priceMultiplier),
          currency: 'USD',
          duration: '50m',
          image_url: 'assets/images/packages/rec_swiss.png',
          details: {
            from,
            to,
            location: `${from} → ${to}`,
            vehicle_class: isPremium ? 'Van' : 'Economy',
            passengers: isPremium ? 6 : 3,
            bags: isPremium ? 6 : 2,
            product_id: `mock-transfer-2-${budget}`,
            bookable: true,
          },
        },
      ];
    }

    return [];
  }

  private normalizeInventoryBudget(budget?: string): string {
    if (!budget) return 'standard';
    const key = budget.toLowerCase();
    if (key.includes('premium') || key.includes('luxury')) return 'premium';
    if (key.includes('budget') || key.includes('economy')) return 'economy';
    return 'standard';
  }

  private async fetchInventorySearch(params: {
    type: string;
    location?: string;
    dep?: string;
    arr?: string;
    date?: string;
    budget?: string;
  }): Promise<any[]> {
    let query = `?type=${params.type}`;
    if (params.location) query += `&location=${encodeURIComponent(params.location)}`;
    if (params.dep) query += `&dep=${encodeURIComponent(params.dep)}`;
    if (params.arr) query += `&arr=${encodeURIComponent(params.arr)}`;
    if (params.date) query += `&date=${encodeURIComponent(params.date)}`;
    if (params.budget) query += `&budget=${encodeURIComponent(params.budget)}`;

    // Let failures propagate to searchInventory(), which decides whether this
    // is a genuine empty result or an actual error worth surfacing.
    const res: any = await firstValueFrom(this.http.get(apiUrl(`/inventory/search${query}`)));
    return Array.isArray(res) ? res : [];
  }

  async saveTrip(trip: SavedTrip): Promise<void> {
    try {
      if (trip.id) {
        // Planner TripUpdateBody uses extra=forbid — only send allowed fields.
        // Sending the full SavedTrip (id, destination, status, …) causes 422,
        // which rolls back optimistic itinerary edits (e.g. added activities).
        const body: Record<string, unknown> = {
          title: trip.title,
          days: trip.days,
          cityDays: trip.cityDays,
          segments: trip.segments,
          customizations: trip.customizations,
        };
        await firstValueFrom(this.http.put(apiUrl(`/trips/${trip.id}`), body));
      }
      const trips = this.tripsSignal();
      const existingIndex = trips.findIndex((t) => t.id === trip.id);
      const updated = existingIndex >= 0
        ? trips.map((t, i) => (i === existingIndex ? trip : t))
        : [trip, ...trips];
      this.tripsSignal.set(updated);
    } catch (err) {
      console.error('Failed to save trip to backend', err);
      throw err;
    }
  }

  private async loadTrips(): Promise<SavedTrip[]> {
    const res: any = await firstValueFrom(this.http.get(apiUrl('/trips')));
    if (res && res.items) {
      return res.items as SavedTrip[];
    }
    return [];
  }
}
