import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { apiUrl } from '../utils/api-url';

export interface TravelNextActivitiesSearchRequest {
  cityCode?: string;
  hotelCode?: string;
  geoCode?: {
    latitude: string;
    longitude: string;
  };
  adults: number;
  children?: number;
  childAges?: number[];
  currency?: string;
  fromDate?: string;
  toDate?: string;
  language?: string;
  priceMin?: number;
  priceMax?: number;
}

export interface TravelNextActivitiesBookingRequest {
  sessionId: string;
  clientReference: string;
  leadPassenger: Record<string, unknown>;
  activities: Array<Record<string, unknown>>;
}

@Injectable({ providedIn: 'root' })
export class TravelNextActivitiesService {
  private readonly http = inject(HttpClient);

  async search(request: TravelNextActivitiesSearchRequest): Promise<unknown> {
    return firstValueFrom(this.http.post(apiUrl('/travelnext-activities/search'), request));
  }

  async details(sessionId: string, activityCode: string, optionCode: string): Promise<unknown> {
    return firstValueFrom(
      this.http.post(apiUrl('/travelnext-activities/details'), {
        sessionId,
        activityCode,
        optionCode,
      }),
    );
  }

  async book(request: TravelNextActivitiesBookingRequest): Promise<unknown> {
    return firstValueFrom(this.http.post(apiUrl('/travelnext-activities/bookings'), request));
  }
}
