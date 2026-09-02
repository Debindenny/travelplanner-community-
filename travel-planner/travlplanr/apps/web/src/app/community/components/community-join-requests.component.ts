import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ToastService } from '../../shared/utils/toast.service';
import { mockCustomerId } from '../circles-trips/core/data/community-mock-users';

interface JoinRequest {
  id: string;
  name: string;
  line: string;
  note: string;
  customer_id: string;
}

const MOCK_REQUESTS: JoinRequest[] = [
  { id: 'r1', name: 'Priya Nair', line: 'Paris · Jun 3–8', note: 'Solo traveler, loves food markets and slow mornings.', customer_id: mockCustomerId('Priya Nair') },
  { id: 'r2', name: 'Iker Zubia', line: 'Paris · Jun 4–11', note: 'Second time in Paris, happy to guide the group around Montmartre.', customer_id: mockCustomerId('Iker Zubia') },
];

@Component({
  selector: 'app-community-join-requests',
  imports: [TranslatePipe, RouterLink],
  template: `
    @if (requests().length > 0) {
      <div class="bg-white dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl shadow-[0_1px_2px_rgba(11,18,32,0.04),0_8px_24px_rgba(11,18,32,0.05)] p-4">
        <div class="flex items-center gap-2 mb-3.5">
          <span class="flex-1 text-[11.5px] font-bold tracking-[0.1em] text-text-faint uppercase">{{ 'COMMUNITY.HOME_SIDEBAR.REQUESTS_TITLE' | translate }}</span>
          <span class="h-5 px-2 rounded-full bg-amber-50 text-amber-700 text-[10.5px] font-bold flex items-center">{{ requests().length }}</span>
        </div>
        <p class="text-[13.5px] font-bold text-text-primary mb-3">{{ ownedCircleName }}</p>

        <div class="flex flex-col gap-3.5">
          @for (request of requests(); track request.id) {
            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-2.5">
                <a class="shrink-0" [routerLink]="['/community/users', request.customer_id]"><img src="/assets/images/default-avatar.svg" class="w-9 h-9 rounded-full shrink-0 bg-slate-100" alt="" /></a>
                <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                  <a class="text-[14px] font-semibold text-text-primary truncate hover:text-primary hover:underline" [routerLink]="['/community/users', request.customer_id]">{{ request.name }}</a>
                  <span class="text-[11.5px] font-semibold text-text-faint truncate">{{ request.line }}</span>
                </div>
              </div>
              <p class="text-[12.5px] font-medium leading-relaxed text-text-secondary pl-[46px]">{{ request.note }}</p>
              <div class="flex gap-1.5 pl-[46px]">
                <button (click)="respond(request, true)" class="flex-1 h-8 rounded-lg bg-primary hover:bg-primary-hover text-white text-[12.5px] font-semibold transition-colors">
                  {{ 'COMMUNITY.HOME_SIDEBAR.REQUEST_ACCEPT' | translate }}
                </button>
                <button (click)="respond(request, false)" class="flex-1 h-8 rounded-lg border border-slate-200 dark:border-gray-700 text-text-secondary text-[12.5px] font-semibold hover:border-slate-300 transition-colors">
                  {{ 'COMMUNITY.HOME_SIDEBAR.REQUEST_DECLINE' | translate }}
                </button>
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class CommunityJoinRequestsComponent {
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  readonly ownedCircleName = 'Paris June Crew';
  readonly requests = signal<JoinRequest[]>(MOCK_REQUESTS);

  respond(request: JoinRequest, accepted: boolean): void {
    this.requests.update((list) => list.filter((r) => r.id !== request.id));
    this.toast.success(
      accepted
        ? this.translate.instant('COMMUNITY.HOME_SIDEBAR.REQUEST_TOAST_ACCEPTED', { name: request.name })
        : this.translate.instant('COMMUNITY.HOME_SIDEBAR.REQUEST_TOAST_DECLINED', { name: request.name }),
    );
  }
}
