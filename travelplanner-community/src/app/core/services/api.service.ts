import { Injectable } from '@angular/core';

import { environment } from '../../../environments/environment';
import { CommunityHomePayload } from '../models/community.models';

@Injectable({ providedIn: 'root' })
export class CommunityApiService {
  private readonly baseUrl = environment.apiUrl;

  async getCommunityHomePayload(): Promise<CommunityHomePayload> {
    return this.request<CommunityHomePayload>('/community/home');
  }

  private async request<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    let lastError: unknown;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error;
        if (attempt === 2) {
          throw new Error(`Unable to load ${endpoint}: ${String(lastError)}`);
        }
      }
    }

    throw new Error(`Unable to load ${endpoint}`);
  }
}
