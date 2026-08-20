import { Component, inject, signal } from '@angular/core';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ToastService } from '../../shared/utils/toast.service';

interface RailTraveler {
  id: string;
  name: string;
  line: string;
  initial: string;
  gradient: string;
}

const MOCK_TRAVELERS: RailTraveler[] = [
  { id: 't1', name: 'Priya Nair', line: 'Paris · Jun 3–8 · 88% match', initial: 'P', gradient: 'linear-gradient(140deg,#0060EA,#4B2A63)' },
  { id: 't2', name: 'Marco Villa', line: 'Paris · Jun 1–6 · 74% match', initial: 'M', gradient: 'linear-gradient(140deg,#0F9D58,#2AA98B)' },
  { id: 't3', name: 'Emma Ross', line: 'Paris · Jun 4–11 · 69% match', initial: 'E', gradient: 'linear-gradient(140deg,#F2B872,#D2604B)' },
];

@Component({
  selector: 'app-community-travelers-rail',
  imports: [TranslatePipe],
  template: `
    <div class="bg-white dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl shadow-[0_1px_2px_rgba(11,18,32,0.04),0_8px_24px_rgba(11,18,32,0.05)] p-4">
      <span class="block text-[10.5px] font-extrabold tracking-[0.1em] text-text-faint uppercase mb-3">{{ 'COMMUNITY.HOME_SIDEBAR.TRAVELERS_RAIL_TITLE' | translate }}</span>
      <div class="flex flex-col gap-3">
        @for (traveler of travelers(); track traveler.id) {
          <div class="flex items-center gap-2.5">
            <span class="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-extrabold" [style.background]="traveler.gradient">{{ traveler.initial }}</span>
            <div class="flex-1 min-w-0 flex flex-col">
              <span class="text-[13px] font-bold text-text-primary truncate">{{ traveler.name }}</span>
              <span class="text-[11.5px] font-semibold text-text-faint truncate">{{ traveler.line }}</span>
            </div>
            <button
              (click)="toggleFollow(traveler)"
              class="h-8 px-3 rounded-lg text-[11px] font-extrabold whitespace-nowrap border transition-colors shrink-0"
              [class.border-primary]="!followedIds().has(traveler.id)"
              [class.text-primary]="!followedIds().has(traveler.id)"
              [class.bg-white]="!followedIds().has(traveler.id)"
              [class.border-slate-200]="followedIds().has(traveler.id)"
              [class.dark:border-gray-700]="followedIds().has(traveler.id)"
              [class.bg-slate-50]="followedIds().has(traveler.id)"
              [class.text-text-faint]="followedIds().has(traveler.id)"
            >
              {{ (followedIds().has(traveler.id) ? 'COMMUNITY.FOLLOWING' : 'COMMUNITY.POST_CARD.FOLLOW') | translate }}
            </button>
          </div>
        }
      </div>
    </div>
  `,
})
export class CommunityTravelersRailComponent {
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  readonly travelers = signal<RailTraveler[]>(MOCK_TRAVELERS);
  readonly followedIds = signal<ReadonlySet<string>>(new Set());

  toggleFollow(traveler: RailTraveler): void {
    const next = new Set(this.followedIds());
    const wasFollowing = next.has(traveler.id);
    wasFollowing ? next.delete(traveler.id) : next.add(traveler.id);
    this.followedIds.set(next);
    this.toast.success(
      wasFollowing
        ? this.translate.instant('COMMUNITY.HOME_SIDEBAR.TOAST_UNFOLLOWED', { name: traveler.name })
        : this.translate.instant('COMMUNITY.HOME_SIDEBAR.TOAST_FOLLOWED', { name: traveler.name }),
    );
  }
}
