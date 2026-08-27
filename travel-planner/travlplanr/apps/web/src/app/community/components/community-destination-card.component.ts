import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { CommunityDestination } from '../circles-trips/core/models/community.models';

@Component({
  selector: 'app-community-destination-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslatePipe, ImgFallbackDirective],
  template: `
    <article class="flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      <div class="relative h-[190px] shrink-0 overflow-hidden">
        <img
          [src]="destination.image"
          appImgFallback
          [alt]="destination.name"
          loading="lazy"
          class="absolute inset-0 h-full w-full object-cover"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent"></div>

        <span class="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 dark:bg-gray-900/90 pl-2 pr-2.5 py-1 text-[11.5px] font-bold text-text-primary dark:text-gray-100 shadow-sm">
          <span class="h-1.5 w-1.5 rounded-full bg-success shrink-0" aria-hidden="true"></span>
          {{ destination.livePlanning }}
        </span>

        @if (destination.hot) {
          <span class="absolute right-3 top-3 rounded-full bg-danger px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm">
            {{ destination.hot }}
          </span>
        }

        <div class="absolute inset-x-0 bottom-0 p-4">
          <h3 class="text-lg font-bold text-white leading-tight">{{ destination.name }}</h3>
          <p class="text-[12.5px] font-semibold text-white/85">{{ destination.members }}</p>
        </div>
      </div>

      <div class="flex flex-col gap-4 p-4">
        <div class="grid grid-cols-3 gap-2 text-center">
          @for (stat of destination.stats; track stat.label) {
            <div class="flex flex-col gap-0.5">
              <span class="text-base font-bold text-text-primary dark:text-gray-100">{{ stat.value }}</span>
              <span class="text-[11px] font-semibold text-text-faint">{{ stat.label }}</span>
            </div>
          }
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            (click)="viewDetails.emit(destination)"
            class="flex-1 h-10 rounded-xl border border-slate-200 dark:border-gray-600 text-[13px] font-bold text-text-primary dark:text-gray-100 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {{ 'COMMUNITY.DESTINATIONS_PAGE.VIEW_DETAILS' | translate }}
          </button>
          <button
            type="button"
            (click)="joinToggled.emit(destination)"
            [attr.aria-pressed]="joined"
            class="flex-1 h-10 rounded-xl text-[13px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            [ngClass]="joined ? 'bg-primary-subtle text-primary' : 'bg-primary hover:bg-primary-hover text-white'"
          >
            {{ (joined ? 'COMMUNITY.DESTINATIONS_PAGE.JOINED' : 'COMMUNITY.DESTINATIONS_PAGE.JOIN') | translate }}
          </button>
        </div>
      </div>
    </article>
  `,
})
export class CommunityDestinationCardComponent {
  @Input({ required: true }) destination!: CommunityDestination;
  @Input() joined = false;
  @Output() viewDetails = new EventEmitter<CommunityDestination>();
  @Output() joinToggled = new EventEmitter<CommunityDestination>();
}
