import { Component, inject, signal } from '@angular/core';

import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ToastService } from '../../shared/utils/toast.service';

@Component({
  selector: 'app-community-crew-widget',
  imports: [RouterLink, TranslatePipe],
  template: `
    @if (!joined()) {
      <div class="bg-white dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl shadow-[0_1px_2px_rgba(11,18,32,0.04),0_8px_24px_rgba(11,18,32,0.05)] overflow-hidden">
        <div class="px-[18px] py-4 border-b border-slate-100 dark:border-gray-700 flex items-center gap-2.5">
          <span class="w-9 h-9 rounded-xl bg-primary-50 text-primary flex items-center justify-center shrink-0">
            <svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
          </span>
          <div class="flex-1 min-w-0 flex flex-col gap-0.5">
            <span class="text-[13.5px] font-extrabold text-text-primary tracking-tight">{{ 'COMMUNITY.HOME_SIDEBAR.CREW_TITLE' | translate }}</span>
            <span class="text-[11.5px] font-semibold text-text-faint">{{ 'COMMUNITY.HOME_SIDEBAR.CREW_SUBTITLE' | translate }}</span>
          </div>
        </div>

        <div class="px-[18px] py-4 flex flex-col gap-3.5">
          @if (hasInvite()) {
            <div class="flex items-center gap-2.5 p-3 rounded-xl border border-primary-subtle/50 bg-primary-50/40">
              <img src="/assets/images/default-avatar.svg" class="w-9 h-9 rounded-full shrink-0 bg-slate-100" alt="" />
              <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                <span class="text-[12.5px] font-extrabold text-text-primary">{{ 'COMMUNITY.HOME_SIDEBAR.CREW_INVITED_BY' | translate: { name: inviterName } }}</span>
                <span class="text-[11px] font-semibold text-text-faint">{{ 'COMMUNITY.HOME_SIDEBAR.CREW_INVITE_NOTE' | translate }}</span>
              </div>
            </div>
            <div class="flex gap-2">
              <button (click)="acceptInvite()" class="flex-1 h-[38px] rounded-xl bg-primary hover:bg-primary-hover text-white text-[12.5px] font-extrabold transition-colors">
                {{ 'COMMUNITY.HOME_SIDEBAR.CREW_ACCEPT' | translate }}
              </button>
              <button (click)="declineInvite()" class="h-[38px] px-3.5 rounded-xl border border-slate-200 dark:border-gray-700 text-[12.5px] font-extrabold text-text-secondary hover:border-slate-300 transition-colors">
                {{ 'COMMUNITY.HOME_SIDEBAR.CREW_DECLINE' | translate }}
              </button>
            </div>
          } @else {
            <div class="flex items-center gap-2">
              <span class="flex -space-x-2">
                @for (face of faces; track $index) {
                  <span class="w-7 h-7 rounded-full border-2 border-white dark:border-gray-800" [style.background]="face"></span>
                }
              </span>
              <span class="text-xs font-semibold text-text-secondary">{{ 'COMMUNITY.HOME_SIDEBAR.CREW_LOBBY' | translate }}</span>
            </div>
            <p class="text-[12.5px] font-medium leading-relaxed text-text-faint">{{ 'COMMUNITY.HOME_SIDEBAR.CREW_NOTE' | translate }}</p>
            <button (click)="requestToJoin()" class="w-full h-[38px] rounded-xl bg-primary hover:bg-primary-hover text-white text-[12.5px] font-extrabold transition-colors">
              {{ 'COMMUNITY.HOME_SIDEBAR.CREW_REQUEST' | translate }}
            </button>
            <a routerLink="/community/spaces" class="self-start text-xs font-bold text-text-primary hover:underline">{{ 'COMMUNITY.HOME_SIDEBAR.CREW_START_OWN' | translate }}</a>
          }
        </div>
      </div>
    }
  `,
})
export class CommunityCrewWidgetComponent {
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  readonly inviterName = 'Maya Kondo';
  readonly faces = ['linear-gradient(140deg,#0060EA,#7A4FA3)', 'linear-gradient(140deg,#0F9D58,#2AA98B)', 'linear-gradient(140deg,#F2B872,#D2604B)', 'linear-gradient(140deg,#6B3FA0,#0060EA)'];

  readonly joined = signal(false);
  readonly hasInvite = signal(true);

  acceptInvite(): void {
    this.joined.set(true);
    this.toast.success(this.translate.instant('COMMUNITY.HOME_SIDEBAR.CREW_TOAST_JOINED'));
  }

  declineInvite(): void {
    this.hasInvite.set(false);
    this.toast.success(this.translate.instant('COMMUNITY.HOME_SIDEBAR.CREW_TOAST_DECLINED'));
  }

  requestToJoin(): void {
    this.joined.set(true);
    this.toast.success(this.translate.instant('COMMUNITY.HOME_SIDEBAR.CREW_TOAST_REQUESTED'));
  }
}
