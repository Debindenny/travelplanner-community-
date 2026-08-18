import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { apiUrl } from '../utils/api-url';

export interface TravelNextCarsBookingRequest {
  sessionId: string;
  referenceId: string;
  noOfPassenger: string;
  paxDetails: Record<string, unknown>;
  paymentDetails: Record<string, unknown>;
  clientReference?: string;
  remark?: string;
  insurancePlanId?: string;
  extraServices?: Array<Record<string, unknown>>;
  airlineDetails?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class TravelNextCarsService {
  private readonly http = inject(HttpClient);

  async book(request: TravelNextCarsBookingRequest): Promise<unknown> {
    return firstValueFrom(this.http.post(apiUrl('/travelnext-cars/bookings'), request));
  }
}
