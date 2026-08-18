import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { apiUrl } from '../shared/utils/api-url';

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  countryCode: string;
  gender: string;
  dateOfBirth: string;
  nationality: string;
  avatarUrl?: string;
  coverUrl?: string;
}

export interface TravelPreferences {
  destinations: string[];
  activities: string[];
  travelStyle: string;
  accommodation: string;
  transport: string;
  dietary: string[];
  currency: string;
}

export interface NotificationSettingItem {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

const PROFILE_KEY = 'travlplanr_profile';
const PREFERENCES_KEY = 'travlplanr_preferences';

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  email: '',
  phone: '',
  countryCode: '+91',
  gender: '',
  dateOfBirth: '',
  nationality: '',
};

const DEFAULT_PREFERENCES: TravelPreferences = {
  destinations: [],
  activities: [],
  travelStyle: '',
  accommodation: '',
  transport: '',
  dietary: [],
  currency: 'USD',
};

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly profileSignal = signal<UserProfile>({ ...DEFAULT_PROFILE });
  private readonly preferencesSignal = signal<TravelPreferences>({ ...DEFAULT_PREFERENCES });
  private readonly notificationsSignal = signal<NotificationSettingItem[]>([]);
  /** True once preferences reflect real backend data rather than DEFAULT_PREFERENCES. */
  private readonly preferencesLoadedSignal = signal(false);
  private readonly loadErrorSignal = signal<string | null>(null);
  private readonly preferencesErrorSignal = signal<string | null>(null);
  private readonly notificationsErrorSignal = signal<string | null>(null);

  readonly profile = this.profileSignal.asReadonly();
  readonly preferences = this.preferencesSignal.asReadonly();
  readonly preferencesLoaded = this.preferencesLoadedSignal.asReadonly();
  readonly notifications = this.notificationsSignal.asReadonly();
  readonly loadError = this.loadErrorSignal.asReadonly();
  readonly preferencesError = this.preferencesErrorSignal.asReadonly();
  readonly notificationsError = this.notificationsErrorSignal.asReadonly();

  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);

  constructor() {
    if (this.auth.isLoggedIn()) {
      this.reload();
    }
  }

  /** (Re)load profile data from the backend, surfacing failures via the error signals. */
  reload(): void {
    this.preferencesLoadedSignal.set(false);
    this.loadErrorSignal.set(null);
    this.preferencesErrorSignal.set(null);
    this.notificationsErrorSignal.set(null);
    this.loadProfile();
    this.loadPreferences();
    this.loadNotifications();
  }

  async updateProfile(profile: UserProfile): Promise<void> {
    try {
      await firstValueFrom(this.http.put(apiUrl('/me/profile'), profile));
      this.profileSignal.set(profile);
    } catch (e) {
      console.error('Failed to update profile to backend', e);
      throw e;
    }
  }

  async uploadAvatar(file: File): Promise<{url: string}> {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await firstValueFrom(this.http.post<{url: string}>(apiUrl('/me/avatar'), formData));
      this.profileSignal.update(p => ({ ...p, avatarUrl: res.url }));
      return res;
    } catch (e) {
      console.error('Failed to upload avatar', e);
      throw e;
    }
  }

  async uploadCover(file: File): Promise<{url: string}> {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await firstValueFrom(this.http.post<{url: string}>(apiUrl('/me/cover'), formData));
      this.profileSignal.update(p => ({ ...p, coverUrl: res.url }));
      return res;
    } catch (e) {
      console.error('Failed to upload cover', e);
      throw e;
    }
  }

  async updatePreferences(preferences: TravelPreferences): Promise<void> {
    try {
      await firstValueFrom(this.http.put(apiUrl('/me/preferences'), preferences));
      this.preferencesSignal.set(preferences);
      this.preferencesLoadedSignal.set(true);
    } catch (e) {
      console.error('Failed to update preferences to backend', e);
      throw e;
    }
  }

  async updateNotifications(settings: NotificationSettingItem[]): Promise<void> {
    try {
      await firstValueFrom(this.http.put(apiUrl('/me/notifications'), { settings }));
      this.notificationsSignal.set(settings);
    } catch (e) {
      console.error('Failed to update notifications to backend', e);
      throw e;
    }
  }

  resetProfileDraft(): UserProfile {
    return { ...this.profileSignal() };
  }

  resetPreferencesDraft(): TravelPreferences {
    return {
      ...this.preferencesSignal(),
      destinations: [...this.preferencesSignal().destinations],
      activities: [...this.preferencesSignal().activities],
      dietary: [...this.preferencesSignal().dietary],
    };
  }

  private async loadProfile(): Promise<UserProfile> {
    try {
      const res: any = await firstValueFrom(this.http.get(apiUrl('/me/profile')));
      const profile = { ...DEFAULT_PROFILE, ...res };
      this.profileSignal.set(profile);
      return profile;
    } catch (e) {
      console.error('Failed to load profile from backend', e);
      this.loadErrorSignal.set(this.translate.instant('PROFILE.LOAD_PROFILE_ERROR'));
      return { ...DEFAULT_PROFILE };
    }
  }

  private async loadPreferences(): Promise<TravelPreferences> {
    try {
      const res: any = await firstValueFrom(this.http.get(apiUrl('/me/preferences')));
      const prefs = { ...DEFAULT_PREFERENCES, ...res };
      this.preferencesSignal.set(prefs);
      this.preferencesLoadedSignal.set(true);
      return prefs;
    } catch (e) {
      console.error('Failed to load preferences from backend', e);
      this.preferencesErrorSignal.set(this.translate.instant('PROFILE.LOAD_PREFERENCES_ERROR'));
      const prefs = { ...DEFAULT_PREFERENCES, destinations: [...DEFAULT_PREFERENCES.destinations], activities: [...DEFAULT_PREFERENCES.activities], dietary: [...DEFAULT_PREFERENCES.dietary] };
      return prefs;
    }
  }

  private async loadNotifications(): Promise<NotificationSettingItem[]> {
    try {
      const res: any = await firstValueFrom(this.http.get(apiUrl('/me/notifications')));
      if (res && res.items) {
        this.notificationsSignal.set(res.items);
        return res.items;
      }
      return [];
    } catch (e) {
      console.error('Failed to load notifications from backend', e);
      this.notificationsErrorSignal.set(this.translate.instant('PROFILE.LOAD_NOTIFICATIONS_ERROR'));
      return [];
    }
  }
}
