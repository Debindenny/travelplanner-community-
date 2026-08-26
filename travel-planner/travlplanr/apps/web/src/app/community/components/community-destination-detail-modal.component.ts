import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { NgClass } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { CommunityDestination } from '../circles-trips/core/models/community.models';

@Component({
  selector: 'app-community-destination-detail-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, TranslatePipe, ImgFallbackDirective],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="'destination-modal-title'"
      (click)="close.emit()"
    >
      <div
        class="no-scrollbar w-full max-w-md max-h-[85vh] overflow-y-auto rounded-3xl bg-white dark:bg-gray-800 shadow-2xl"
        (click)="$event.stopPropagation()"
      >
        <div class="relative h-[220px] shrink-0 overflow-hidden rounded-t-3xl">
          <img
            [src]="destination.image"
            appImgFallback
            [alt]="destination.name"
            class="absolute inset-0 h-full w-full object-cover"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"></div>

          <button
            type="button"
            (click)="close.emit()"
            aria-label="{{ 'COMMUNITY.DESTINATIONS_PAGE.CLOSE' | translate }}"
            class="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>

          <div class="absolute inset-x-0 bottom-0 p-5">
            <h2 id="destination-modal-title" class="text-2xl font-bold text-white leading-tight">{{ destination.name }}</h2>
            <p class="text-[13px] font-semibold text-white/85">{{ destination.members }}</p>
          </div>
        </div>

        <div class="flex flex-col gap-5 p-5">
          <div class="grid grid-cols-3 gap-3">
            @for (stat of destination.stats; track stat.label) {
              <div class="flex flex-col gap-1 rounded-xl bg-slate-50 dark:bg-gray-700 p-3">
                <span class="text-[11px] font-bold uppercase tracking-wide text-text-faint">{{ stat.label }}</span>
                <span class="text-lg font-bold text-text-primary dark:text-gray-100">{{ stat.value }}</span>
              </div>
            }
          </div>

          @if (destination.recentPosts?.length) {
            <div class="flex flex-col gap-2.5">
              <span class="text-[11px] font-bold uppercase tracking-wide text-text-faint">{{ 'COMMUNITY.DESTINATIONS_PAGE.RECENT_POSTS' | translate }}</span>
              <div class="flex flex-col gap-2">
                @for (post of destination.recentPosts; track post.title) {
                  <div class="flex items-center justify-between gap-3 rounded-xl border border-slate-100 dark:border-gray-700 px-4 py-3">
                    <div class="min-w-0">
                      <p class="text-[13.5px] font-bold text-text-primary dark:text-gray-100 truncate">{{ post.title }}</p>
                      <p class="text-[12px] font-semibold text-text-faint truncate">{{ post.author }} · {{ post.kind }}</p>
                    </div>
                    <svg class="w-4 h-4 shrink-0 text-text-faint" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <div class="flex items-center justify-between gap-3 border-t border-slate-100 dark:border-gray-700 px-5 py-4">
          <span class="text-[13px] font-semibold text-text-faint">{{ 'COMMUNITY.DESTINATIONS_PAGE.PLANNING_RIGHT_NOW' | translate: { planning: destination.livePlanning } }}</span>
          <button
            type="button"
            (click)="joinToggled.emit()"
            [attr.aria-pressed]="joined"
            class="h-10 shrink-0 rounded-xl px-5 text-[13px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            [ngClass]="joined ? 'bg-primary-subtle text-primary' : 'bg-primary hover:bg-primary-hover text-white'"
          >
            {{ (joined ? 'COMMUNITY.DESTINATIONS_PAGE.JOINED_COMMUNITY' : 'COMMUNITY.DESTINATIONS_PAGE.JOIN_COMMUNITY') | translate }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  `],
})
export class CommunityDestinationDetailModalComponent {
  @Input({ required: true }) destination!: CommunityDestination;
  @Input() joined = false;
  @Output() close = new EventEmitter<void>();
  @Output() joinToggled = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }
}
