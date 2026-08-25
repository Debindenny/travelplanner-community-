import { Component, OnInit, Output, EventEmitter, inject, signal } from '@angular/core';

import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../../auth/auth.service';
import { CommunityEventsService } from '../../services/community-events.service';
import { DiscoverSavedStore } from '../discover-saved.store';

interface SubnavItem {
  label: string;
  route: string | any[];
  exact: boolean;
  icon: string[];
  count?: () => number | null;
}

/**
 * Discover/Saved-only copy of the Community Home sidebar nav — kept separate
 * from `CommunityHomeSubnavComponent` so styling here can be tuned to match
 * `Community Home.dc.html` precisely without touching the Home page itself.
 */
@Component({
  selector: 'app-ds-community-subnav',
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  template: `
    <div class="ds-subnav">
      <button
        type="button"
        (click)="sharePost.emit()"
        class="ds-subnav__share"
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
        {{ 'COMMUNITY.HOME_SUBNAV.SHARE' | translate }}
      </button>

      <nav class="ds-subnav__nav">
        @for (item of items; track item.label) {
          <a
            [routerLink]="item.route"
            routerLinkActive
            #rla="routerLinkActive"
            [routerLinkActiveOptions]="{ exact: item.exact }"
            class="ds-subnav__item"
            [class.ds-subnav__item--active]="rla.isActive"
          >
            <span class="ds-subnav__icon-wrap">
              <svg width="16" height="16" fill="none" [attr.stroke]="rla.isActive ? '#0060EA' : '#8B94A3'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                @for (d of item.icon; track d) {
                  <path [attr.d]="d"/>
                }
              </svg>
            </span>
            <span class="ds-subnav__label">{{ item.label | translate }}</span>
            @if (item.count && item.count(); as count) {
              <span class="ds-subnav__count" [class.ds-subnav__count--active]="rla.isActive">{{ count }}</span>
            }
          </a>
        }
      </nav>
    </div>
  `,
  styles: [`
    .ds-subnav {
      font-family: Manrope, ui-sans-serif, system-ui, sans-serif;
    }

    .ds-subnav__share {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: 44px;
      border: 0;
      border-radius: 12px;
      background: #0060ea;
      color: #fff;
      font-family: inherit;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 8px 20px rgba(0, 96, 234, 0.22);
      transition: background 0.15s ease;
    }

    .ds-subnav__share:hover {
      background: #0052c8;
    }

    .ds-subnav__nav {
      margin-top: 20px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .ds-subnav__item {
      display: flex;
      align-items: center;
      gap: 12px;
      height: 42px;
      padding: 0 12px;
      border-radius: 11px;
      font-size: 13.5px;
      font-weight: 650;
      color: #5a6472;
      text-decoration: none;
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease;
    }

    .ds-subnav__item:hover {
      background: #f4f7fb;
    }

    .ds-subnav__item--active {
      background: #eaf1fe;
      color: #0060ea;
      font-weight: 800;
    }

    .ds-subnav__icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      flex: none;
    }

    .ds-subnav__label {
      flex: 1;
      text-align: left;
    }

    .ds-subnav__count {
      height: 20px;
      min-width: 20px;
      padding: 0 6px;
      border-radius: 999px;
      font-size: 10.5px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f2f4f7;
      color: #8b94a3;
    }

    .ds-subnav__count--active {
      background: #dce9ff;
      color: #0060ea;
    }
  `],
})
export class DsCommunitySubnavComponent implements OnInit {
  @Output() sharePost = new EventEmitter<void>();

  private readonly auth = inject(AuthService);
  private readonly eventsService = inject(CommunityEventsService);
  private readonly store = inject(DiscoverSavedStore);

  private readonly eventsCount = signal<number | null>(null);

  readonly items: SubnavItem[] = [
    { label: 'COMMUNITY.HOME_SUBNAV.HOME', route: '/community', exact: true, icon: ['M15 21v-8H9v8', 'M3 10.2V19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8.8a2 2 0 0 0-.7-1.5l-7-6a2 2 0 0 0-2.6 0l-7 6a2 2 0 0 0-.7 1.5Z'] },
    { label: 'COMMUNITY.HOME_SUBNAV.DISCOVER', route: '/community/discover', exact: false, icon: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'm16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12Z'] },
    { label: 'COMMUNITY.HOME_SUBNAV.DESTINATIONS', route: '/explore', exact: false, icon: ['M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z', 'M12 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z'] },
    { label: 'COMMUNITY.HOME_SUBNAV.TRIPS', route: '/community/trips', exact: false, icon: ['M6.5 6.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z', 'M17.5 22.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z', 'M6.5 6.5h7a4 4 0 0 1 0 8h-4a4 4 0 0 0 0 8h8'] },
    { label: 'COMMUNITY.HOME_SUBNAV.TRAVEL_CIRCLES', route: '/community/travel-circles', exact: false, icon: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'] },
    { label: 'COMMUNITY.HOME_SUBNAV.EVENTS', route: '/community/events', exact: false, icon: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M21 14V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7', 'm16 20 2 2 4-4'], count: () => this.eventsCount() },
    { label: 'COMMUNITY.HOME_SUBNAV.SAVED', route: '/community/saved', exact: false, icon: ['m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z'], count: () => this.store.savedItemCount() },
  ];

  ngOnInit(): void {
    if (!this.auth.user()) {
      return;
    }
    this.eventsService.getEvents(20, 0).subscribe({
      next: (res) => this.eventsCount.set(res.meetups?.length || null),
      error: () => {},
    });
    this.store.loadSaved();
  }
}
