import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type EventDayTab = 'summary' | number;

/**
 * The sticky "Summary | Day 1 | Day 2 | ... | Day N" navigation bar shared by every
 * hosted-journey event page (Event Summary and Event Detail) — one implementation so
 * spacing/active-state styling/behavior stay identical everywhere it's used, per
 * community-event-summary.component.ts's original tab bar.
 */
@Component({
  selector: 'app-event-day-tabs',
  imports: [CommonModule],
  template: `
    <!-- Tab styling matches the main Itinerary page's day nav exactly
         (itinerary-header.component.ts) — same size/padding/radius/font-weight/
         active+hover classes, all existing global Tailwind tokens (text-primary,
         surface-muted), just wrapped in this page's own sticky shell. -->
    <nav class="sticky top-[68px] z-40 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-gray-800">
      <div class="page-container mx-auto px-5 xl:px-20 flex items-center gap-0 overflow-x-auto py-2">
        <button
          type="button"
          (click)="tabSelect.emit('summary')"
          class="shrink-0 px-6 py-3 rounded-lg text-base font-medium transition-colors mr-3"
          [class.bg-text-primary]="activeTab === 'summary'"
          [class.text-white]="activeTab === 'summary'"
          [class.text-text-primary]="activeTab !== 'summary'"
          [class.hover:bg-surface-muted]="activeTab !== 'summary'"
        >
          Summary
        </button>
        <div class="flex items-center gap-2 min-w-max">
          <button
            *ngFor="let day of days"
            type="button"
            (click)="tabSelect.emit(day.day)"
            class="shrink-0 px-8 py-3 rounded-lg text-base font-medium transition-colors whitespace-nowrap"
            [class.bg-text-primary]="activeTab === day.day"
            [class.text-white]="activeTab === day.day"
            [class.text-text-primary]="activeTab !== day.day"
            [class.hover:bg-white]="activeTab !== day.day"
          >
            Day {{ day.day }}
          </button>
        </div>
      </div>
    </nav>
  `,
})
export class EventDayTabsComponent {
  @Input() days: { day: number }[] = [];
  @Input() activeTab: EventDayTab = 'summary';
  @Output() tabSelect = new EventEmitter<EventDayTab>();
}
