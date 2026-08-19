import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { apiUrl } from '../shared/utils/api-url';
import { GeocodingService } from '../shared/utils/geocoding.service';
import { TransferService } from '../transfers/transfer.service';
import {
  TripService,
  DetailCar,
  DetailHotel,
  DetailActivity,
  DetailFlight,
  DetailTrain,
  DetailBus,
  TripSegment,
} from '../trip/trip.service';

export interface TransferStop {
  label: string;
  lat?: number | null;
  lng?: number | null;
  placeId?: string | null;
}

export interface TransferLegPlan {
  from: TransferStop;
  to: TransferStop;
  duration: string;
  durationMinutes: number;
  distanceKm: number | null;
  price: number;
  currency: string;
  model: string;
  category: string;
  provider?: string;
  deepLink?: string;
  imageUrl?: string;
  source: 'transfer' | 'car' | 'route_estimate';
  bookable?: boolean;
  partnerMetadata?: Record<string, unknown>;
}

export interface DayTransferPlan {
  day: number;
  fromLabel: string;
  toLabel: string;
  legs: TransferLegPlan[];
  /** Best (cheapest live, else first) leg for one-click insert. */
  best: TransferLegPlan | null;
}

interface RouteComputeResponse {
  duration?: string;
  duration_seconds?: number;
  distance_km?: number;
  travel_mode?: string;
}

@Injectable({ providedIn: 'root' })
export class TransferPlanService {
  private readonly http = inject(HttpClient);
  private readonly geocoder = inject(GeocodingService);
  private readonly transfers = inject(TransferService);
  private readonly trips = inject(TripService);

  /** Build an A→B transfer plan with live duration + fare options. */
  async planLeg(
    from: TransferStop,
    to: TransferStop,
    opts: {
      day: number;
      dateIso?: string;
      travelers?: number;
      budget?: string;
      cityHint?: string;
    },
  ): Promise<DayTransferPlan> {
    const fromLabel = (from.label || opts.cityHint || 'Pickup').trim();
    const toLabel = (to.label || opts.cityHint || 'Drop-off').trim();
    const fallback = this.buildFallbackPlan(opts.day, fromLabel, toLabel, from, to);

    // Cap the whole plan so swap UI never spins forever on geocode/route hangs.
    return this.withTimeout(this.planLegInner(from, to, opts), 8000, fallback);
  }

  private async planLegInner(
    from: TransferStop,
    to: TransferStop,
    opts: {
      day: number;
      dateIso?: string;
      travelers?: number;
      budget?: string;
      cityHint?: string;
    },
  ): Promise<DayTransferPlan> {
    const travelers = Math.max(1, opts.travelers || 2);
    const [resolvedFrom, resolvedTo] = await Promise.all([
      this.withTimeout(this.resolveStop(from, opts.cityHint), 5000, {
        ...from,
        label: (from.label || opts.cityHint || 'Pickup').trim(),
      }),
      this.withTimeout(this.resolveStop(to, opts.cityHint), 5000, {
        ...to,
        label: (to.label || opts.cityHint || 'Drop-off').trim(),
      }),
    ]);

    const route = await this.computeRoute(resolvedFrom, resolvedTo);
    const durationMinutes =
      route?.duration_seconds != null
        ? Math.max(1, Math.round(route.duration_seconds / 60))
        : 45;
    const duration =
      route?.duration ||
      (durationMinutes >= 60
        ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
        : `${durationMinutes}m`);
    const distanceKm =
      typeof route?.distance_km === 'number' ? route.distance_km : null;

    // Always seed a route estimate so callers can update the UI even when
    // live transfer/inventory APIs are slow or unavailable.
    const estimateLeg: TransferLegPlan = {
      from: resolvedFrom,
      to: resolvedTo,
      duration,
      durationMinutes,
      distanceKm,
      price: this.estimateFare(distanceKm, durationMinutes),
      currency: 'INR',
      model: 'Private transfer',
      category: 'Transfer',
      source: 'route_estimate',
    };
    const legs: TransferLegPlan[] = [estimateLeg];

    const fareDeadlineMs = 2500;
    const [transferLegs, inventoryLegs] = await Promise.all([
      this.withTimeout(
        this.searchTransferFares(
          resolvedFrom,
          resolvedTo,
          opts.dateIso,
          travelers,
          duration,
          durationMinutes,
          distanceKm,
        ).catch((err) => {
          console.warn('Transfer fare search failed', err);
          return [] as TransferLegPlan[];
        }),
        fareDeadlineMs,
        [] as TransferLegPlan[],
      ),
      this.withTimeout(
        this.loadInventoryCarLegs(
          resolvedFrom,
          resolvedTo,
          duration,
          durationMinutes,
          distanceKm,
          opts.budget || 'standard',
        ).catch((err) => {
          console.warn('Car inventory search failed', err);
          return [] as TransferLegPlan[];
        }),
        fareDeadlineMs,
        [] as TransferLegPlan[],
      ),
    ]);

    legs.push(...transferLegs, ...inventoryLegs);
    for (const leg of legs) {
      leg.price = this.roundFare(leg.price);
    }
    legs.sort((a, b) => a.price - b.price);
    return {
      day: opts.day,
      fromLabel: resolvedFrom.label,
      toLabel: resolvedTo.label,
      legs,
      best: legs[0] || estimateLeg,
    };
  }

