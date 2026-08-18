import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { apiUrl } from '../shared/utils/api-url';

// -----------------------------------------------------------------------
// Destinations
// -----------------------------------------------------------------------

export interface TransferDestination {
  id?: string;
  longitude?: string;
  latitude?: string;
  place?: string;
  country?: string;
  city?: string;
  locationCode?: string;
}

// -----------------------------------------------------------------------
// Search
// -----------------------------------------------------------------------

export interface TransferSearchRequest {
  search_currency?: string;
  journey_type: 'OneWay' | 'Return';
  pickup_location: string;
  dropoff_location: string;
  adults: number;
  children?: number;
  infants?: number;

  arrival_date?: string;
  arrival_time?: string;
  departure_date?: string;
  departure_time?: string;

  pickup_date?: string;
  pickup_time?: string;
  return_pickup_date?: string;
  return_pickup_time?: string;

  pickup_location_code?: string;
  pickup_location_type?: string;
  dropoff_location_code?: string;
  dropoff_location_type?: string;

  sorting?: string;
}

export interface TransferProductGeneral {
  productId?: string;
  productName?: string;
  vehicleType?: string;
  vehicleClass?: string;
  maxPassengers?: string;
  maxLuggage?: string;
  supplierName?: string;
  duration?: string;
  distance?: string;
  image?: string;
  description?: string;
  bookingTypeId?: string;
  cancellationPolicy?: string;
  [extra: string]: unknown;
}

export interface TransferProductPricing {
  totalPrice?: string;
  currency?: string;
  basePrice?: string;
  tax?: string;
  [extra: string]: unknown;
}

export interface TransferProduct {
  general?: TransferProductGeneral;
  pricing?: TransferProductPricing;
}

export interface TransferSearchResponse {
  sessionId?: string;
  searchResult?: string;
  travelling?: { products?: TransferProduct[] };
}

// -----------------------------------------------------------------------
// Booking
// -----------------------------------------------------------------------

export interface TransferPaxDetails {
  lead_title: string;
  lead_first_name: string;
  lead_last_name: string;
  phone: string;
  email_id: string;
  address01: string;
  zip_code: string;
  address02?: string;
}

export interface TransferAccomodationDetails {
  accomodation_name: string;
  accomodation_address01: string;
  accomodation_address02?: string;
}

export interface TransferPaymentDetails {
  card_type?: string;
  card_no?: string;
  card_cvv?: string;
  expiry_date?: string;
  card_holder_name?: string;
}

export interface TransferAirlineDetails {
  airport_code?: string;
  airline_code?: string;
  airline_number?: string;
}

export interface TransferExtraItem {
  code: string;
  quantity: number;
}

export interface TransferBookingRequest {
  session_id: string;
  product_id: string;
  booking_type_id: string;
  client_reference?: string;
  pax_details: TransferPaxDetails;
  accomodation_details: TransferAccomodationDetails;
  payment_details?: TransferPaymentDetails;
  departure_airline?: TransferAirlineDetails;
  arrival_airline?: TransferAirlineDetails;
  extras?: TransferExtraItem[];
  remark?: string;
}

export interface TransferCompanyDetails {
  supplierName?: string;
  contactNumber?: string;
  email?: string;
  [extra: string]: unknown;
}

export interface TransferLegDetails {
  transferDetails?: Record<string, unknown>;
  companyDetails?: TransferCompanyDetails;
}

export interface TransferDescription {
  supplierName?: string;
  outboundDetails?: TransferLegDetails;
  returnDetails?: TransferLegDetails;
}

export interface TransferBookingResponse {
  status?: string;
  confirmationNumber?: string;
  customerName?: string;
  transferDescription?: TransferDescription;
}

export type TransferBookingDetailsResponse = TransferBookingResponse;

export interface TransferCancelResponse {
  status?: string;
  confirmationNumber?: string;
  customerName?: string;
}

@Injectable({ providedIn: 'root' })
export class TransferService {
  private readonly http = inject(HttpClient);

  async searchDestinations(destination: string): Promise<TransferDestination[]> {
    return firstValueFrom(
      this.http.post<TransferDestination[]>(apiUrl('/travelnext-transfers/destinations'), { destination }),
    );
  }

  async search(request: TransferSearchRequest): Promise<TransferSearchResponse> {
    // Omit unset optional fields entirely rather than sending null — the
    // provider's request schema treats their presence as meaningful.
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(request)) {
      if (value !== undefined && value !== null && value !== '') {
        body[key] = value;
      }
    }
    return firstValueFrom(this.http.post<TransferSearchResponse>(apiUrl('/travelnext-transfers/search'), body));
  }

  async book(request: TransferBookingRequest): Promise<TransferBookingResponse> {
    return firstValueFrom(this.http.post<TransferBookingResponse>(apiUrl('/travelnext-transfers/bookings'), request));
  }

  async cancel(confirmationId: string): Promise<TransferCancelResponse> {
    return firstValueFrom(
      this.http.post<TransferCancelResponse>(apiUrl('/travelnext-transfers/bookings/cancel'), {
        confirmation_id: confirmationId,
      }),
    );
  }

  async bookingDetails(confirmationId: string): Promise<TransferBookingDetailsResponse> {
    return firstValueFrom(
      this.http.post<TransferBookingDetailsResponse>(apiUrl('/travelnext-transfers/bookings/details'), {
        confirmation_id: confirmationId,
      }),
    );
  }
}
