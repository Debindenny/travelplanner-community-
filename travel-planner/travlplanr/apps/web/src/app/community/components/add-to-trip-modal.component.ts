import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CommunityEventCard } from '../services/community-event-view.model';

/**
 * "Which trip / which day" itinerary picker — presentation-only, not part of
 * the meetups API. There is no backend concept of a meetup being attached to
 * a specific trip day, so this stays local UI state exactly as it was before
 * the mock-data reconnect; only the RSVP itself (handled by the parent) is
 * backed by the real API.
 */
export interface TripDayItem {
  time: string;
  title: string;
}

export interface TripDayOption {
  id: string;
  label: string;
  dateLabel: string;
  itemsCount: number;
  items: TripDayItem[];
}

export interface TripOption {
  id: string;
  name: string;
  dateRangeLabel: string;
  activitiesCount: number;
  days: TripDayOption[];
}

export const TRIP_OPTIONS: TripOption[] = [
  {
    id: 'trip-1',
    name: 'Paris · Long weekend',
    dateRangeLabel: 'Jun 03 – Jun 08',
    activitiesCount: 8,
    days: [
      {
        id: 'd1',
        label: 'Day 1',
        dateLabel: 'Wed 03',
        itemsCount: 2,
        items: [
          { time: '15:00', title: 'Check in · Hôtel Bachaumont' },
          { time: '19:00', title: 'Dinner in Le Marais' }
        ]
      },
      { id: 'd2', label: 'Day 2', dateLabel: 'Thu 04', itemsCount: 1, items: [{ time: '10:00', title: 'Louvre — timed entry' }] },
      {
        id: 'd3',
        label: 'Day 3',
        dateLabel: 'Fri 05',
        itemsCount: 2,
        items: [
          { time: '09:30', title: 'Eiffel Tower — summit access' },
          { time: '20:00', title: 'Seine river cruise' }
        ]
      },
      { id: 'd4', label: 'Day 4', dateLabel: 'Sat 06', itemsCount: 1, items: [{ time: '11:00', title: 'Musée d\'Orsay' }] },
      { id: 'd5', label: 'Day 5', dateLabel: 'Sun 07', itemsCount: 1, items: [{ time: '14:00', title: 'Versailles day trip' }] },
      { id: 'd6', label: 'Day 6', dateLabel: 'Mon 08', itemsCount: 1, items: [{ time: '12:00', title: 'Check out · Hôtel Bachaumont' }] }
    ]
  },
  {
    id: 'trip-2',
    name: 'Japan 2027',
    dateRangeLabel: 'Apr 04 – Apr 11',
    activitiesCount: 9,
    days: [
      { id: 'd1', label: 'Day 1', dateLabel: 'Apr 04', itemsCount: 1, items: [{ time: '16:00', title: 'Check in · Shinjuku' }] },
      {
        id: 'd2',
        label: 'Day 2',
        dateLabel: 'Apr 05',
        itemsCount: 2,
        items: [
          { time: '09:00', title: 'Senso-ji Temple' },
          { time: '19:00', title: 'Shibuya crossing at night' }
        ]
      },
      { id: 'd3', label: 'Day 3', dateLabel: 'Apr 06', itemsCount: 1, items: [{ time: '10:00', title: 'teamLab Planets' }] },
      { id: 'd4', label: 'Day 4', dateLabel: 'Apr 07', itemsCount: 1, items: [{ time: '08:00', title: 'Tsukiji Outer Market' }] }
    ]
  }
];

