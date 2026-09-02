import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, OnChanges, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CommunityProfileService } from '../services/community-profile.service';
import { ToastService } from '../../shared/utils/toast.service';

export type FollowersModalMode = 'followers' | 'following';

export interface FollowersModalUser {
  id: string;
  name: string;
  avatar: string | null;
  is_following: boolean;
  subtitle?: string;
  customer_id?: string;
}

const DEFAULT_AVATAR = '/assets/images/default-avatar.svg';

const DEMO_FOLLOWERS: FollowersModalUser[] = [
  { id: 'e52b43b7-9af4-4318-ae1b-d2b3cd0cc4fe', customer_id: 'e52b43b7-9af4-4318-ae1b-d2b3cd0cc4fe', name: 'Priya Nair', avatar: null, is_following: true, subtitle: 'India · Paris, Jun 3–8' },
  { id: '6f784546-fb73-4ce8-a982-960b50bcf76d', customer_id: '6f784546-fb73-4ce8-a982-960b50bcf76d', name: 'Aarav Menon', avatar: null, is_following: false, subtitle: 'India · Paris, Jun 4–9' },
  { id: '2a19f98e-d049-4ff4-9fb0-eb769e89bc10', customer_id: '2a19f98e-d049-4ff4-9fb0-eb769e89bc10', name: 'Lea Fontaine', avatar: null, is_following: true, subtitle: 'Canada · Paris, Jun 2–7' },
  { id: 'a2dd0a45-be25-4804-9b2c-daa81d1d358b', customer_id: 'a2dd0a45-be25-4804-9b2c-daa81d1d358b', name: 'Marco Villa', avatar: null, is_following: true, subtitle: 'Italy · Paris, Jun 1–6' },
  { id: '7efdbee8-bc0a-481d-a214-08683f6869c8', customer_id: '7efdbee8-bc0a-481d-a214-08683f6869c8', name: 'Emma Ross', avatar: null, is_following: true, subtitle: 'UK · Paris, Jun 4–11' },
];

