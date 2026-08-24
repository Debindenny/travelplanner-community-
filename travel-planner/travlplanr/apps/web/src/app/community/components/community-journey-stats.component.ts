import { Component } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-community-journey-stats',
  imports: [TranslatePipe],
  template: `
    <div class="pt-4 border-t border-slate-100 dark:border-gray-700 flex flex-col gap-3 font-manrope">
      <div class="flex items-center gap-3.5">
        <span class="relative w-16 h-16 rounded-full shrink-0" [style.background]="ringBackground">
          <span class="absolute inset-[6px] rounded-full bg-white dark:bg-gray-800 flex flex-col items-center justify-center leading-[1.1]">
            <span class="text-[14px] font-extrabold text-text-primary">{{ xpPercent }}%</span>
            <span class="text-[8px] font-extrabold tracking-[0.06em] text-text-faint">LV.1</span>
          </span>
        </span>
        <div class="flex-1 min-w-0 flex flex-col gap-[3px]">
          <span class="text-[10.5px] font-extrabold tracking-[0.1em] text-text-faint uppercase">{{ 'COMMUNITY.HOME_SUBNAV.JOURNEY_LABEL' | translate }}</span>
          <span class="text-[15px] font-extrabold text-text-primary">{{ 'COMMUNITY.HOME_SUBNAV.JOURNEY_TITLE' | translate }}</span>
          <span class="text-[11.5px] font-semibold text-text-faint">{{ 'COMMUNITY.HOME_SUBNAV.JOURNEY_NEXT_LEVEL' | translate: { xp: xpToNext } }}</span>
        </div>
      </div>

      <div class="h-[6px] rounded-full dark:bg-gray-700 overflow-hidden mt-[2px] community-journey-track">
        <div class="h-full rounded-full community-journey-fill" [style.width.%]="xpPercent"></div>
      </div>

      <div class="grid grid-cols-2 gap-x-6 gap-y-4 pt-[14px] mt-1 border-t border-slate-100 dark:border-gray-700">
        @for (stat of stats; track stat.labelKey) {
          <div class="flex flex-col gap-0.5">
            <span class="text-xl font-extrabold text-text-primary">{{ stat.value }}</span>
            <span class="text-[11px] font-bold text-text-faint">{{ stat.labelKey | translate }}</span>
          </div>
        }
      </div>
    </div>
  `,
})
export class CommunityJourneyStatsComponent {
  readonly xpPercent = 34;
  readonly xpToNext = 200;
  readonly ringBackground = `conic-gradient(#0060EA 0turn ${this.xpPercent / 100}turn, #EEF1F6 ${this.xpPercent / 100}turn 1turn)`;

  readonly stats = [
    { value: 14, labelKey: 'COMMUNITY.HOME_SUBNAV.STAT_COUNTRIES' },
    { value: 6, labelKey: 'COMMUNITY.HOME_SUBNAV.STAT_TRIPS' },
    { value: 132, labelKey: 'COMMUNITY.HOME_SUBNAV.STAT_FOLLOWERS' },
    { value: 48, labelKey: 'COMMUNITY.HOME_SUBNAV.STAT_HELPFUL' },
  ];
}
