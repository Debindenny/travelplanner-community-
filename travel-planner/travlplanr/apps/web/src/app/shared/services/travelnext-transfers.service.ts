import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { apiUrl } from '../utils/api-url';

// Mirrors services/affiliate/app/schemas/travelnext_transfers.py TransferBookingRequest.
// Unlike travelnext.py, this schema has no alias-normalization layer — field
// names must match the provider's snake_case wire format exactly.
export interface TravelNextTransferPaxDetails {
  lead_title: string;
  lead_first_name: string;
  lead_last_name: string;
  phone: string;
  email_id: string;
  address01: string;
  zip_code: string;
  address02?: string;
}

export interface TravelNextTransferAccomodationDetails {
  accomodation_name: string;
  accomodation_address01: string;
  accomodation_address02?: string;
}

export interface TravelNextTransferBookingRequest {
  session_id: string;
  product_id: string;
  booking_type_id: string;
  client_reference?: string;
  pax_details: TravelNextTransferPaxDetails;
  accomodation_details: TravelNextTransferAccomodationDetails;
  payment_details?: Record<string, unknown>;
  departure_airline?: Record<string, unknown>;
  arrival_airline?: Record<string, unknown>;
  extras?: Array<Record<string, unknown>>;
  remark?: string;
}

@Injectable({ providedIn: 'root' })
export class TravelNextTransfersService {
  private readonly http = inject(HttpClient);

  async book(request: TravelNextTransferBookingRequest): Promise<unknown> {
    return firstValueFrom(this.http.post(apiUrl('/travelnext-transfers/bookings'), request));
  }
}
