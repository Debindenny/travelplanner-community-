import {
  Component, inject, signal, model, Output, EventEmitter, OnInit, OnDestroy, computed,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { CollaborationService, Collaborator } from '../../collaboration.service';
import { ToastService } from '../../../shared/utils/toast.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.util';

@Component({
    selector: 'app-share-panel',
    imports: [FormsModule, A11yModule],
    template: `
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-end"
         (click)="close.emit()"
         (window:keydown.escape)="close.emit()">
      <!-- Panel -->
      <div class="h-full w-full max-w-[420px] bg-white shadow-2xl flex flex-col overflow-hidden"
           role="dialog" aria-modal="true" aria-labelledby="dialog-title"
           cdkTrapFocus cdkTrapFocusAutoCapture
           (click)="$event.stopPropagation()">

        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-primary">
          <div class="flex items-center gap-3">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <h2 id="dialog-title" class="text-lg font-semibold text-white">Collaborate</h2>
          </div>
          <button (click)="close.emit()" class="text-white/80 hover:text-white transition-colors p-1 rounded">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Tabs -->
        <div class="flex border-b border-gray-100" role="tablist" aria-label="Collaboration settings">
          @for (tab of tabs; track tab.id) {
            <button
              role="tab"
              [attr.aria-selected]="activeTab() === tab.id"
              [attr.aria-controls]="'tabpanel-' + tab.id"
              (click)="activeTab.set(tab.id)"
              [class]="activeTab() === tab.id
                ? 'flex-1 py-3 text-sm font-semibold text-primary border-b-2 border-primary transition-all'
                : 'flex-1 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 transition-all'"
            >{{ tab.label }}</button>
          }
        </div>

        <!-- Tab: Members -->
        @if (activeTab() === 'members') {
          <div id="tabpanel-members" role="tabpanel" class="flex-1 overflow-y-auto">
            <!-- Invite Form -->
            @if (myRole() === 'owner' || myRole() === 'editor') {
              <div class="p-5 border-b border-gray-50">
                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Invite by email</p>
                <div class="flex flex-col gap-3">
                  <input
                    [(ngModel)]="inviteEmail"
                    type="email"
                    placeholder="colleague@example.com"
                    class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                    (keydown.enter)="sendInvite()"
                  />
                  <div class="flex gap-2">
                    <select [(ngModel)]="inviteRole"
                      class="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition">
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                    <button
                      (click)="sendInvite()"
                      [disabled]="inviting()"
                      class="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-all flex items-center justify-center gap-2"
                    >
                      @if (inviting()) {
                        <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                      } @else {
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                        </svg>
                      }
                      Invite
                    </button>
                  </div>
                </div>
              </div>
            }

            <!-- Members list -->
            <div class="p-5 flex flex-col gap-3">
              <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Members ({{ collaborators().length }})
              </p>
              @for (member of collaborators(); track member.id) {
                <div class="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                  <!-- Avatar -->
                  <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                       [style.background]="avatarColor(member.email)">
                    {{ avatarInitial(member.display_name || member.email) }}
                  </div>
                  <!-- Info -->
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-gray-800 truncate">{{ member.display_name || member.email }}</p>
                    <p class="text-xs text-gray-500 truncate">{{ member.email }}</p>
                  </div>
                  <!-- Role/Status pill -->
                  <div class="flex flex-col items-end gap-1 shrink-0">
                    <span [class]="rolePillClass(member.role)" class="px-2 py-0.5 rounded-full text-xs font-semibold capitalize">
                      {{ member.role }}
                    </span>
                    <span [class]="statusPillClass(member.status)" class="px-2 py-0.5 rounded-full text-xs capitalize">
                      {{ member.status }}
                    </span>
                  </div>
                  <!-- Remove button (owner only, can't remove self-owner) -->
                  @if (myRole() === 'owner' && member.role !== 'owner' && member.status === 'active') {
                    <button (click)="removeMember(member)"
                      class="text-red-400 hover:text-red-600 transition-colors p-1 rounded shrink-0">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  }
                </div>
              }

              @if (collaborators().length === 0) {
                <div class="text-center py-8 text-gray-400">
                  <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  <p class="text-sm">Invite people to collaborate</p>
                </div>
              }
            </div>
          </div>
        }

        <!-- Tab: Activity -->
        @if (activeTab() === 'activity') {
          <div id="tabpanel-activity" role="tabpanel" class="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
            @for (entry of activity(); track entry.id) {
              <div class="flex gap-3 items-start">
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
                     [style.background]="avatarColor(entry.actor_name)">
                  {{ avatarInitial(entry.actor_name) }}
                </div>
                <div class="flex-1 bg-gray-50 rounded-xl px-3 py-2.5">
                  <p class="text-sm text-gray-700">
                    <span class="font-semibold">{{ entry.actor_name }}</span>
                    {{ ' ' + entry.summary }}
                  </p>
                  <p class="text-xs text-gray-400 mt-1">{{ formatDate(entry.created_at) }}</p>
                </div>
              </div>
            }
            @if (activity().length === 0) {
              <div class="text-center py-12 text-gray-400">
                <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <p class="text-sm">No activity yet</p>
              </div>
            }
          </div>
        }

        <!-- Tab: Split -->
        @if (activeTab() === 'split') {
          <div id="tabpanel-split" role="tabpanel" class="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
            @if (!isConfirmed()) {
              <!-- Confirm CTA -->
              <div class="rounded-2xl bg-amber-50 border border-amber-200 p-5 text-center">
                <svg class="w-10 h-10 mx-auto mb-3 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <p class="text-sm font-semibold text-amber-800 mb-1">Plan not confirmed yet</p>
                <p class="text-xs text-amber-700 mb-4">Confirm the itinerary plan first to unlock expense splitting.</p>
                @if (myRole() === 'owner') {
                  <button (click)="confirmPlan()"
                    [disabled]="confirming()"
                    class="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-semibold transition">
                    {{ confirming() ? 'Confirming…' : 'Confirm Plan' }}
                  </button>
                }
              </div>
            } @else {
              <!-- Add expense form -->
              @if (myRole() === 'owner' || myRole() === 'editor') {
                <div class="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Add Expense</p>
                  <div class="flex flex-col gap-2">
                    <input [(ngModel)]="newExpDesc" placeholder="Description" type="text"
                      class="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-full"/>
                    <div class="flex gap-2">
                      <input [(ngModel)]="newExpAmt" placeholder="Amount" type="number" min="0.01" step="0.01"
                        class="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"/>
                      <select [(ngModel)]="newExpCurrency"
                        class="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                        <option value="INR">INR</option>
                        <option value="AED">AED</option>
                      </select>
                    </div>
                    <select [(ngModel)]="newExpPaidBy"
                      class="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                      <option value="" disabled>Paid by…</option>
                      @for (m of activeMembers(); track m.user_id) {
                        <option [value]="m.user_id">{{ m.display_name }}</option>
                      }
                    </select>
                    <select [(ngModel)]="newExpCategory"
                      class="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                      <option value="">Category…</option>
                      <option value="food">Food</option>
                      <option value="transport">Transport</option>
                      <option value="lodging">Lodging</option>
                      <option value="activities">Activities</option>
                      <option value="other">Other</option>
                    </select>
                    <button (click)="addExpense()"
                      [disabled]="addingExpense()"
                      class="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-xl px-4 py-2 text-sm font-semibold transition">
                      {{ addingExpense() ? 'Adding…' : '+ Add Expense' }}
                    </button>
                  </div>
                </div>
              }

              <!-- Balances -->
              @if (balances().length > 0) {
                <div>
                  <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Who Owes Whom</p>
                  @for (s of balances(); track s.from) {
                    <div class="flex items-center justify-between py-2.5 px-3 rounded-xl bg-red-50 mb-1.5 border border-red-100">
                      <div class="flex items-center gap-2 text-sm text-red-700">
                        <span class="font-semibold">{{ displayName(s.from) }}</span>
                        <svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14m-7-7l7 7-7 7"/>
                        </svg>
                        <span class="font-semibold">{{ displayName(s.to) }}</span>
                      </div>
                      <span class="text-sm font-bold text-red-700">{{ formatCents(s.amount_cents, expenses().length ? expenses()[0].currency : 'USD') }}</span>
                    </div>
                  }
                </div>
              }

              <!-- Expenses list -->
              <div>
                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  All Expenses ({{ expenses().length }})
                </p>
                @for (exp of expenses(); track exp.id) {
                  <div class="rounded-xl border border-gray-100 bg-white p-3.5 mb-2 shadow-sm">
                    <div class="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p class="text-sm font-semibold text-gray-800">{{ exp.description }}</p>
                        <p class="text-xs text-gray-400">Paid by {{ displayName(exp.paid_by) }} · {{ exp.currency }}</p>
                      </div>
                      <div class="text-right shrink-0">
                        <p class="text-base font-bold text-gray-800">{{ formatCents(exp.amount_cents, exp.currency) }}</p>
                        @if (exp.settled) {
                          <span class="text-xs text-green-600 font-semibold">Settled</span>
                        }
                      </div>
                    </div>
                    <!-- Shares -->
                    <div class="flex flex-wrap gap-1.5 mb-2">
                      @for (sh of exp.shares; track sh.user_id) {
                        <span class="px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600">
                          {{ displayName(sh.user_id) }}: {{ formatCents(sh.share_cents, exp.currency) }}
                        </span>
                      }
                    </div>
                    <!-- Actions -->
                    @if (!exp.settled && (myRole() === 'owner' || myRole() === 'editor')) {
                      <div class="flex gap-2">
                        <button (click)="settleExpense(exp.id)"
                          class="text-xs text-green-600 hover:text-green-800 font-semibold transition">Mark Settled</button>
                        <button (click)="deleteExpense(exp.id)"
                          class="text-xs text-red-500 hover:text-red-700 font-semibold transition ml-auto">Delete</button>
                      </div>
                    }
                  </div>
                }
                @if (expenses().length === 0) {
                  <div class="text-center py-8 text-gray-400">
                    <svg class="w-10 h-10 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                        d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
                    </svg>
                    <p class="text-sm">No expenses yet</p>
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>
    </div>
  `
})
export class SharePanelComponent implements OnInit, OnDestroy {
  tripId = model.required<string>();
  isConfirmed = model<boolean>(false);
  myRole = model<'owner' | 'editor' | 'viewer'>('viewer');

  @Output() close = new EventEmitter<void>();

  private readonly collab = inject(CollaborationService);
  private readonly toast = inject(ToastService);

  readonly tabs = [
    { id: 'members', label: 'Members' },
    { id: 'activity', label: 'Activity' },
    { id: 'split', label: 'Split' },
  ] as const;
  readonly activeTab = signal<'members' | 'activity' | 'split'>('members');

  // Form state
  inviteEmail = '';
  inviteRole = 'viewer';
  readonly inviting = signal(false);

  readonly confirming = signal(false);

  newExpDesc = '';
  newExpAmt: number | null = null;
  newExpCurrency = 'USD';
  newExpPaidBy = '';
  newExpCategory = '';
  readonly addingExpense = signal(false);

  // Proxied signals
  readonly collaborators = this.collab.collaborators;
  readonly activity = this.collab.activity;
  readonly expenses = this.collab.expenses;
  readonly balances = this.collab.balances;

  readonly activeMembers = computed(() =>
    this.collaborators().filter(c => c.status === 'active' && c.user_id)
  );

  async ngOnInit(): Promise<void> {
    await this.collab.loadForTrip(this.tripId());
  }

  ngOnDestroy(): void {
    this.collab.stopPolling();
  }

  async sendInvite(): Promise<void> {
    if (!this.inviteEmail.trim()) return;
    this.inviting.set(true);
    try {
      await this.collab.invite(this.tripId(), this.inviteEmail.trim(), this.inviteRole);
      this.toast.show('Invite sent!', 'success');
      this.inviteEmail = '';
    } catch (err: any) {
      const e = err as any;
      this.toast.show(apiErrorMessage(e, 'Failed to send invite'), 'error');
    } finally {
      this.inviting.set(false);
    }
  }

  async removeMember(member: Collaborator): Promise<void> {
    if (!member.user_id) return;
    try {
      await this.collab.removeCollaborator(this.tripId(), member.user_id);
      this.toast.show('Member removed', 'success');
    } catch (err: any) {
      this.toast.show('Could not remove member', 'error');
    }
  }

  async confirmPlan(): Promise<void> {
    this.confirming.set(true);
    try {
      await this.collab.confirmTrip(this.tripId());
      this.isConfirmed.set(true);
      this.toast.show('Plan confirmed! Expense splitting unlocked.', 'success');
    } catch (err: any) {
      this.toast.show('Could not confirm plan', 'error');
    } finally {
      this.confirming.set(false);
    }
  }

  async addExpense(): Promise<void> {
    if (!this.newExpDesc || !this.newExpAmt || !this.newExpPaidBy) {
      this.toast.show('Please fill in description, amount, and who paid', 'error');
      return;
    }
    this.addingExpense.set(true);
    try {
      await this.collab.addExpense(this.tripId(), {
        description: this.newExpDesc,
        category: this.newExpCategory || undefined,
        amount_cents: Math.round(this.newExpAmt * 100),
        currency: this.newExpCurrency,
        paid_by: this.newExpPaidBy,
        split_method: 'equal',
      });
      this.toast.show('Expense added!', 'success');
      this.newExpDesc = '';
      this.newExpAmt = null;
      this.newExpPaidBy = '';
      this.newExpCategory = '';
    } catch (err: any) {
      const e = err as any;
      this.toast.show(apiErrorMessage(e, 'Failed to add expense'), 'error');
    } finally {
      this.addingExpense.set(false);
    }
  }

  async settleExpense(expId: string): Promise<void> {
    try {
      await this.collab.settleExpense(this.tripId(), expId);
      this.toast.show('Marked as settled', 'success');
    } catch (err: any) {
      this.toast.show('Could not settle expense', 'error');
    }
  }

  async deleteExpense(expId: string): Promise<void> {
    try {
      await this.collab.deleteExpense(this.tripId(), expId);
      this.toast.show('Expense deleted', 'success');
    } catch (err: any) {
      this.toast.show('Could not delete expense', 'error');
    }
  }

  displayName(userId: string): string {
    const found = this.collaborators().find((c: Collaborator) => c.user_id === userId);
    return found?.display_name || found?.email?.split('@')[0] || userId.slice(0, 8);
  }

  formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  }

  formatCents(cents: number, currency: string): string {
    const amount = cents / 100;
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  }

  avatarColor(seed: string): string {
    const colors = [
      '#6366f1', '#8b5cf6', '#ec4899', '#10b981',
      '#f59e0b', '#3b82f6', '#ef4444', '#14b8a6',
    ];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  avatarInitial(name: string): string {
    return (name || '?').charAt(0).toUpperCase();
  }

  rolePillClass(role: string): string {
    return role === 'owner' ? 'bg-primary-50 text-primary-hover'
      : role === 'editor' ? 'bg-blue-100 text-blue-700'
      : 'bg-gray-100 text-gray-600';
  }

  statusPillClass(status: string): string {
    return status === 'active' ? 'bg-green-100 text-green-700'
      : status === 'pending' ? 'bg-amber-100 text-amber-700'
      : 'bg-red-100 text-red-600';
  }
}
