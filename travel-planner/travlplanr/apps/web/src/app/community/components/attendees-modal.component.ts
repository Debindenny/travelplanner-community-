import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EventAttendee } from '../services/community-event-view.model';

@Component({
  selector: 'app-attendees-modal',
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 z-[70] overflow-y-auto bg-black/60 backdrop-blur-sm" (click)="close.emit()">
      <div class="min-h-full flex items-center justify-center p-4">
        <div
          class="w-full max-w-[560px] max-h-[85vh] rounded-[24px] bg-white dark:bg-gray-800 shadow-2xl overflow-hidden flex flex-col"
          (click)="$event.stopPropagation()"
        >
          <!-- Header -->
          <div class="flex items-start justify-between gap-3 px-[22px] py-[18px] border-b border-[#EEF1F6] dark:border-gray-700 shrink-0">
            <div>
              <h2 class="font-manrope text-lg font-extrabold text-eventText-deep dark:text-white">Travelers going</h2>
              <p class="text-xs font-semibold text-eventText-soft mt-0.5">Tap a traveler to see their profile</p>
            </div>
            <button
              type="button"
              (click)="close.emit()"
              class="w-8 h-8 rounded-[9px] border border-[#E8ECF2] dark:border-gray-700 flex items-center justify-center text-eventText-mid hover:text-eventText-deep shrink-0 focus:outline-none"
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <!-- Search -->
          <div class="px-[22px] pt-4 pb-2 shrink-0">
            <div class="relative">
              <svg class="w-4 h-4 text-eventText-soft absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                [value]="query"
                (input)="query = $any($event.target).value"
                placeholder="Search travelers..."
                class="w-full h-10 pl-10 pr-3.5 rounded-xl border border-[#E8ECF2] dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-semibold text-eventText-deep dark:text-white placeholder:text-eventText-soft placeholder:font-semibold focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          <!-- List -->
          <div class="px-[22px] pb-4 overflow-y-auto divide-y divide-[#EEF1F6] dark:divide-gray-700">
            <div
              *ngFor="let traveler of filteredAttendees"
              (click)="selectTraveler.emit(traveler)"
              class="flex items-center justify-between gap-3 py-3 cursor-pointer"
            >
              <div class="min-w-0">
                <p class="text-sm font-extrabold text-eventText-deep dark:text-white truncate">{{ traveler.name }}</p>
                <p class="text-[11.5px] font-semibold text-eventText-soft mt-0.5 truncate">
                  {{ traveler.country }} · {{ destination }}, {{ traveler.dateRangeLabel }}
                </p>
              </div>
              <button
                type="button"
                (click)="toggleFollow(traveler, $event)"
                class="h-8 px-3.5 rounded-lg text-xs font-bold border transition-colors shrink-0"
                [class.border-primary]="!traveler.following"
                [class.text-primary]="!traveler.following"
                [class.hover:bg-primary]="!traveler.following"
                [class.hover:text-white]="!traveler.following"
                [class.bg-primary-50]="traveler.following"
                [class.border-primary-subtle]="traveler.following"
                [class.text-eventText-mid]="traveler.following"
              >
                {{ traveler.following ? 'Unfollow' : 'Follow' }}
              </button>
            </div>

            <p *ngIf="!filteredAttendees.length" class="text-xs font-semibold text-eventText-soft text-center py-8">
              No travelers match "{{ query }}"
            </p>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AttendeesModalComponent {
  @Input() attendees: EventAttendee[] = [];
  @Input() destination = '';
  @Output() close = new EventEmitter<void>();
  @Output() selectTraveler = new EventEmitter<EventAttendee>();

  query = '';

  get filteredAttendees(): EventAttendee[] {
    const q = this.query.trim().toLowerCase();
    if (!q) return this.attendees;
    return this.attendees.filter((t) => t.name.toLowerCase().includes(q) || t.country.toLowerCase().includes(q));
  }

  toggleFollow(traveler: EventAttendee, event: Event): void {
    event.stopPropagation();
    traveler.following = !traveler.following;
  }
}
