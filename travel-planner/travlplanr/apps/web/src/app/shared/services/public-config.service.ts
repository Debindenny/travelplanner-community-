import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { apiUrl } from '../utils/api-url';
import { environment } from '../../../environments/environment';

export interface PublicConfig {
  googleMapsBrowserKey: string;
  googleOAuthClientId?: string;
}

@Injectable({ providedIn: 'root' })
export class PublicConfigService {
  private readonly http = inject(HttpClient);
  private readonly loaded = signal(false);
  private readonly mapsKey = signal(
    ((environment as { googleMapsBrowserKey?: string }).googleMapsBrowserKey || '').trim(),
  );
  private readonly googleOAuthClientId = signal(
    ((environment as { googleOAuthClientId?: string }).googleOAuthClientId || '').trim(),
  );
  private loadPromise: Promise<string> | null = null;

  /** Browser Maps JavaScript key (build-time env, then runtime /public-config). */
  async getGoogleMapsBrowserKey(): Promise<string> {
    const existing = this.mapsKey().trim();
    if (existing) return existing;
    if (this.loaded()) return '';

    if (!this.loadPromise) {
      this.loadPromise = firstValueFrom(
        this.http.get<PublicConfig>(apiUrl('/public-config')),
      )
        .then((cfg) => {
          const key = (cfg?.googleMapsBrowserKey || '').trim();
          const clientId = (cfg?.googleOAuthClientId || '').trim();
          this.mapsKey.set(key);
          this.googleOAuthClientId.set(clientId);
          this.loaded.set(true);
          return key;
        })
        .catch(() => {
          this.loaded.set(true);
          return '';
        });
    }
    return this.loadPromise;
  }

  /** Browser-safe Google OAuth client id for Google Identity Services. */
  async getGoogleOAuthClientId(): Promise<string> {
    const existing = this.googleOAuthClientId().trim();
    if (existing) return existing;
    await this.getGoogleMapsBrowserKey();
    return this.googleOAuthClientId().trim();
  }
}
