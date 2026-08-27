import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ToastService } from '../../shared/utils/toast.service';
import { apiUrl } from '../../shared/utils/api-url';
import { DiscoverItem } from '../discover-saved/discover-saved.models';

interface TrendingSpot {
  title: string;
  meta: string;
  gradient: string;
}

// Purely decorative — the backend has no color field, so we cycle through a
// fixed palette by index rather than fabricate data for it.
const GRADIENTS = [
  'linear-gradient(140deg,#0060EA,#4B2A63)',
  'linear-gradient(140deg,#F2B872,#D2604B)',
  'linear-gradient(140deg,#0F9D58,#2AA98B)',
];

@Component({
  selector: 'app-community-destination-trending',
  imports: [TranslatePipe],
  template: `
    <div class="bg-white dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl shadow-[0_1px_2px_rgba(11,18,32,0.04),0_8px_24px_rgba(11,18,32,0.05)] p-4">
      <div class="flex items-center justify-between mb-3">
        <span class="text-[10.5px] font-extrabold tracking-[0.1em] text-text-faint uppercase">{{ 'COMMUNITY.HOME_SIDEBAR.TRENDING_TITLE' | translate }}</span>
        <span class="text-[11px] font-extrabold text-primary">{{ destination() }}</span>
      </div>
      <div class="flex flex-col gap-1">
        @for (spot of spots(); track spot.title) {
          <button
            (click)="open(spot)"
            class="flex items-center gap-2.5 -mx-2 px-2 py-1.5 rounded-lg text-left hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors focus:outline-none"
          >
            <span class="w-10 h-10 rounded-lg shrink-0" [style.background]="spot.gradient"></span>
            <span class="flex-1 min-w-0 flex flex-col gap-0.5">
              <span class="text-[13px] font-bold text-text-primary truncate">{{ spot.title }}</span>
              <span class="text-[11.5px] font-semibold text-text-faint truncate">{{ spot.meta }}</span>
            </span>
          </button>
        }
      </div>
    </div>
  `,
})
export class CommunityDestinationTrendingComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  readonly destination = signal('');
  readonly spots = signal<TrendingSpot[]>([]);

  ngOnInit(): void {
    this.http
      .get<{ items: DiscoverItem[] }>(apiUrl('/community/discover'), {
        params: { sort: 'Most saved', limit: '3' },
      })
      .subscribe({
        next: ({ items }) => {
          this.destination.set(items[0]?.place ?? '');
          this.spots.set(
            items.map((item, i) => ({
              title: item.title,
              meta: item.used,
              gradient: GRADIENTS[i % GRADIENTS.length],
            }))
          );
        },
        error: () => {
          this.destination.set('');
          this.spots.set([]);
        },
      });
  }

  open(spot: TrendingSpot): void {
    this.toast.success(this.translate.instant('COMMUNITY.HOME_SIDEBAR.TRENDING_OPENED', { title: spot.title }));
  }
}
