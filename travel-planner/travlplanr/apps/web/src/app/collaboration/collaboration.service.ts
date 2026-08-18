import { Injectable, signal, inject, DOCUMENT } from '@angular/core';

import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { apiUrl } from '../shared/utils/api-url';

export interface Collaborator {
  id: string;
  user_id: string | null;
  email: string;
  display_name: string;
  role: 'owner' | 'editor' | 'viewer';
  status: 'pending' | 'active' | 'declined' | 'removed';
  invited_at: string | null;
  accepted_at: string | null;
}

export interface ActivityEntry {
  id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  summary: string;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface Expense {
  id: string;
  description: string;
  category: string | null;
  amount_cents: number;
  currency: string;
  paid_by: string;
  split_method: string;
  settled: boolean;
  created_at: string;
  shares: { user_id: string; share_cents: number }[];
}

export interface Settlement {
  from: string;
  to: string;
  amount_cents: number;
}

export interface TripComment {
  id: string;
  segment_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

export interface InvitePreview {
  trip_id: string;
  trip_title: string;
  trip_destination: string;
  role: string;
  invitee_email: string;
  expires_at: string;
}

@Injectable({ providedIn: 'root' })
export class CollaborationService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);

  // -- Per-trip collaboration state (refreshed when trip changes) -----------
  readonly collaborators = signal<Collaborator[]>([]);
  readonly activity = signal<ActivityEntry[]>([]);
  readonly expenses = signal<Expense[]>([]);
  readonly balances = signal<Settlement[]>([]);

  private _currentTripId: string | null = null;
  private _pollHandle: ReturnType<typeof setInterval> | null = null;

  /** Load all collaboration state for a trip and start polling activity. */
  async loadForTrip(tripId: string): Promise<void> {
    this._currentTripId = tripId;
    await Promise.allSettled([
      this.refreshCollaborators(tripId),
      this.refreshActivity(tripId),
      this.refreshExpenses(tripId),
    ]);
    this._startPolling(tripId);
  }

  stopPolling(): void {
    if (this._pollHandle) {
      clearInterval(this._pollHandle);
      this._pollHandle = null;
    }
  }

  private _startPolling(tripId: string): void {
    this.stopPolling();
    this._pollHandle = setInterval(() => {
      if (this.document.visibilityState !== 'hidden') {
        void this.refreshActivity(tripId);
        void this.refreshCollaborators(tripId);
      }
    }, 10_000);
  }

  async refreshCollaborators(tripId: string): Promise<void> {
    try {
      const data = await firstValueFrom(
        this.http.get<Collaborator[]>(apiUrl(`/trips/${tripId}/collaborators`))
      );
      this.collaborators.set(data);
    } catch { /* viewer fallback — not a collaborator yet */ }
  }

  async refreshActivity(tripId: string): Promise<void> {
    try {
      const data = await firstValueFrom(
        this.http.get<ActivityEntry[]>(apiUrl(`/trips/${tripId}/activity`))
      );
      this.activity.set(data);
    } catch { /* no-op — polling */ }
  }

  async refreshExpenses(tripId: string): Promise<void> {
    try {
      const expenses = await firstValueFrom(
        this.http.get<Expense[]>(apiUrl(`/trips/${tripId}/expenses`))
      );
      this.expenses.set(expenses);
      const balancesData = await firstValueFrom(
        this.http.get<{ settlements: Settlement[] }>(apiUrl(`/trips/${tripId}/expenses/balances`))
      );
      this.balances.set(balancesData.settlements);
    } catch { /* trip not confirmed yet — expenses locked */ }
  }

  // ---- Invite -----------------------------------------------------------
  async invite(tripId: string, email: string, role: string, nickname?: string): Promise<{ token: string }> {
    const res = await firstValueFrom(
      this.http.post<{ status: string; token: string; email: string }>(
        apiUrl(`/trips/${tripId}/invites`),
        { email, role, nickname }
      )
    );
    await this.refreshCollaborators(tripId);
    return res;
  }

  async removeCollaborator(tripId: string, userId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(apiUrl(`/trips/${tripId}/collaborators/${userId}`))
    );
    await this.refreshCollaborators(tripId);
  }

  async updateRole(tripId: string, userId: string, role: string): Promise<void> {
    await firstValueFrom(
      this.http.patch(apiUrl(`/trips/${tripId}/collaborators/${userId}`), { role })
    );
    await this.refreshCollaborators(tripId);
  }

  async transferOwnership(tripId: string, newOwnerUserId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(apiUrl(`/trips/${tripId}/transfer-ownership`), { new_owner_user_id: newOwnerUserId })
    );
    await this.refreshCollaborators(tripId);
  }

  // ---- Invite token flow ------------------------------------------------
  async previewInvite(token: string): Promise<InvitePreview> {
    return firstValueFrom(
      this.http.get<InvitePreview>(apiUrl(`/trips/invites/${token}`))
    );
  }

  async acceptInvite(token: string, nickname?: string): Promise<{ trip_id: string; role: string }> {
    return firstValueFrom(
      this.http.post<{ status: string; trip_id: string; role: string }>(
        apiUrl(`/trips/invites/${token}/accept`),
        { nickname: nickname || null }
      )
    );
  }

  async declineInvite(token: string): Promise<void> {
    await firstValueFrom(
      this.http.post(apiUrl(`/trips/invites/${token}/decline`), {})
    );
  }

  // ---- Confirm & Split --------------------------------------------------
  async confirmTrip(tripId: string): Promise<void> {
    await firstValueFrom(this.http.post(apiUrl(`/trips/${tripId}/confirm`), {}));
  }

  async addExpense(tripId: string, data: {
    description: string;
    category?: string;
    amount_cents: number;
    currency: string;
    paid_by: string;
    split_method: string;
    custom_shares?: Record<string, number>;
    percentage_shares?: Record<string, number>;
  }): Promise<void> {
    await firstValueFrom(this.http.post(apiUrl(`/trips/${tripId}/expenses`), data));
    await this.refreshExpenses(tripId);
  }

  async settleExpense(tripId: string, expenseId: string): Promise<void> {
    await firstValueFrom(this.http.post(apiUrl(`/trips/${tripId}/expenses/${expenseId}/settle`), {}));
    await this.refreshExpenses(tripId);
  }

  async deleteExpense(tripId: string, expenseId: string): Promise<void> {
    await firstValueFrom(this.http.delete(apiUrl(`/trips/${tripId}/expenses/${expenseId}`)));
    await this.refreshExpenses(tripId);
  }

  async getComments(tripId: string, segmentId: string): Promise<TripComment[]> {
    return firstValueFrom(
      this.http.get<TripComment[]>(apiUrl(`/trips/${tripId}/comments?segment_id=${encodeURIComponent(segmentId)}`))
    );
  }

  async addComment(tripId: string, segmentId: string, body: string): Promise<TripComment> {
    return firstValueFrom(
      this.http.post<TripComment>(apiUrl(`/trips/${tripId}/comments`), { segment_id: segmentId, body })
    );
  }

  async deleteComment(tripId: string, commentId: string): Promise<void> {
    await firstValueFrom(this.http.delete(apiUrl(`/trips/${tripId}/comments/${commentId}`)));
  }
}
