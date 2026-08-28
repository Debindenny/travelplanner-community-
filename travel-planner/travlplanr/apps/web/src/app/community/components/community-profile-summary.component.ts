import { Component, Input } from '@angular/core';

import { RouterLink } from '@angular/router';
import { MyCommunityProfile } from '../services/community-profile.service';

@Component({
  selector: 'app-community-profile-summary',
  imports: [RouterLink],
  template: `
    @if (profile) {
      <a
        [routerLink]="userId ? ['/community/users', userId] : ['/community']"
        class="flex items-center gap-3 px-3 py-3 rounded-[11px] border-t border-slate-100 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <img
          [src]="profile.avatar || '/assets/images/default-avatar.svg'"
          class="w-10 h-10 rounded-full object-cover shrink-0 bg-slate-100"
          alt=""
        />
        <div class="flex-1 min-w-0">
          <p class="text-[13.5px] font-bold text-text-primary truncate">{{ profile.name }}</p>
          @if (profile.bio) {
            <p class="text-[11.5px] font-semibold text-eventText-mid truncate">{{ profile.bio }}</p>
          }
        </div>
      </a>
    } @else if (userId) {
      <!-- Signed-in user, profile still in flight: hold the row's height so the
           sidebar doesn't jump once it arrives. -->
      <div class="flex items-center gap-3 px-3 py-3 rounded-[11px] border-t border-slate-100 dark:border-gray-700 animate-pulse" aria-hidden="true">
        <span class="w-10 h-10 rounded-full bg-slate-200 dark:bg-gray-700 shrink-0"></span>
        <div class="flex-1 min-w-0 flex flex-col gap-1.5">
          <span class="h-3 w-24 rounded-full bg-slate-200 dark:bg-gray-700"></span>
          <span class="h-2.5 w-16 rounded-full bg-slate-200 dark:bg-gray-700"></span>
        </div>
      </div>
    }
  `,
})
export class CommunityProfileSummaryComponent {
  @Input() profile: MyCommunityProfile | null = null;
  @Input() userId: string | null = null;
}
