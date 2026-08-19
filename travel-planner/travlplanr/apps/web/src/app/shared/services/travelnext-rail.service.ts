import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { apiUrl } from '../utils/api-url';

export interface TravelNextRailStation {
  stationCode?: string;
  stationName?: string;
  cityName?: string;
  countryName?: string;
  [extra: string]: unknown;
}

export interface TravelNextRailSearchRequest {
  OriginDestinationInfo: Array<{
    departureDate: string;
    originCode: string;
    destinationCode: string;
  }>;
  adults?: number;
  childs?: number;
  infants?: number;
  class_?: string;
  requiredCurrency?: string;
}

@Injectable({ providedIn: 'root' })
export class TravelNextRailService {
  private readonly http = inject(HttpClient);

  async searchStations(query: string): Promise<TravelNextRailStation[]> {
    return firstValueFrom(
      this.http.post<TravelNextRailStation[]>(apiUrl('/travelnext-rail/stations'), { query }),
    );
  }

  async search(request: TravelNextRailSearchRequest): Promise<unknown> {
    return firstValueFrom(this.http.post(apiUrl('/travelnext-rail/search'), request));
  }
}
