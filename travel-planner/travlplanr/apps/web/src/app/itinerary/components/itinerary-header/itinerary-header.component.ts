import { Component, Input, Output, EventEmitter, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SavedTrip } from '../../../trip/trip.service';
import { TripViewer } from '../../../shared/services/trip-presence.service';

@Component({
    selector: 'app-itinerary-header',
    imports: [CommonModule, TranslatePipe],
    template: `
    @if (trip) {
      @if (trip.coverageTier === 'draft') {
        <div class="page-container px-5 xl:px-20 pt-4">
          <div class="rounded-btn border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>{{ 'ITINERARY.HEADER.DRAFT_BADGE' | translate }}</strong>
            {{ 'ITINERARY.HEADER.DRAFT_DESCRIPTION' | translate }}
          </div>
        </div>
      }
      
      <!-- Hero carousel (Figma: Scrooling images) -->
      <div class="page-container px-5 xl:px-20 pt-7 pb-0">
        <div class="relative h-[280px] sm:h-[360px] lg:h-[480px] overflow-hidden rounded-2xl">
          <img
            [src]="heroImages[heroSlideIndex()]"
            [alt]="trip.title"
            class="w-full h-full object-cover object-bottom"
          />
          <button
            type="button"
            (click)="prevHeroSlide()"
            class="absolute left-4 lg:left-10 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center transition-colors"
            [attr.aria-label]="'ITINERARY.HEADER.PREV_IMAGE' | translate"
          >
            <svg class="w-5 h-5 text-text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <button
            type="button"
            (click)="nextHeroSlide()"
            class="absolute right-4 lg:right-10 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center transition-colors"
            [attr.aria-label]="'ITINERARY.HEADER.NEXT_IMAGE' | translate"
          >
            <svg class="w-5 h-5 text-text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
          <div class="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2">
            @for (img of heroImages; track $index) {
              <button
                type="button"
                (click)="heroSlideIndex.set($index)"
                class="w-2.5 h-2.5 rounded-full transition-colors"
                [ngClass]="$index === heroSlideIndex() ? 'bg-white' : 'bg-white/50'"
                [attr.aria-label]="'ITINERARY.HEADER.GO_TO_IMAGE' | translate: { number: $index + 1 }"
              ></button>
            }
          </div>
        </div>
      </div>

      <!-- Trip title + calendar / travelers -->
      <div class="page-container px-5 xl:px-20 pt-6 pb-2">
        <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h1 class="text-4xl lg:text-6xl font-bold text-text-primary leading-tight">
              {{ trip.title }}
            </h1>
            <p class="mt-1 text-sm-plus text-text-secondary">
              {{ tripDurationLabel }}
            </p>
          </div>
          <div class="flex flex-wrap items-start gap-8 lg:gap-12 shrink-0">
            <div>
              <p class="text-lg font-medium text-text-primary leading-none">{{ 'ITINERARY.HEADER.CALENDAR_LABEL' | translate }}</p>
              <div class="mt-1 flex items-center gap-2">
                <span class="text-sm font-medium text-text-secondary">{{ tripDatesStr }}</span>
                <button (click)="onEditDates.emit()" type="button" class="text-text-tertiary hover:text-primary transition-colors" [attr.aria-label]="'ITINERARY.HEADER.EDIT_DATES' | translate">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
              </div>
            </div>
            <div>
              <p class="text-lg font-medium text-text-primary leading-none">{{ 'ITINERARY.HEADER.TRAVELERS_LABEL' | translate }}</p>
              <div class="mt-1 flex items-center gap-2">
                <span class="text-sm font-medium text-text-secondary">{{ travelersLabel }}</span>
                <button (click)="onEditTravelers.emit()" type="button" class="text-text-tertiary hover:text-primary transition-colors" [attr.aria-label]="'ITINERARY.HEADER.EDIT_TRAVELERS' | translate">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Day progress bar -->
      @if (displayedDays.length === 0) {
        <div class="page-container px-5 xl:px-20 py-16">
          <div class="rounded-xl border border-dashed border-border bg-white p-12 text-center max-w-xl mx-auto">
            <h2 class="text-2xl font-bold text-text-primary mb-2">{{ 'ITINERARY.DAY.EMPTY_TITLE' | translate }}</h2>
            <p class="text-text-secondary mb-6">
              @if (trip.status === 'generating') {
                {{ 'ITINERARY.DAY.EMPTY_GENERATING' | translate }}
              } @else {
                {{ 'ITINERARY.DAY.EMPTY_FAILED' | translate }}
              }
            </p>
            @if (trip.status !== 'generating') {
              <button
                type="button"
                (click)="onRetryLoad.emit()"
                class="px-6 py-2.5 bg-primary text-white rounded-btn font-semibold hover:bg-primary-hover transition-colors"
              >
                {{ 'ITINERARY.DAY.BUILD_ITINERARY' | translate }}
              </button>
            }
          </div>
        </div>
      } @else {
      <nav class="sticky top-[68px] z-40 bg-surface-muted border-b border-border-light">
        <div class="page-container px-5 xl:px-20 flex items-center justify-between gap-4 py-2">
          <!-- Tabs (Left side) -->
          <div class="flex items-center gap-0 overflow-x-auto min-w-0">
            <button
              type="button"
              (click)="onScrollToDay.emit('summary')"
              class="shrink-0 px-6 py-3 rounded-lg text-base font-medium transition-colors mr-3"
              [class.bg-text-primary]="activeDayTab === 'summary'"
              [class.text-white]="activeDayTab === 'summary'"
              [class.text-text-primary]="activeDayTab !== 'summary'"
              [class.hover:bg-surface-muted]="activeDayTab !== 'summary'"
            >
              {{ 'ITINERARY.DAY.SUMMARY_TAB' | translate }}
            </button>
            <div class="flex items-center gap-2 min-w-max">
              @for (day of displayedDays; track day.day) {
                <button
                  type="button"
                  (click)="onScrollToDay.emit(day.day)"
                  class="shrink-0 px-8 py-3 rounded-lg text-base font-medium transition-colors whitespace-nowrap"
                  [class.bg-text-primary]="activeDayTab === day.day"
                  [class.text-white]="activeDayTab === day.day"
                  [class.text-text-primary]="activeDayTab !== day.day"
                  [class.hover:bg-white]="activeDayTab !== day.day"
                >
                  {{ 'ITINERARY.DAY.DAY_TAB_LABEL' | translate: { number: day.day } }}
                </button>
              }
            </div>
          </div>

          <!-- Collaborators (Right side) -->
          <div class="flex items-center gap-2 shrink-0">
            <div class="flex -space-x-2 overflow-hidden">
              @for (collab of activeCollaborators; track collab.id) {
                <div
                  [title]="collabTitle(collab)"
                  class="relative inline-block h-8 w-8 rounded-full ring-2 ring-white bg-indigo-100 text-indigo-800 text-xs font-semibold flex items-center justify-center cursor-pointer"
                >
                  {{ collab.display_name.slice(0, 2).toUpperCase() }}
                  @if (isLiveViewer(collab.user_id)) {
                    <span class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-white"></span>
                  }
                </div>
              }
            </div>
            <button
              (click)="onOpenShare.emit()"
              type="button"
              class="flex items-center justify-center h-8 w-8 rounded-full bg-gradient-to-tr from-primary to-[#0050C7] text-white shadow-[0_4px_12px_rgba(0,96,234,0.3)] hover:shadow-[0_6px_16px_rgba(0,96,234,0.5)] hover:-translate-y-0.5 transition-all duration-300"
              [title]="'ITINERARY.DAY.ADD_PEOPLE' | translate"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
          </div>
        </div>
      </nav>
      }
    }
  `
})
export class ItineraryHeaderComponent {
  @Input() trip!: SavedTrip | null;
  @Input() heroImages: string[] = [];
  @Input() tripDurationLabel: string = '';
  @Input() tripDatesStr: string = '';
  @Input() travelersLabel: string = '';
  @Input() displayedDays: any[] = [];
  @Input() activeDayTab: number | 'summary' = 'summary';
  @Input() activeCollaborators: any[] = [];
  @Input() liveViewers: TripViewer[] = [];

  private translate = inject(TranslateService);

  isLiveViewer(userId: string | null | undefined): boolean {
    return !!userId && this.liveViewers.some((v) => v.user_id === userId);
  }

  collabTitle(collab: { display_name: string; role: string; user_id?: string }): string {
    const base = `${collab.display_name} (${collab.role})`;
    return this.isLiveViewer(collab.user_id) ? base + this.translate.instant('ITINERARY.HEADER.VIEWING_NOW') : base;
  }
  
  @Output() onEditDates = new EventEmitter<void>();
  @Output() onEditTravelers = new EventEmitter<void>();
  @Output() onScrollToDay = new EventEmitter<number | 'summary'>();
  @Output() onOpenShare = new EventEmitter<void>();
  @Output() onRetryLoad = new EventEmitter<void>();

  readonly heroSlideIndex = signal(0);

  prevHeroSlide() {
    if (!this.heroImages.length) return;
    this.heroSlideIndex.update((i) => (i === 0 ? this.heroImages.length - 1 : i - 1));
  }

  nextHeroSlide() {
    if (!this.heroImages.length) return;
    this.heroSlideIndex.update((i) => (i === this.heroImages.length - 1 ? 0 : i + 1));
  }
}
