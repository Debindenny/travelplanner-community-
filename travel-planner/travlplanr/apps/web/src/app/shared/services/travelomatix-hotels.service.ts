import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { apiUrl } from '../utils/api-url';

export interface TravelomatixRoomGuest {
  NoOfAdults: number;
  NoOfChild?: number;
  ChildAge?: string[];
}

export interface TravelomatixHotelsSearchRequest {
  CheckInDate: string;
  NoOfNights: number;
  CountryCode: string;
  CityId: number;
  GuestNationality?: string;
  NoOfRooms?: number;
  RoomGuests: TravelomatixRoomGuest[];
}

export interface TravelomatixHotelsBookingRequest {
  ResultToken: string;
  RoomUniqueId?: string[];
  AppReference?: string;
  customerEmail: string;
  customerPhone?: string;
  title?: string;
  firstName: string;
  lastName: string;
}

@Injectable({ providedIn: 'root' })
export class TravelomatixHotelsService {
  private readonly http = inject(HttpClient);

  async search(request: TravelomatixHotelsSearchRequest): Promise<unknown> {
    return firstValueFrom(this.http.post(apiUrl('/travelomatix-hotels/search'), request));
  }

  async details(resultToken: string): Promise<unknown> {
    return firstValueFrom(
      this.http.post(apiUrl('/travelomatix-hotels/details'), { ResultToken: resultToken }),
    );
  }

  async rooms(resultToken: string): Promise<unknown> {
    return firstValueFrom(
      this.http.post(apiUrl('/travelomatix-hotels/rooms'), { ResultToken: resultToken }),
    );
  }

  async book(request: TravelomatixHotelsBookingRequest): Promise<unknown> {
    return firstValueFrom(this.http.post(apiUrl('/travelomatix-hotels/bookings'), request));
  }

  async cancel(appReference: string): Promise<unknown> {
    return firstValueFrom(
      this.http.post(apiUrl('/travelomatix-hotels/bookings/cancel'), {
        AppReference: appReference,
      }),
    );
  }
}
