import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { TripService, TripVersionSummary } from '../../../trip/trip.service';

/**
 * Version history for a trip's itinerary snapshots (taken before each AI
 * regenerate/rebuild, and before each restore — see services/planner TripVersion).
 * Restoring asks for confirmation since it overwrites the trip's current itinerary
 * (the current state is itself snapshotted server-side first, so it's recoverable).
 */
@Component({
    selector: 'app-trip-version-history',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, TranslatePipe],
    template: `
    @if (open) {
      <div
        class="fixed inset-0 z-[1050] flex items-center justify-center bg-black/40 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="version-history-title"
        (click)="requestClose()"
        (keydown.escape)="requestClose()"
      >
        <div
          class="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-card-hover p-6 max-h-[80vh] overflow-y-auto"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-center justify-between mb-4">
            <h3 id="version-history-title" class="text-base font-bold text-text-primary dark:text-white">
              {{ 'ITINERARY.VERSION_HISTORY.TITLE' | translate }}
            </h3>
            <button
              type="button"
              class="text-text-tertiary hover:text-text-primary dark:hover:text-white"
              (click)="requestClose()"
              [attr.aria-label]="'ITINERARY.VERSION_HISTORY.CLOSE' | translate"
            >
              &times;
            </button>
          </div>

          @if (loading()) {
            <p class="text-sm text-text-secondary dark:text-gray-400">{{ 'ITINERARY.VERSION_HISTORY.LOADING' | translate }}</p>
          } @else if (versions().length === 0) {
            <p class="text-sm text-text-secondary dark:text-gray-400">{{ 'ITINERARY.VERSION_HISTORY.EMPTY' | translate }}</p>
          } @else {
            <ul class="space-y-2">
              @for (v of versions(); track v.id) {
                <li class="flex items-center justify-between rounded-xl border border-border-light dark:border-gray-700 px-3 py-2">
                  <div>
                    <div class="text-sm font-semibold text-text-primary dark:text-white">
                      {{ 'ITINERARY.VERSION_HISTORY.VERSION_LABEL' | translate: { number: v.versionNumber } }}
                      @if (v.reason) {
                        <span class="text-2xs font-medium text-text-tertiary dark:text-gray-500 ml-1">({{ v.reason }})</span>
                      }
                    </div>
                    <div class="text-2xs text-text-tertiary dark:text-gray-500">
                      {{ v.createdAt | date: 'medium' }} &middot; {{ v.segmentCount }} {{ 'ITINERARY.VERSION_HISTORY.SEGMENTS_UNIT' | translate }}
                    </div>
                  </div>
                  @if (confirmingId() === v.id) {
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class="text-2xs font-semibold text-text-tertiary hover:text-text-primary dark:hover:text-white px-2 py-1"
                        (click)="confirmingId.set(null)"
                      >
                        {{ 'ITINERARY.VERSION_HISTORY.CANCEL' | translate }}
                      </button>
                      <button
                        type="button"
                        class="text-2xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg px-2 py-1 disabled:opacity-60"
                        [disabled]="restoring()"
                        (click)="restore(v.id)"
                      >
                        {{ 'ITINERARY.VERSION_HISTORY.CONFIRM_RESTORE' | translate }}
                      </button>
                    </div>
                  } @else {
                    <button
                      type="button"
                      class="text-2xs font-semibold text-primary hover:underline px-2 py-1 disabled:opacity-60"
                      [disabled]="restoring()"
                      (click)="confirmingId.set(v.id)"
                    >
                      {{ 'ITINERARY.VERSION_HISTORY.RESTORE' | translate }}
                    </button>
                  }
                </li>
              }
            </ul>
            @if (restoreError()) {
              <p class="text-2xs text-red-600 dark:text-red-400 mt-3">{{ 'ITINERARY.VERSION_HISTORY.RESTORE_ERROR' | translate }}</p>
            }
          }
        </div>
      </div>
    }
  `
})
export class TripVersionHistoryComponent implements OnChanges {
  @Input() open = false;
  @Input() tripId: string | null = null;
  @Output() close = new EventEmitter<void>();
  /** Emits after a successful restore so the parent page can reload the trip. */
  @Output() restored = new EventEmitter<void>();

  protected readonly versions = signal<TripVersionSummary[]>([]);
  protected readonly loading = signal(false);
  protected readonly confirmingId = signal<string | null>(null);
  protected readonly restoring = signal(false);
  protected readonly restoreError = signal(false);

  constructor(private tripService: TripService) {}

  ngOnChanges(): void {
    if (this.open && this.tripId) {
      this.confirmingId.set(null);
      this.restoreError.set(false);
      this.loading.set(true);
      this.tripService.getTripVersions(this.tripId).then((versions) => {
        this.versions.set(versions);
        this.loading.set(false);
      });
    }
  }

  protected requestClose(): void {
    if (this.restoring()) return;
    this.confirmingId.set(null);
    this.close.emit();
  }

  protected async restore(versionId: string): Promise<void> {
    if (!this.tripId) return;
    this.restoring.set(true);
    this.restoreError.set(false);
    const result = await this.tripService.restoreTripVersion(this.tripId, versionId);
    this.restoring.set(false);
    if (!result) {
      this.restoreError.set(true);
      return;
    }
    this.confirmingId.set(null);
    this.restored.emit();
    this.close.emit();
  }
}
