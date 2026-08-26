import { Component, OnInit, Output, EventEmitter, inject, signal } from '@angular/core';

import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../auth/auth.service';
import { CommunityEventsService } from '../services/community-events.service';
import { CommunityCollectionService } from '../services/community-collection.service';

interface SubnavItem {
  label: string;
  route: string | any[];
  exact: boolean;
  icon: string[];
  count?: () => number | null;
}

@Component({
  selector: 'app-community-home-subnav',
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  template: `
    <div class="font-[inherit]">
      <button
        type="button"
        (click)="sharePost.emit()"
        class="w-full flex items-center justify-center gap-2 min-h-11 py-2.5 px-2 text-center rounded-xl bg-primary hover:bg-primary-hover text-white text-[13px] font-bold shadow-[0_8px_20px_rgba(0,96,234,0.22)] transition-colors focus:outline-none"
      >
        <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
        {{ 'COMMUNITY.HOME_SUBNAV.SHARE' | translate }}
      </button>

      <nav class="mt-5 flex flex-col gap-[3px]">
        @for (item of items; track item.label) {
          <a
            [routerLink]="item.route"
            routerLinkActive="bg-primary-subtle text-primary font-bold"
            [routerLinkActiveOptions]="{ exact: item.exact }"
            class="flex items-center gap-3 h-[42px] min-w-0 px-3 rounded-[11px] text-[14.5px] font-bold text-eventText-mid transition-colors community-sidebar-item"
          >
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              @for (d of item.icon; track d) {
                <path [attr.d]="d"/>
              }
            </svg>
            <span class="flex-1 min-w-0 truncate text-left">{{ item.label | translate }}</span>
            @if (item.count && item.count(); as count) {
              <span class="h-5 min-w-5 px-1.5 rounded-full dark:bg-gray-700 text-[10.5px] font-semibold text-text-faint flex items-center justify-center community-sidebar-count">{{ count }}</span>
            }
          </a>
        }
      </nav>
    </div>
  `,
})
export class CommunityHomeSubnavComponent implements OnInit {
  @Output() sharePost = new EventEmitter<void>();

  private readonly auth = inject(AuthService);
  private readonly eventsService = inject(CommunityEventsService);
  private readonly collectionService = inject(CommunityCollectionService);

  private readonly eventsCount = signal<number | null>(null);
  private readonly savedCount = signal<number | null>(null);

  readonly items: SubnavItem[] = [
    { label: 'COMMUNITY.HOME_SUBNAV.HOME', route: '/community', exact: true, icon: ['M15 21v-8H9v8', 'M3 10.2V19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8.8a2 2 0 0 0-.7-1.5l-7-6a2 2 0 0 0-2.6 0l-7 6a2 2 0 0 0-.7 1.5Z'] },
    { label: 'COMMUNITY.HOME_SUBNAV.DISCOVER', route: '/community/discover', exact: false, icon: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'm16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12Z'] },
    { label: 'COMMUNITY.HOME_SUBNAV.DESTINATIONS', route: '/explore', exact: false, icon: ['M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z', 'M12 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z'] },
    { label: 'COMMUNITY.HOME_SUBNAV.TRIPS', route: '/community/trips', exact: false, icon: ['M6.5 6.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z', 'M17.5 22.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z', 'M6.5 6.5h7a4 4 0 0 1 0 8h-4a4 4 0 0 0 0 8h8'] },
    { label: 'COMMUNITY.HOME_SUBNAV.TRAVEL_CIRCLES', route: '/community/travel-circles', exact: false, icon: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'] },
    { label: 'COMMUNITY.HOME_SUBNAV.EVENTS', route: '/community/events', exact: false, icon: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M21 14V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7', 'm16 20 2 2 4-4'], count: () => this.eventsCount() },
    { label: 'COMMUNITY.HOME_SUBNAV.SAVED', route: '/community/saved', exact: false, icon: ['m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z'], count: () => this.savedCount() },
  ];

  ngOnInit(): void {
    if (!this.auth.user()) {
      return;
    }
    this.eventsService.getEvents(20, 0).subscribe({
      next: (res) => this.eventsCount.set(res.meetups?.length || null),
      error: () => {},
    });
    this.collectionService.getCollections().subscribe({
      next: (collections) => this.savedCount.set(collections?.length || null),
      error: () => {},
    });
  }
}
