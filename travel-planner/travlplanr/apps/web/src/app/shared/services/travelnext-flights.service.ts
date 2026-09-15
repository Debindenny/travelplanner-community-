import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { apiUrl } from '../utils/api-url';

// Mirrors services/affiliate/app/schemas/travelnext.py CreateBookingRequest.
// Both fields are free-form objects on the backend — the adapter's
// normalize_flight_booking_info()/normalize_pax_info() accept a range of
// camelCase/snake_case aliases (sessionId|session_id, fareSourceCode, etc.).
export interface TravelNextFlightBookingRequest {
  flightBookingInfo: Record<string, unknown>;
  paxInfo: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class TravelNextFlightsService {
  private readonly http = inject(HttpClient);

  async book(request: TravelNextFlightBookingRequest): Promise<unknown> {
    return firstValueFrom(this.http.post(apiUrl('/travelnext/bookings'), request));
  }
}
