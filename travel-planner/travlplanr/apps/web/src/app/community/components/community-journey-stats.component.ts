import { Component } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-community-journey-stats',
  imports: [TranslatePipe],
  template: `
    <div class="pt-4 mt-4 border-t border-slate-100 dark:border-gray-700 flex flex-col gap-3">
      <div class="flex items-center gap-3">
        <span class="relative w-[52px] h-[52px] rounded-full shrink-0" [style.background]="ringBackground">
          <span class="absolute inset-[4px] rounded-full bg-white dark:bg-gray-800 flex flex-col items-center justify-center leading-none">
            <span class="text-[12.5px] font-extrabold text-text-primary">{{ xpPercent }}%</span>
            <span class="text-[7.5px] font-extrabold tracking-wide text-text-faint">LV.1</span>
          </span>
        </span>
        <div class="flex-1 min-w-0 flex flex-col gap-0.5">
          <span class="text-[9.5px] font-extrabold tracking-[0.12em] text-text-faint uppercase">{{ 'COMMUNITY.HOME_SUBNAV.JOURNEY_LABEL' | translate }}</span>
          <span class="text-sm font-extrabold text-text-primary tracking-tight">{{ 'COMMUNITY.HOME_SUBNAV.JOURNEY_TITLE' | translate }}</span>
          <span class="text-[11px] font-semibold text-text-faint">{{ 'COMMUNITY.HOME_SUBNAV.JOURNEY_NEXT_LEVEL' | translate: { xp: xpToNext } }}</span>
        </div>
      </div>

      <div class="h-[5px] rounded-full bg-slate-100 dark:bg-gray-700 overflow-hidden">
        <div class="h-full rounded-full bg-primary" [style.width.%]="xpPercent"></div>
      </div>

      <div class="grid grid-cols-2 gap-x-2 gap-y-3">
        @for (stat of stats; track stat.labelKey) {
          <div class="flex flex-col gap-0.5">
            <span class="text-[15px] font-extrabold text-text-primary">{{ stat.value }}</span>
            <span class="text-[10px] font-bold text-text-faint">{{ stat.labelKey | translate }}</span>
          </div>
        }
      </div>
    </div>
  `,
})
export class CommunityJourneyStatsComponent {
  readonly xpPercent = 34;
  readonly xpToNext = 200;
  readonly ringBackground = `conic-gradient(#0060EA ${this.xpPercent * 3.6}deg, #EEF1F6 0deg)`;

  readonly stats = [
    { value: 14, labelKey: 'COMMUNITY.HOME_SUBNAV.STAT_COUNTRIES' },
    { value: 6, labelKey: 'COMMUNITY.HOME_SUBNAV.STAT_TRIPS' },
    { value: 132, labelKey: 'COMMUNITY.HOME_SUBNAV.STAT_FOLLOWERS' },
    { value: 48, labelKey: 'COMMUNITY.HOME_SUBNAV.STAT_HELPFUL' },
  ];
}
