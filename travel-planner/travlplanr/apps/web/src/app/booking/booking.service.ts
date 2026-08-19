import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { apiUrl } from '../shared/utils/api-url';

export interface PassengerFormEntry {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  passengerType: 'adult' | 'child' | 'infant';
  passportNumber: string;
  nationality: string;
}

export interface BookingSummary {
  bookingId: string;
  status: string;
  pnr: string | null;
}

export interface BookingDetail {
  id: string;
  tripId: string | null;
  packageId: string | null;
  amount: number;
  currency: string;
  status: string;
  pnr: string | null;
  createdAt: string | null;
  passengers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
    passengerType: string;
    passportNumber: string | null;
    nationality: string | null;
  }>;
  flightSegments: Array<Record<string, any>>;
  hotelStays: Array<Record<string, any>>;
}

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly http = inject(HttpClient);

  async getBookingByTrip(tripId: string): Promise<BookingSummary | undefined> {
    try {
      return await firstValueFrom(this.http.get<BookingSummary>(apiUrl(`/bookings/by-trip/${tripId}`)));
    } catch {
      return undefined;
    }
  }

  /** Polls until the async booking consumer has created the booking row for this trip, or times out. */
  async waitForBookingConfirmation(tripId: string, timeoutMs = 30_000): Promise<BookingSummary | undefined> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const booking = await this.getBookingByTrip(tripId);
      if (booking) {
        return booking;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    return this.getBookingByTrip(tripId);
  }

  async getBookingDetail(bookingId: string): Promise<BookingDetail | undefined> {
    try {
      return await firstValueFrom(this.http.get<BookingDetail>(apiUrl(`/bookings/${bookingId}`)));
    } catch {
      return undefined;
    }
  }

  async savePassengers(bookingId: string, passengers: PassengerFormEntry[]): Promise<void> {
    await firstValueFrom(
      this.http.put(apiUrl(`/bookings/${bookingId}/passengers`), {
        passengers: passengers.map((p) => ({
          firstName: p.firstName,
          lastName: p.lastName,
          dateOfBirth: p.dateOfBirth || null,
          passengerType: p.passengerType,
          passportNumber: p.passportNumber || null,
          nationality: p.nationality || null,
        })),
      }),
    );
  }

  async saveFlightSegments(bookingId: string, segments: any[]): Promise<void> {
    await firstValueFrom(this.http.put(apiUrl(`/bookings/${bookingId}/flight-segments`), { segments }));
  }

  async saveHotelStays(bookingId: string, stays: any[]): Promise<void> {
    await firstValueFrom(this.http.put(apiUrl(`/bookings/${bookingId}/hotel-stays`), { stays }));
  }
}