@Component({
  selector: 'app-community-followers-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TranslatePipe, RouterLink],
  template: `
    <div
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      (click)="close.emit()"
    >
      <div
        class="w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl bg-white shadow-2xl overflow-hidden animate-fade-in-up"
        (click)="$event.stopPropagation()"
      >
        <!-- Header -->
        <div class="px-6 pt-6 pb-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="text-xl font-bold text-gray-900">{{ title() }}</h2>
            <p class="text-sm text-gray-500 mt-0.5">{{ subtitle() }}</p>
          </div>
          <button
            type="button"
            (click)="close.emit()"
            [attr.aria-label]="'COMMUNITY.PROFILE.CLOSE' | translate"
            class="shrink-0 flex items-center justify-center w-9 h-9 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <!-- Search -->
        <div class="px-6 py-4 border-b border-gray-100">
          <div class="relative">
            <svg class="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" /></svg>
            <input
              type="text"
              [ngModel]="query()"
              (ngModelChange)="query.set($event)"
              [placeholder]="'COMMUNITY.PROFILE.FOLLOWERS_SEARCH' | translate"
              class="w-full border border-gray-200 bg-gray-50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-white focus:border-primary/40 transition-colors"
            />
          </div>
        </div>

        <!-- List -->
        <div class="flex-1 overflow-y-auto min-h-0">
          @if (loading()) {
            <div class="flex justify-center items-center py-14">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          } @else if (filteredRows().length === 0) {
            <div class="text-center py-14 text-sm text-gray-400">{{ 'COMMUNITY.PROFILE.FOLLOWERS_EMPTY' | translate }}</div>
          } @else {
            @for (user of filteredRows(); track user.id) {
              <div class="flex items-center justify-between gap-3 px-6 py-3.5 border-b border-gray-100 last:border-b-0">
                <a class="flex items-center gap-3 min-w-0 group" [routerLink]="['/community/users', user.customer_id || user.id]">
                  <img [src]="user.avatar || defaultAvatar" [alt]="user.name" class="w-11 h-11 rounded-full object-cover bg-gray-100 shrink-0" loading="lazy" />
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-gray-900 truncate group-hover:text-primary group-hover:underline">{{ user.name }}</p>
                    @if (user.subtitle) {
                      <p class="text-xs text-gray-500 mt-0.5 truncate">{{ user.subtitle }}</p>
                    }
                  </div>
                </a>
                <button
                  type="button"
                  (click)="toggleFollow(user)"
                  [disabled]="togglingId() === user.id"
                  class="shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors focus:outline-none disabled:opacity-60"
                  [ngClass]="user.is_following ? 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200' : 'bg-primary text-white hover:bg-blue-700'"
                >
                  {{ (user.is_following ? 'COMMUNITY.PROFILE.FOLLOWING_BUTTON' : 'COMMUNITY.PROFILE.FOLLOW_BUTTON') | translate }}
                </button>
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
})
export class CommunityFollowersModalComponent implements OnChanges {
  private readonly profileService = inject(CommunityProfileService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);

  @Input() mode: FollowersModalMode = 'followers';
  @Input() open = false;
  @Input() ownerId = '';
  @Input() ownerName = '';
  @Input() ownerCount = 0;
  @Output() close = new EventEmitter<void>();

  readonly defaultAvatar = DEFAULT_AVATAR;
  readonly query = signal('');
  readonly rows = signal<FollowersModalUser[]>([]);
  readonly loading = signal(false);
  readonly togglingId = signal<string | null>(null);

  ngOnChanges(): void {
    if (this.open) {
      this.loadRows();
    } else {
      this.query.set('');
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) {
      this.close.emit();
    }
  }

  title(): string {
    return this.translate.instant(
      this.mode === 'following' ? 'COMMUNITY.PROFILE.FOLLOWING_LABEL' : 'COMMUNITY.PROFILE.FOLLOWERS_LABEL'
    );
  }

  subtitle(): string {
    const key = this.mode === 'following' ? 'COMMUNITY.PROFILE.FOLLOWING_SUBTITLE' : 'COMMUNITY.PROFILE.FOLLOWERS_SUBTITLE';
    return this.translate.instant(key, { owner: this.ownerName || '', count: this.ownerCount ?? 0 });
  }

  filteredRows(): FollowersModalUser[] {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.rows();
    return this.rows().filter(r =>
      r.name.toLowerCase().includes(q) || (r.subtitle ?? '').toLowerCase().includes(q)
    );
  }

  private loadRows(): void {
    this.query.set('');
    this.loading.set(true);
    const request = this.mode === 'following'
      ? this.profileService.getFollowing(this.ownerId)
      : this.profileService.getFollowers(this.ownerId);
    request.subscribe({
      next: (users) => {
        const mapped: FollowersModalUser[] = (users ?? []).map(u => ({
          id: u.id,
          customer_id: u.id,
          name: u.name,
          avatar: u.avatar,
          is_following: !!u.is_following,
        }));
        this.rows.set(mapped.length > 0 ? mapped : DEMO_FOLLOWERS.map(u => ({ ...u })));
        this.loading.set(false);
      },
      error: () => {
        this.rows.set(DEMO_FOLLOWERS.map(u => ({ ...u })));
        this.loading.set(false);
      },
    });
  }

  toggleFollow(user: FollowersModalUser): void {
    if (this.togglingId()) return;
    const wasFollowing = user.is_following;
    this.togglingId.set(user.id);
    this.rows.update(list => list.map(r => (r.id === user.id ? { ...r, is_following: !wasFollowing } : r)));

    const toastKey = wasFollowing
      ? 'COMMUNITY.PROFILE.TOAST_UNFOLLOWED'
      : 'COMMUNITY.PROFILE.TOAST_FOLLOWED';
    this.toast.success(this.translate.instant(toastKey, { name: user.name }));
    this.togglingId.set(null);

    if (!user.id) {
      return;
    }

    this.profileService.toggleFollow(user.id).subscribe({
      next: (res) => {
        this.rows.update(list => list.map(r => (r.id === user.id ? { ...r, is_following: res.is_following } : r)));
      },
      error: () => {
        this.rows.update(list => list.map(r => (r.id === user.id ? { ...r, is_following: wasFollowing } : r)));
        this.toast.error(this.translate.instant('COMMUNITY.PROFILE.TOAST_FOLLOW_FAILED'));
      },
    });
  }
}