@Component({
  selector: 'app-add-to-trip-modal',
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 z-[70] overflow-y-auto bg-black/60 backdrop-blur-sm" (click)="close.emit()">
      <div class="min-h-full flex items-center justify-center p-4">
        <div class="w-full max-w-[560px] rounded-[24px] bg-white dark:bg-gray-800 shadow-2xl overflow-hidden" (click)="$event.stopPropagation()">
          <!-- Header -->
          <div class="flex items-start justify-between gap-3 px-[22px] py-[18px] border-b border-[#EEF1F6] dark:border-gray-700">
            <div>
              <h2 class="font-manrope text-base font-extrabold text-eventText-deep dark:text-white">Add to trip</h2>
              <p class="text-xs text-eventText-mid dark:text-gray-300 mt-0.5">Bring this place straight into your itinerary.</p>
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

          <!-- Body -->
          <div class="px-[22px] py-[18px] flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
            <!-- Event preview -->
            <div class="border border-[#E8ECF2] dark:border-gray-700 rounded-[13px] bg-[#FAFBFD] dark:bg-gray-700/50 px-4 py-3.5">
              <p class="text-sm font-extrabold text-eventText-deep dark:text-white">{{ event.title }}</p>
              <p class="text-[11px] font-semibold text-eventText-soft mt-0.5">{{ event.tag }} · {{ event.location }}</p>
            </div>

            <!-- Which trip -->
            <div>
              <p class="text-[11px] font-extrabold text-eventText-mid uppercase tracking-[0.06em] mb-2.5">Which trip</p>
              <div class="space-y-2">
                <button
                  *ngFor="let trip of tripOptions"
                  type="button"
                  (click)="selectTrip(trip.id)"
                  class="w-full text-left rounded-xl border p-[13px] flex items-center justify-between gap-3 transition-colors"
                  [ngClass]="selectedTripId === trip.id ? 'border-primary bg-[#F5F9FF]' : 'border-[#E8ECF2] dark:border-gray-700'"
                >
                  <span>
                    <span class="block text-sm font-extrabold text-eventText-deep dark:text-white">{{ trip.name }}</span>
                    <span class="block text-[11px] text-eventText-soft mt-0.5">{{ trip.dateRangeLabel }} · {{ trip.activitiesCount }} activities</span>
                  </span>
                  <span *ngIf="selectedTripId === trip.id" class="text-primary font-extrabold text-xs shrink-0">✓</span>
                </button>
              </div>
            </div>

            <!-- Which day -->
            <div>
              <p class="text-[11px] font-extrabold text-eventText-mid uppercase tracking-[0.06em] mb-2.5">Which day</p>
              <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
                <button
                  *ngFor="let day of selectedTrip.days"
                  type="button"
                  (click)="selectDay(day.id)"
                  class="rounded-[14px] border py-2.5 text-center transition-colors"
                  [ngClass]="selectedDayId === day.id ? 'bg-primary border-primary' : 'bg-white dark:bg-gray-800 border-[#E8ECF2] dark:border-gray-700'"
                >
                  <span
                    class="block text-[9px] font-extrabold uppercase tracking-[0.06em] opacity-70"
                    [class.text-white]="selectedDayId === day.id"
                    [class.text-eventText-soft]="selectedDayId !== day.id"
                    >{{ day.label }}</span
                  >
                  <span
                    class="block text-[12px] font-extrabold mt-1 leading-none"
                    [class.text-white]="selectedDayId === day.id"
                    [class.text-eventText-deep]="selectedDayId !== day.id"
                    >{{ day.dateLabel }}</span
                  >
                  <span
                    class="block text-[9px] font-bold mt-1 opacity-65"
                    [class.text-white]="selectedDayId === day.id"
                    [class.text-eventText-soft]="selectedDayId !== day.id"
                    >{{ day.itemsCount }} item{{ day.itemsCount === 1 ? '' : 's' }}</span
                  >
                </button>
              </div>
            </div>

            <!-- Summary -->
            <div class="border border-[#E4EDFB] dark:border-gray-700 bg-[#F7FAFF] dark:bg-gray-700/50 rounded-xl px-3.5 py-2 flex items-center gap-2">
              <svg class="w-3.5 h-3.5 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span class="text-xs font-bold text-eventText-deep dark:text-white">Adds to {{ selectedTrip.name }} · {{ selectedDay.label }}, {{ selectedDay.dateLabel }}</span>
            </div>

            <!-- That day so far -->
            <div *ngIf="selectedDay.items.length">
              <p class="text-[11px] font-extrabold text-eventText-mid uppercase tracking-[0.06em] mb-2.5">That day so far</p>
              <div class="border border-[#E8ECF2] dark:border-gray-700 rounded-xl divide-y divide-[#EEF1F6] dark:divide-gray-700">
                <div *ngFor="let item of selectedDay.items" class="flex items-center gap-3 px-3.5 py-2.5">
                  <span class="text-[11px] font-extrabold text-eventText-soft shrink-0 w-10">{{ item.time }}</span>
                  <span class="text-xs font-semibold text-eventText-deep dark:text-white">{{ item.title }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-[22px] py-3.5 border-t border-[#EEF1F6] dark:border-gray-700 bg-[#FAFBFD] dark:bg-gray-700/30 flex items-center justify-end gap-2.5">
            <button
              type="button"
              (click)="close.emit()"
              class="h-[38px] px-4 rounded-xl border border-[#E2E7EF] dark:border-gray-600 text-xs font-bold text-eventText-mid dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              (click)="confirm.emit({ trip: selectedTrip, day: selectedDay })"
              class="h-[38px] px-5 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white transition-colors"
            >
              Add to your itinerary
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AddToTripModalComponent {
  @Input() event!: CommunityEventCard;
  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<{ trip: TripOption; day: TripDayOption }>();

  // Only the traveler's current trip is offered here — matches the "Your trip"
  // banner on the events list rather than every trip they've ever planned.
  readonly tripOptions: TripOption[] = TRIP_OPTIONS.slice(0, 1);
  selectedTripId = this.tripOptions[0].id;
  selectedDayId = this.tripOptions[0].days[0].id;

  get selectedTrip(): TripOption {
    return this.tripOptions.find((t) => t.id === this.selectedTripId) ?? this.tripOptions[0];
  }

  get selectedDay(): TripDayOption {
    return this.selectedTrip.days.find((d) => d.id === this.selectedDayId) ?? this.selectedTrip.days[0];
  }

  selectTrip(tripId: string): void {
    this.selectedTripId = tripId;
    const trip = this.tripOptions.find((t) => t.id === tripId);
    this.selectedDayId = trip ? trip.days[0].id : '';
  }

  selectDay(dayId: string): void {
    this.selectedDayId = dayId;
  }
}
