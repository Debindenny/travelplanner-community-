import { Component, OnInit, inject, signal } from '@angular/core';

import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CommunityEvent, CommunityEventsService } from '../services/community-events.service';
import { ToastService } from '../../shared/utils/toast.service';

@Component({
  selector: 'app-community-upcoming-events-widget',
  imports: [RouterLink, TranslatePipe],
  template: `
    <div class="bg-white dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl shadow-[0_1px_2px_rgba(11,18,32,0.04),0_8px_24px_rgba(11,18,32,0.05)] p-4">
      <div class="flex items-center justify-between mb-3">
        <span class="text-[10.5px] font-extrabold tracking-[0.1em] text-text-faint uppercase">{{ 'COMMUNITY.HOME_SIDEBAR.EVENTS_TITLE' | translate }}</span>
        <a routerLink="/community/events" class="text-[11px] font-extrabold text-primary hover:underline">{{ 'COMMUNITY.HOME_SIDEBAR.EVENTS_SEE_ALL' | translate }}</a>
      </div>

      @if (isLoading()) {
        <div class="flex flex-col gap-3">
          @for (i of [1, 2]; track i) {
            <div class="flex items-center gap-2.5 animate-pulse">
              <div class="w-11 h-11 rounded-xl bg-slate-100 shrink-0"></div>
              <div class="flex-1 h-3 bg-slate-100 rounded"></div>
            </div>
          }
        </div>
      } @else if (events().length === 0) {
        <p class="text-xs font-semibold text-text-faint text-center py-3">{{ 'COMMUNITY.HOME_SIDEBAR.EVENTS_EMPTY' | translate }}</p>
      } @else {
        <div class="flex flex-col gap-3">
          @for (event of events(); track event.id) {
            <div class="flex items-center gap-2.5">
              <span class="w-11 h-11 rounded-xl bg-[#EEF3FF] flex flex-col items-center justify-center leading-none shrink-0">
                <span class="text-[9.5px] font-extrabold text-[#1D63ED] uppercase">{{ monthOf(event.starts_at) }}</span>
                <span class="text-sm font-extrabold text-text-primary">{{ dayOf(event.starts_at) }}</span>
              </span>
              <div class="flex-1 min-w-0 flex flex-col">
                <span class="text-[13px] font-bold text-text-primary truncate">{{ event.title }}</span>
                <span class="text-[11.5px] font-semibold text-text-faint truncate">{{ event.location || ('COMMUNITY.HOME_SIDEBAR.EVENTS_ONLINE' | translate) }} · {{ event.attendee_count }} {{ 'COMMUNITY.HOME_SIDEBAR.EVENTS_GOING' | translate }}</span>
              </div>
              <button
                (click)="toggleRsvp(event)"
                class="h-8 px-3 rounded-lg text-[11px] font-extrabold whitespace-nowrap border transition-colors shrink-0"
                [class.border-primary]="event.rsvp_status !== 'going'"
                [class.text-primary]="event.rsvp_status !== 'going'"
                [class.bg-white]="event.rsvp_status !== 'going'"
                [class.border-slate-200]="event.rsvp_status === 'going'"
                [class.dark:border-gray-700]="event.rsvp_status === 'going'"
                [class.bg-slate-50]="event.rsvp_status === 'going'"
                [class.text-text-faint]="event.rsvp_status === 'going'"
              >
                {{ (event.rsvp_status === 'going' ? 'COMMUNITY.HOME_SIDEBAR.EVENTS_GOING_BADGE' : 'COMMUNITY.HOME_SIDEBAR.EVENTS_JOIN') | translate }}
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class CommunityUpcomingEventsWidgetComponent implements OnInit {
  private readonly eventsService = inject(CommunityEventsService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  readonly events = signal<CommunityEvent[]>([]);
  readonly isLoading = signal(true);

  ngOnInit(): void {
    this.eventsService.getEvents(3, 0).subscribe({
      next: (res) => {
        this.events.set(res.meetups || []);
        this.isLoading.set(false);
      },
      error: () => {
        this.events.set([]);
        this.isLoading.set(false);
      },
    });
  }

  monthOf(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  }

  dayOf(iso: string): string {
    return new Date(iso).getDate().toString().padStart(2, '0');
  }

  toggleRsvp(event: CommunityEvent): void {
    const goingNow = event.rsvp_status === 'going';
    const nextStatus: 'going' | 'declined' = goingNow ? 'declined' : 'going';
    this.eventsService.setRsvp(event.id, nextStatus).subscribe({
      next: (res) => {
        this.events.update((list) =>
          list.map((e) =>
            e.id === event.id
              ? { ...e, rsvp_status: res.rsvp_status, attendee_count: e.attendee_count + (res.rsvp_status === 'going' ? 1 : -1) }
              : e,
          ),
        );
      },
      error: () => {
        this.toast.error(this.translate.instant('COMMUNITY.HOME_SIDEBAR.EVENTS_RSVP_ERROR'));
      },
    });
  }
}
