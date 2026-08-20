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
  icon: string;
  count?: () => number | null;
}

@Component({
  selector: 'app-community-home-subnav',
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  template: `
    <button
      type="button"
      (click)="sharePost.emit()"
      class="flex items-center justify-center gap-2 h-11 rounded-xl bg-primary hover:bg-primary-hover text-white text-[13px] font-extrabold shadow-[0_8px_20px_rgba(0,96,234,0.22)] transition-colors focus:outline-none"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
      {{ 'COMMUNITY.HOME_SUBNAV.SHARE' | translate }}
    </button>

    <nav class="mt-5 flex flex-col gap-0.5">
      @for (item of items; track item.label) {
        <a
          [routerLink]="item.route"
          routerLinkActive="bg-primary-50 text-primary"
          [routerLinkActiveOptions]="{ exact: item.exact }"
          class="flex items-center gap-3 h-10 px-3 rounded-xl text-[13.5px] font-bold text-text-secondary hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <svg class="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" [attr.d]="item.icon"/></svg>
          <span class="flex-1 text-left">{{ item.label | translate }}</span>
          @if (item.count && item.count(); as count) {
            <span class="h-5 min-w-5 px-1.5 rounded-full bg-slate-100 dark:bg-gray-700 text-[10.5px] font-extrabold text-text-secondary flex items-center justify-center">{{ count }}</span>
          }
        </a>
      }
    </nav>
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
    { label: 'COMMUNITY.HOME_SUBNAV.HOME', route: '/community', exact: true, icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { label: 'COMMUNITY.HOME_SUBNAV.DISCOVER', route: '/explore', exact: false, icon: 'M9 4.5a7.5 7.5 0 105.807 12.257l4.243 4.243a1 1 0 001.414-1.414l-4.243-4.243A7.5 7.5 0 009 4.5zm-5.5 7.5a5.5 5.5 0 1111 0 5.5 5.5 0 01-11 0z' },
    { label: 'COMMUNITY.HOME_SUBNAV.DESTINATIONS', route: '/explore', exact: false, icon: 'M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z' },
    { label: 'COMMUNITY.HOME_SUBNAV.TRIPS', route: '/community/trips', exact: false, icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
    { label: 'COMMUNITY.HOME_SUBNAV.TRAVEL_CIRCLES', route: '/community/travel-circles', exact: false, icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
    { label: 'COMMUNITY.HOME_SUBNAV.EVENTS', route: '/community/events', exact: false, icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', count: () => this.eventsCount() },
    { label: 'COMMUNITY.HOME_SUBNAV.SAVED', route: '/community/collections', exact: false, icon: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z', count: () => this.savedCount() },
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
