import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { apiUrl } from '../shared/utils/api-url';

export interface AuthUser {
  id: string;
  email: string;
  planType: 'free' | 'individual' | 'travel_partner';
  plansUsed: number;
  plansLimit: number;
  token?: string;
  refreshToken?: string;
}

const STORAGE_KEY = 'travlplanr_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly userSignal = signal<AuthUser | null>(this.loadSession());

  readonly user = this.userSignal.asReadonly();
  readonly isLoggedIn = computed(() => this.hasValidToken());
  /** Display name derived from the logged-in user's email (local-part), or 'Traveler'. */
  readonly customerName = computed(() => this.userSignal()?.email?.split('@')[0] ?? 'Traveler');

  get token(): string | undefined {
    const user = this.userSignal();
    return user?.token && !this.isTokenExpired(user.token) ? user.token : undefined;
  }

  constructor() {
    const user = this.userSignal();
    if (user?.refreshToken && user.token && this.isTokenExpired(user.token)) {
      this.refreshToken();
    }
  }

  hasValidToken(): boolean {
    const user = this.userSignal();
    return !!user?.token && !this.isTokenExpired(user.token);
  }

  async sendOtp(email: string): Promise<{ devOtp?: string }> {
    try {
      const response = await firstValueFrom(
        this.http.post<{ message: string; email: string; dev_otp?: string }>(
          apiUrl('/auth/otp/request'),
          { email },
        ),
      );
      sessionStorage.setItem('travlplanr_pending_otp', email);
      sessionStorage.setItem('travlplanr_otp_sent_at', new Date().toISOString());
      return { devOtp: response.dev_otp };
    } catch (e: any) {
      console.error('Failed to send OTP', e);
      throw e;
    }
  }

  getPendingOtpEmail(): string | null {
    try { return sessionStorage.getItem('travlplanr_pending_otp'); } catch { return null; }
  }

  getOtpSentAt(): string | null {
    try { return sessionStorage.getItem('travlplanr_otp_sent_at'); } catch { return null; }
  }

  clearPendingOtp(): void {
    try {
      sessionStorage.removeItem('travlplanr_pending_otp');
      sessionStorage.removeItem('travlplanr_otp_sent_at');
    } catch { /* ignore */ }
  }

  async verifyOtp(email: string, code: string): Promise<boolean> {
    try {
      const response: any = await firstValueFrom(
        this.http.post(apiUrl('/auth/otp/verify'), { email, code })
      );
      if (this.applyAuthResponse(response, email)) {
        sessionStorage.removeItem('travlplanr_pending_otp');
        sessionStorage.removeItem('travlplanr_otp_sent_at');
        // Fetch real limits
        await this.refreshPlan();
        return true;
      }
      throw new Error('Invalid code');
    } catch (e: any) {
      console.error('Failed to verify OTP', e);
      throw e;
    }
  }

  async signInWithGoogle(idToken: string, email?: string, name?: string): Promise<boolean> {
    try {
      const response: any = await firstValueFrom(
        this.http.post(apiUrl('/auth/oauth/google'), {
          id_token: idToken,
          email,
          name,
        }),
      );
      if (this.applyAuthResponse(response, email)) {
        sessionStorage.removeItem('travlplanr_pending_otp');
        sessionStorage.removeItem('travlplanr_otp_sent_at');
        await this.refreshPlan();
        return true;
      }
      throw new Error('Invalid Google sign-in response');
    } catch (e: any) {
      console.error('Failed to sign in with Google', e);
      throw e;
    }
  }

  logout(): void {
    const user = this.userSignal();
    // Best-effort server-side revocation — fire and forget so the local session
    // clears immediately even if the request fails or takes time.
    if (user?.token) {
      const body = user.refreshToken ? { refresh_token: user.refreshToken } : {};
      this.http.post(apiUrl('/auth/logout'), body, {
        headers: { Authorization: `Bearer ${user.token}` }
      }).subscribe({ error: () => {} });
    }
    this.userSignal.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  private refreshPromise: Promise<boolean> | null = null;

  clearStaleSession(): void {
    if (this.userSignal() && !this.hasValidToken()) {
      // Don't auto logout here if we have a refresh token
      if (!this.userSignal()?.refreshToken) {
        this.logout();
      }
    }
  }

  async refreshToken(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const user = this.userSignal();
    if (!user || !user.refreshToken) return false;
    
    this.refreshPromise = (async () => {
      try {
        const response: any = await firstValueFrom(
          this.http.post(apiUrl('/auth/refresh'), { refresh_token: user.refreshToken })
        );
        
        if (response && response.access_token) {
          const updated = {
            ...user,
            token: response.access_token,
            refreshToken: response.refresh_token || user.refreshToken
          };
          this.userSignal.set(updated);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          return true;
        }
        return false;
      } catch (e) {
        console.error('Token refresh failed', e);
        this.logout();
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  async refreshPlan(): Promise<void> {
    const user = this.userSignal();
    if (!user) return;
    try {
      const planRes: any = await firstValueFrom(this.http.get(apiUrl('/me/plan')));
      if (planRes) {
        const updated = {
          ...user,
          plansUsed: planRes.plans_used,
          plansLimit: planRes.plans_limit
        };
        this.userSignal.set(updated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
    } catch (e) {
      console.error('Failed to refresh plan', e);
    }
  }

  incrementPlansUsed(): void {
    // Deprecated: now relies on refreshPlan
    this.refreshPlan();
  }

  private decodeJwtPayload(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) return {};
      let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return {};
    }
  }

  private loadSession(): AuthUser | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const user = JSON.parse(raw) as AuthUser;
      if (!user.token) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      if (this.isTokenExpired(user.token) && !user.refreshToken) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return user;
    } catch {
      return null;
    }
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = this.decodeJwtPayload(token);
      const exp = typeof payload.exp === 'number' ? payload.exp : 0;
      return exp * 1000 <= Date.now();
    } catch {
      return true;
    }
  }

  private applyAuthResponse(response: any, fallbackEmail?: string): boolean {
    if (!response?.access_token) return false;
    const token = response.access_token;
    let payload: any = {};
    try {
      payload = this.decodeJwtPayload(token);
    } catch (e) {
      console.error('Failed to parse JWT payload', e);
    }

    const user: AuthUser = {
      id: payload.customer_id,
      email: payload.email || response.email || fallbackEmail || '',
      planType: payload.plan_type || 'free',
      plansUsed: payload.plans_used || 0,
      plansLimit: payload.plans_limit || 2,
      token,
      refreshToken: response.refresh_token,
    };
    this.userSignal.set(user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    return true;
  }
}