  private buildFallbackPlan(
    day: number,
    fromLabel: string,
    toLabel: string,
    from: TransferStop,
    to: TransferStop,
  ): DayTransferPlan {
    const estimateLeg: TransferLegPlan = {
      from: { ...from, label: fromLabel },
      to: { ...to, label: toLabel },
      duration: '45m',
      durationMinutes: 45,
      distanceKm: null,
      price: this.estimateFare(null, 45),
      currency: 'INR',
      model: 'Private transfer',
      category: 'Transfer',
      source: 'route_estimate',
    };
    return {
      day,
      fromLabel,
      toLabel,
      legs: [estimateLeg],
      best: estimateLeg,
    };
  }

  private roundFare(price: number): number {
    const n = Number(price);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n);
  }

  private async loadInventoryCarLegs(
    from: TransferStop,
    to: TransferStop,
    duration: string,
    durationMinutes: number,
    distanceKm: number | null,
    budget: string,
  ): Promise<TransferLegPlan[]> {
    const cars = await this.trips.searchInventory({
      type: 'car',
      location: from.label.split(',')[0]?.trim() || from.label,
      budget,
    });
    return cars.slice(0, 6).map((r) => {
      const price = this.roundFare(
        typeof r.price === 'object' ? (r.price?.amount ?? 0) : (r.price ?? 0),
      );
      const details = r.details || {};
      const rawCategory = String(
        details['category'] || (details['categories'] || [])[0] || '',
      ).replace(/_/g, ' ');
      const title = String(r.title || 'Private transfer')
        .replace(/\s+in\s+.+$/i, '')
        .trim();
      const titleClass = title.match(/\b(Sedan|SUV|Hatchback|Van|MPV|Luxury)\b/i)?.[1];
      return {
        from,
        to,
        duration,
        durationMinutes,
        distanceKm,
        price: Number(price) || this.estimateFare(distanceKm, durationMinutes),
        currency: 'INR',
        model: title || 'Private transfer',
        category: titleClass || rawCategory || 'Transfer',
        provider: r.provider,
        deepLink: r.deep_link,
        imageUrl: r.image_url,
        source: 'car' as const,
        bookable: details['bookable'] === true,
        partnerMetadata: details,
      };
    });
  }

  private withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(fallback);
        }
      }, ms);
      promise.then(
        (value) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(value);
          }
        },
        () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(fallback);
          }
        },
      );
    });
  }

  /** Convert a planned leg into a day card car segment. */
  toDetailCar(leg: TransferLegPlan, dates: string, passengers: number): DetailCar {
    const distanceLabel =
      leg.distanceKm != null ? ` · ${leg.distanceKm.toFixed(1)} km` : '';
    return {
      id: `transfer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'car',
      model: leg.model,
      category: leg.category || 'Transfer',
      location: `${leg.from.label} → ${leg.to.label}`,
      dates: `${dates} · ${leg.duration}${distanceLabel}`,
      passengers,
      gearbox: 'Automatic',
      bags: Math.max(2, passengers),
      fuel: 'Included',
      price: leg.price,
      currency: leg.currency,
      provider: leg.provider,
      deepLink: leg.deepLink,
      imageUrl: leg.imageUrl,
      bookable: leg.bookable,
      partnerMetadata: leg.partnerMetadata,
      duration: leg.duration,
      durationMinutes: leg.durationMinutes,
      distanceKm: leg.distanceKm ?? undefined,
      fromLocation: leg.from.label,
      toLocation: leg.to.label,
      autoInserted: true,
    } as DetailCar;
  }

  /**
   * Pick adjacent stops on a day for a transfer: prefer activity→activity,
   * else hotel→activity, else city→city.
   */
  adjacentStopsForDay(
    items: Array<
      TripSegment | DetailCar | DetailHotel | DetailActivity | DetailFlight | DetailTrain | DetailBus
    >,
    cityFallback: string,
  ): { from: TransferStop; to: TransferStop } | null {
    const stops: TransferStop[] = [];
    for (const item of items) {
      const stop = this.asPlaceStop(item, cityFallback);
      if (stop) stops.push(stop);
    }
    if (stops.length >= 2) {
      return { from: stops[stops.length - 2], to: stops[stops.length - 1] };
    }
    if (stops.length === 1) {
      return {
        from: stops[0],
        to: { label: cityFallback },
      };
    }
    return null;
  }

  /**
   * Stops immediately before/after a timeline item (e.g. the car being swapped).
   * Falls back to day-level adjacent stops when either side is missing.
   */
  adjacentStopsAroundIndex(
    items: Array<
      TripSegment | DetailCar | DetailHotel | DetailActivity | DetailFlight | DetailTrain | DetailBus
    >,
    index: number,
    cityFallback: string,
  ): { from: TransferStop; to: TransferStop } | null {
    let from: TransferStop | null = null;
    let to: TransferStop | null = null;
    for (let i = index - 1; i >= 0; i--) {
      const stop = this.asPlaceStop(items[i], cityFallback);
      if (stop) {
        from = stop;
        break;
      }
    }
    for (let i = index + 1; i < items.length; i++) {
      const stop = this.asPlaceStop(items[i], cityFallback);
      if (stop) {
        to = stop;
        break;
      }
    }
    if (from && to) return { from, to };
    return this.adjacentStopsForDay(items, cityFallback);
  }

  private asPlaceStop(
    item:
      | TripSegment
      | DetailCar
      | DetailHotel
      | DetailActivity
      | DetailFlight
      | DetailTrain
      | DetailBus,
    cityFallback: string,
  ): TransferStop | null {
    if (item.type === 'hotel') {
      const h = item as DetailHotel;
      return {
        label: this.placeLabel(h.location, h.name, cityFallback),
        lat: (h as DetailHotel & { lat?: number }).lat,
        lng: (h as DetailHotel & { lng?: number }).lng,
        placeId: (h as DetailHotel & { placeId?: string }).placeId,
      };
    }
    if (item.type === 'activity') {
      const a = item as DetailActivity;
      return {
        label: this.placeLabel(a.location, a.title, cityFallback),
        lat: a.lat,
        lng: a.lng,
        placeId: a.placeId,
      };
    }
    if (item.type === 'flight') {
      const f = item as DetailFlight;
      const code = f.arrCode || f.depCode;
      if (code) return { label: String(code) };
    }
    if (item.type === 'train') {
      const t = item as DetailTrain;
      const label = t.arrLocation || t.depLocation;
      if (label) return { label: String(label) };
    }
    if (item.type === 'bus') {
      const b = item as DetailBus;
      const label = b.arrLocation || b.depLocation;
      if (label) return { label: String(label) };
    }
    return null;
  }

  /** Prefer a specific place name over a generic city-only location. */
  private placeLabel(
    location: string | undefined,
    title: string | undefined,
    cityFallback: string,
  ): string {
    const loc = (location || '').trim();
    const name = (title || '').trim();
    const city = cityFallback.trim().toLowerCase();
    if (!loc) return name || cityFallback;
    if (!name) return loc;
    const locCore = loc.split(',')[0]?.trim().toLowerCase() || '';
    if (locCore === city || loc.toLowerCase() === city) {
      return name;
    }
    return loc;
  }

  private async resolveStop(stop: TransferStop, cityHint?: string): Promise<TransferStop> {
    if (stop.lat != null && stop.lng != null) {
      return { ...stop, label: stop.label || cityHint || 'Stop' };
    }
    const label = (stop.label || '').trim();
    const hint = (cityHint || '').trim();
    // Try label alone first (static cache hits), then label+city, then city.
    const queries = [label, hint && label ? `${label}, ${hint}` : '', hint].filter(
      (q, i, arr) => !!q && arr.indexOf(q) === i,
    );
    for (const query of queries) {
      const geo = await this.geocoder.getCoordinates(query);
      if (geo) {
        return {
          label: label || geo.displayName,
          lat: geo.lat,
          lng: geo.lon,
          placeId: stop.placeId,
        };
      }
    }
    return { ...stop, label: label || hint || 'Stop' };
  }

  private async computeRoute(
    from: TransferStop,
    to: TransferStop,
  ): Promise<RouteComputeResponse | null> {
    if (from.lat == null || from.lng == null || to.lat == null || to.lng == null) {
      return null;
    }
    try {
      return await firstValueFrom(
        this.http
          .post<RouteComputeResponse>(apiUrl('/inventory/routes/compute'), {
            origin_lat: from.lat,
            origin_lng: from.lng,
            dest_lat: to.lat,
            dest_lng: to.lng,
            travel_mode: 'DRIVE',
          })
          .pipe(timeout(4000)),
      );
    } catch {
      return null;
    }
  }

  private async searchTransferFares(
    from: TransferStop,
    to: TransferStop,
    dateIso: string | undefined,
    travelers: number,
    duration: string,
    durationMinutes: number,
    distanceKm: number | null,
  ): Promise<TransferLegPlan[]> {
    const pickup = from.label.split(',')[0]?.trim() || from.label;
    const dropoff = to.label.split(',')[0]?.trim() || to.label;
    let pickupCode: string | undefined;
    let dropoffCode: string | undefined;
    try {
      const [pickDests, dropDests] = await Promise.all([
        this.transfers.searchDestinations(pickup),
        this.transfers.searchDestinations(dropoff),
      ]);
      pickupCode = pickDests[0]?.locationCode || pickDests[0]?.id;
      dropoffCode = dropDests[0]?.locationCode || dropDests[0]?.id;
    } catch {
      /* destination resolve is best-effort */
    }

    const date = dateIso || new Date().toISOString().slice(0, 10);
    const res = await this.transfers.search({
      journey_type: 'OneWay',
      pickup_location: pickup,
      dropoff_location: dropoff,
      adults: travelers,
      pickup_date: date,
      pickup_time: '10:00',
      pickup_location_code: pickupCode,
      dropoff_location_code: dropoffCode,
      search_currency: 'INR',
    });

    const products = res.travelling?.products || [];
    return products.slice(0, 8).map((p) => {
      const price = this.roundFare(parseFloat(String(p.pricing?.totalPrice || '0')) || 0);
      const productDuration = p.general?.duration || duration;
      return {
        from,
        to,
        duration: productDuration,
        durationMinutes,
        distanceKm: distanceKm ?? (p.general?.distance ? parseFloat(String(p.general.distance)) : null),
        price: price || this.estimateFare(distanceKm, durationMinutes),
        currency: p.pricing?.currency || 'INR',
        model: String(p.general?.productName || p.general?.vehicleType || 'Private transfer'),
        category: String(p.general?.vehicleClass || 'Transfer'),
        provider: p.general?.supplierName,
        imageUrl: p.general?.image,
        source: 'transfer' as const,
      };
    });
  }

  /** Rough INR fare when live pricing is unavailable (~₹35/km or time-based). */
  private estimateFare(distanceKm: number | null, durationMinutes: number): number {
    if (distanceKm != null && distanceKm > 0) {
      return Math.max(400, Math.round(distanceKm * 35));
    }
    return Math.max(400, Math.round(durationMinutes * 18));
  }
}
