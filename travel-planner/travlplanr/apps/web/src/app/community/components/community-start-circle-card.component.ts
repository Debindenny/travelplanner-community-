import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-community-start-circle-card',
  imports: [RouterLink, TranslatePipe],
  template: `
    <div class="bg-white dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl shadow-[0_1px_2px_rgba(11,18,32,0.04),0_8px_24px_rgba(11,18,32,0.05)] p-4 flex flex-col items-center text-center gap-2.5">
      <span class="w-11 h-11 rounded-full bg-primary-50 text-primary flex items-center justify-center">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
      </span>
      <span class="text-[13.5px] font-extrabold text-text-primary">{{ 'COMMUNITY.HOME_SIDEBAR.START_CIRCLE_TITLE' | translate }}</span>
      <p class="text-[12px] font-medium text-text-faint leading-relaxed">{{ 'COMMUNITY.HOME_SIDEBAR.START_CIRCLE_BODY' | translate }}</p>
      <a
        routerLink="/community/travel-circles"
        class="w-full h-9 rounded-xl bg-primary hover:bg-primary-hover text-white text-[12.5px] font-extrabold flex items-center justify-center transition-colors"
      >
        {{ 'COMMUNITY.HOME_SIDEBAR.START_CIRCLE_CTA' | translate }}
      </a>
    </div>
  `,
})
export class CommunityStartCircleCardComponent {}
