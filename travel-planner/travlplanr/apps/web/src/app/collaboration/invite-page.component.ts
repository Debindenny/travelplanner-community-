import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { FormsModule } from '@angular/forms';
import { CollaborationService, InvitePreview } from './collaboration.service';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../shared/utils/toast.service';
import { apiErrorMessage } from '../shared/utils/api-error.util';

@Component({
    selector: 'app-invite-page',
    imports: [FormsModule],
    template: `
    <div class="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-subtle flex items-center justify-center p-4">
      <div class="w-full max-w-md">
        <!-- Loading -->
        @if (loading()) {
          <div class="bg-white rounded-3xl shadow-xl p-10 text-center">
            <div class="w-16 h-16 rounded-full bg-primary-50 mx-auto mb-4 flex items-center justify-center animate-pulse">
              <svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <p class="text-gray-500 text-sm">Loading invite…</p>
          </div>
        }

        <!-- Error -->
        @if (!loading() && error()) {
          <div class="bg-white rounded-3xl shadow-xl p-10 text-center">
            <div class="w-16 h-16 rounded-full bg-red-100 mx-auto mb-4 flex items-center justify-center">
              <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h2 class="text-xl font-bold text-gray-800 mb-2">Invite Not Found</h2>
            <p class="text-gray-500 text-sm mb-6">{{ error() }}</p>
            <button (click)="goHome()" class="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition">
              Go to Home
            </button>
          </div>
        }

        <!-- Preview + Accept -->
        @if (!loading() && !error() && preview()) {
          <div class="bg-white rounded-3xl shadow-xl overflow-hidden">
            <!-- Header -->
            <div class="bg-primary px-8 py-8 text-center">
              <div class="w-16 h-16 rounded-full bg-white/20 mx-auto mb-4 flex items-center justify-center">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </div>
              <h1 class="text-2xl font-bold text-white mb-1">Trip Invite</h1>
              <p class="text-white/80 text-sm">You've been invited to collaborate</p>
            </div>

            <div class="p-8">
              <!-- Trip info -->
              <div class="bg-gray-50 rounded-2xl p-5 mb-6">
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Trip</p>
                <p class="text-xl font-bold text-gray-800">{{ preview()!.trip_title }}</p>
                <p class="text-sm text-gray-500 mt-0.5">{{ preview()!.trip_destination }}</p>
                <div class="flex items-center gap-2 mt-3">
                  <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize"
                    [class]="preview()!.role === 'editor' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'">
                    {{ preview()!.role }}
                  </span>
                  <span class="text-xs text-gray-400">role</span>
                </div>
              </div>

              @if (!isLoggedIn()) {
                <!-- Must log in first -->
                <div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-center">
                  <p class="text-sm text-amber-800 font-semibold mb-1">Log in to accept</p>
                  <p class="text-xs text-amber-700">You need a Travlplanr account to join this trip.</p>
                </div>
                <button (click)="goToLogin()" class="w-full bg-primary hover:bg-primary-hover text-white rounded-xl py-3 font-semibold text-sm transition">
                  Log In / Sign Up
                </button>
              } @else if (!accepted()) {
                <!-- Nickname -->
                <div class="mb-5">
                  <label class="text-sm font-semibold text-gray-700 block mb-1.5">Your trip nickname (optional)</label>
                  <input [(ngModel)]="nickname" type="text" placeholder="e.g. Alex, Dad, Team Lead"
                    class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition"/>
                </div>

                <!-- Actions -->
                <div class="flex gap-3">
                  <button (click)="decline()"
                    [disabled]="processing()"
                    class="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl py-3 text-sm font-semibold transition disabled:opacity-50">
                    Decline
                  </button>
                  <button (click)="accept()"
                    [disabled]="processing()"
                    class="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-xl py-3 text-sm font-semibold transition flex items-center justify-center gap-2">
                    @if (processing()) {
                      <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    }
                    Accept Invite
                  </button>
                </div>
              } @else {
                <!-- Accepted state -->
                <div class="text-center py-4">
                  <div class="w-14 h-14 rounded-full bg-green-100 mx-auto mb-4 flex items-center justify-center">
                    <svg class="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                    </svg>
                  </div>
                  <p class="text-lg font-bold text-gray-800 mb-1">You're in! 🎉</p>
                  <p class="text-sm text-gray-500 mb-6">Opening your trip now…</p>
                  <button (click)="goToTrip()" class="w-full bg-primary hover:bg-primary-hover text-white rounded-xl py-3 font-semibold text-sm transition">
                    View Trip
                  </button>
                </div>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class InvitePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly collab = inject(CollaborationService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly preview = signal<InvitePreview | null>(null);
  readonly processing = signal(false);
  readonly accepted = signal(false);

  nickname = '';
  private _tripId: string | null = null;
  private _token = '';

  readonly isLoggedIn = () => this.auth.isLoggedIn();

  async ngOnInit(): Promise<void> {
    this._token = this.route.snapshot.paramMap.get('token') || '';
    if (!this._token) {
      this.error.set('Invalid invite link');
      this.loading.set(false);
      return;
    }
    try {
      const data = await this.collab.previewInvite(this._token);
      this.preview.set(data);
      this._tripId = data.trip_id;
    } catch (err: any) {
      const e = err as any;
      const msg = apiErrorMessage(e, 'This invite is expired or invalid');
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }

  async accept(): Promise<void> {
    if (!this._token) return;
    this.processing.set(true);
    try {
      const res = await this.collab.acceptInvite(this._token, this.nickname || undefined);
      this._tripId = res.trip_id;
      this.accepted.set(true);
      setTimeout(() => this.goToTrip(), 1500);
    } catch (err: any) {
      const e = err as any;
      this.error.set(apiErrorMessage(e, 'Could not accept invite'));
    } finally {
      this.processing.set(false);
    }
  }

  async decline(): Promise<void> {
    if (!this._token) return;
    this.processing.set(true);
    try {
      await this.collab.declineInvite(this._token);
      this.toast.show('Invite declined', 'success');
      await this.router.navigate(['/']);
    } catch (err: any) {
      const e = err as any;
      this.toast.show(apiErrorMessage(e, 'Could not decline invite'), 'error');
      await this.router.navigate(['/']);
    } finally {
      this.processing.set(false);
    }
  }

  goToTrip(): void {
    if (this._tripId) {
      void this.router.navigate(['/itinerary', this._tripId]);
    }
  }

  goHome(): void {
    void this.router.navigate(['/']);
  }

  goToLogin(): void {
    void this.router.navigate(['/login'], {
      queryParams: { returnUrl: this.router.url },
    });
  }
}
