/**
 * AdminAuthService — credentialed login → identity /api/v1/auth/admin/login.
 */
import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface StaffUser {
  id: string;
  display_code: string;
  name: string;
  role: string;
  email: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token?: string | null;
  token_type: string;
  staff: StaffUser;
}

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  currentUser = signal<StaffUser | null>(null);
  isAuthenticated = signal(false);
  canManageStaff = computed(() => {
    const role = this.currentUser()?.role;
    return role === 'Manager' || role === 'Admin';
  });

  constructor(private httpClient: HttpClient, private router: Router) {
    const token = localStorage.getItem('admin_token');
    const staffJson = localStorage.getItem('admin_staff');
    if (token && staffJson && !this.isTokenExpired(token)) {
      try {
        this.currentUser.set(JSON.parse(staffJson));
        this.isAuthenticated.set(true);
      } catch {
        this.clearSession();
      }
    } else if (token) {
      this.clearSession();
    }
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.httpClient
      .post<LoginResponse>(`${environment.identityPath}/auth/admin/login`, { email, password })
      .pipe(tap((res) => this.handleLoginSuccess(res)));
  }

  signup(email: string, password: string, name: string, phone?: string): Observable<LoginResponse> {
    return this.httpClient
      .post<LoginResponse>(`${environment.identityPath}/auth/signup`, {
        email,
        password,
        name,
        phone,
      })
      .pipe(tap((res) => this.handleLoginSuccess(res)));
  }

  logout(): void {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    const token = localStorage.getItem('admin_token');
    if (!token) return null;
    if (this.isTokenExpired(token)) {
      this.clearSession();
      return null;
    }
    return token;
  }

  /** True when JWT is present and not past exp (client-side check only). */
  hasValidSession(): boolean {
    return !!this.getToken() && this.isAuthenticated();
  }

  private handleLoginSuccess(res: LoginResponse): void {
    localStorage.setItem('admin_token', res.access_token);
    if (res.refresh_token) {
      localStorage.setItem('admin_refresh_token', res.refresh_token);
    }
    localStorage.setItem('admin_staff', JSON.stringify(res.staff));
    this.currentUser.set(res.staff);
    this.isAuthenticated.set(true);
  }

  private clearSession(): void {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_refresh_token');
    localStorage.removeItem('admin_staff');
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payloadPart = token.split('.')[1];
      if (!payloadPart) return true;
      const payload = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
      if (typeof payload.exp !== 'number') return false;
      // Treat as expired 30s early to absorb clock skew
      return Date.now() >= payload.exp * 1000 - 30_000;
    } catch {
      return true;
    }
  }
}
