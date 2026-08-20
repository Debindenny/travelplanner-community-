import { Component, inject } from '@angular/core';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ToastService } from '../../shared/utils/toast.service';

interface TrendingSpot {
  title: string;
  meta: string;
  gradient: string;
}

const MOCK_TRENDING: TrendingSpot[] = [
  { title: 'Eiffel Tower sunset reservations', meta: '46 tips this week', gradient: 'linear-gradient(140deg,#0060EA,#4B2A63)' },
  { title: 'Louvre late-night opening', meta: '31 travelers discussing', gradient: 'linear-gradient(140deg,#F2B872,#D2604B)' },
  { title: 'Montmartre food walks', meta: '18 saved routes', gradient: 'linear-gradient(140deg,#0F9D58,#2AA98B)' },
];

@Component({
  selector: 'app-community-destination-trending',
  imports: [TranslatePipe],
  template: `
    <div class="bg-white dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl shadow-[0_1px_2px_rgba(11,18,32,0.04),0_8px_24px_rgba(11,18,32,0.05)] p-4">
      <div class="flex items-center justify-between mb-3">
        <span class="text-[10.5px] font-extrabold tracking-[0.1em] text-text-faint uppercase">{{ 'COMMUNITY.HOME_SIDEBAR.TRENDING_TITLE' | translate }}</span>
        <span class="text-[11px] font-extrabold text-primary">{{ destination }}</span>
      </div>
      <div class="flex flex-col gap-1">
        @for (spot of spots; track spot.title) {
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
export class CommunityDestinationTrendingComponent {
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  readonly destination = 'Paris';
  readonly spots = MOCK_TRENDING;

  open(spot: TrendingSpot): void {
    this.toast.success(this.translate.instant('COMMUNITY.HOME_SIDEBAR.TRENDING_OPENED', { title: spot.title }));
  }
}
