import { Injectable, inject, signal, effect, untracked, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ProfileService } from '../../profile/profile.service';
import { AuthService } from '../../auth/auth.service';

export type SupportedLanguage = 'en' | 'es' | 'fr';
export type SupportedCurrency = 'USD' | 'EUR' | 'INR';

export const LANGUAGE_LABELS: Record<SupportedLanguage, { label: string; icon: string }> = {
  en: { label: 'English', icon: '🇺🇸' },
  es: { label: 'Español', icon: '🇪🇸' },
  fr: { label: 'Français', icon: '🇫🇷' },
};

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  USD: '$',
  EUR: '€',
  INR: '₹',
};

export const CURRENCY_FLAGS: Record<SupportedCurrency, string> = {
  USD: '🇺🇸',
  EUR: '🇪🇺',
  INR: '🇮🇳',
};

const LANG_STORAGE_KEY = 'travlplanr_lang';
const CURRENCY_STORAGE_KEY = 'travlplanr_currency';

@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly profileService = inject(ProfileService);
  private readonly auth = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly currentLanguage = signal<SupportedLanguage>(this.getStoredLanguage());
  readonly currentCurrency = signal<SupportedCurrency>(this.getStoredCurrency());
  /** Bumps when the user changes currency so money-bearing views can refetch. */
  readonly currencyEpoch = signal(0);

  constructor() {
    // Persist language to local storage whenever it changes
    effect(() => {
      const lang = this.currentLanguage();
      if (this.isBrowser) {
        localStorage.setItem(LANG_STORAGE_KEY, lang);
      }
    });

    // Persist currency and sync it to the profile. Triggered only by currency changes:
    // preferences are read untracked so this never re-fires (and never PUTs) when the
    // profile itself changes — the effect below owns that direction. The PUT is also
    // gated on preferencesLoaded, since a draft built from DEFAULT_PREFERENCES would
    // wipe the user's real preference fields on the backend.
    effect(() => {
      const currency = this.currentCurrency();
      if (this.isBrowser) {
        localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
      }

      if (this.auth.isLoggedIn() && untracked(() => this.profileService.preferencesLoaded())) {
        const prefs = untracked(() => this.profileService.resetPreferencesDraft());
        if (prefs.currency !== currency) {
          prefs.currency = currency;
          this.profileService.updatePreferences(prefs).catch((err) => {
            console.error('Failed to sync currency to profile', err);
          });
        }
      }
    });

    // Sync currency back from the backend. Triggered only by profile changes, and only
    // once preferences hold real backend data — before that they sit at the hardcoded
    // USD default (guests never load preferences at all) and would stomp on the locally
    // stored selection. currentCurrency is read untracked so this effect's own write
    // can't re-trigger it.
    effect(() => {
      const isLoggedIn = this.auth.isLoggedIn();
      const loaded = this.profileService.preferencesLoaded();
      const prefs = this.profileService.preferences();
      const current = untracked(() => this.currentCurrency());
      if (isLoggedIn && loaded && prefs && prefs.currency && prefs.currency !== current) {
        if (['USD', 'EUR', 'INR'].includes(prefs.currency)) {
          this.currentCurrency.set(prefs.currency as SupportedCurrency);
        }
      }
    }, { allowSignalWrites: true });
  }

  setLanguage(lang: SupportedLanguage): void {
    this.currentLanguage.set(lang);
  }

  setCurrency(currency: SupportedCurrency): void {
    if (this.currentCurrency() === currency) return;
    this.currentCurrency.set(currency);
    this.currencyEpoch.update((n) => n + 1);
  }

  private getStoredLanguage(): SupportedLanguage {
    if (!this.isBrowser) return 'en';
    const stored = localStorage.getItem(LANG_STORAGE_KEY) as SupportedLanguage;
    return ['en', 'es', 'fr'].includes(stored) ? stored : 'en';
  }

  private getStoredCurrency(): SupportedCurrency {
    if (!this.isBrowser) return 'USD';
    const stored = localStorage.getItem(CURRENCY_STORAGE_KEY) as SupportedCurrency;
    return ['USD', 'EUR', 'INR'].includes(stored) ? stored : 'USD';
  }
}
