import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { CollaborationService, TripComment } from '../../../collaboration/collaboration.service';
import { AuthService } from '../../../auth/auth.service';
import { ToastService } from '../../../shared/utils/toast.service';
import { TranslateService } from '@ngx-translate/core';

/** Threaded discussion for one day/segment of a trip — see services/planner TripComment. */
@Component({
    selector: 'app-trip-comments',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, FormsModule, TranslatePipe],
    template: `
    @if (open) {
      <div
        class="fixed inset-0 z-[1060] flex items-center justify-center bg-black/40 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trip-comments-title"
        (click)="close.emit()"
        (keydown.escape)="close.emit()"
      >
        <div
          class="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-card-hover flex flex-col max-h-[80vh]"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-center justify-between p-4 border-b border-border-light dark:border-gray-700">
            <h3 id="trip-comments-title" class="text-base font-bold text-text-primary dark:text-white">
              {{ 'ITINERARY.COMMENTS.TITLE' | translate: { day: dayNumber } }}
            </h3>
            <button type="button" class="text-text-tertiary hover:text-text-primary dark:hover:text-white" (click)="close.emit()" [attr.aria-label]="'ITINERARY.COMMENTS.CLOSE' | translate">&times;</button>
          </div>

          <div class="flex-1 overflow-y-auto p-4 space-y-3">
            @if (loading()) {
              <p class="text-sm text-text-secondary dark:text-gray-400">{{ 'ITINERARY.COMMENTS.LOADING' | translate }}</p>
            } @else if (comments().length === 0) {
              <p class="text-sm text-text-secondary dark:text-gray-400">{{ 'ITINERARY.COMMENTS.EMPTY' | translate }}</p>
            } @else {
              @for (c of comments(); track c.id) {
                <div class="rounded-xl border border-border-light dark:border-gray-700 p-3">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-sm font-semibold text-text-primary dark:text-white">{{ c.author_name }}</span>
                    <div class="flex items-center gap-2">
                      <span class="text-2xs text-text-tertiary dark:text-gray-500">{{ c.created_at | date: 'short' }}</span>
                      @if (canDelete(c)) {
                        <button type="button" class="text-2xs text-danger hover:underline" (click)="deleteComment(c)">
                          {{ 'ITINERARY.COMMENTS.DELETE' | translate }}
                        </button>
                      }
                    </div>
                  </div>
                  <p class="text-sm text-text-secondary dark:text-gray-300 whitespace-pre-wrap">{{ c.body }}</p>
                </div>
              }
            }
          </div>

          <div class="p-4 border-t border-border-light dark:border-gray-700 flex items-end gap-2">
            <textarea
              [(ngModel)]="draft"
              rows="2"
              [placeholder]="'ITINERARY.COMMENTS.PLACEHOLDER' | translate"
              class="flex-1 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary resize-none bg-transparent dark:text-white dark:border-gray-600"
            ></textarea>
            <button
              type="button"
              class="rounded-btn bg-primary text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              [disabled]="!draft.trim() || posting()"
              (click)="post()"
            >
              {{ 'ITINERARY.COMMENTS.SEND' | translate }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class TripCommentsComponent implements OnChanges {
  @Input() open = false;
  @Input() tripId: string | null = null;
  @Input() dayNumber: number | null = null;
  @Output() close = new EventEmitter<void>();

  protected readonly comments = signal<TripComment[]>([]);
  protected readonly loading = signal(false);
  protected readonly posting = signal(false);
  protected draft = '';

  constructor(
    private collaboration: CollaborationService,
    private auth: AuthService,
    private toast: ToastService,
    private translate: TranslateService,
  ) {}

  private get segmentId(): string {
    return `day-${this.dayNumber}`;
  }

  ngOnChanges(): void {
    if (this.open && this.tripId && this.dayNumber != null) {
      this.load();
    }
  }

  private load(): void {
    this.loading.set(true);
    this.collaboration.getComments(this.tripId!, this.segmentId).then((comments) => {
      this.comments.set(comments);
      this.loading.set(false);
    }).catch(() => {
      this.comments.set([]);
      this.loading.set(false);
    });
  }

  canDelete(comment: TripComment): boolean {
    return comment.author_id === this.auth.user()?.id;
  }

  async post(): Promise<void> {
    const body = this.draft.trim();
    if (!body || !this.tripId || this.dayNumber == null) return;
    this.posting.set(true);
    try {
      const comment = await this.collaboration.addComment(this.tripId, this.segmentId, body);
      this.comments.update((list) => [...list, comment]);
      this.draft = '';
    } catch {
      this.toast.error(this.translate.instant('ITINERARY.COMMENTS.POST_ERROR'));
    } finally {
      this.posting.set(false);
    }
  }

  async deleteComment(comment: TripComment): Promise<void> {
    if (!this.tripId) return;
    try {
      await this.collaboration.deleteComment(this.tripId, comment.id);
      this.comments.update((list) => list.filter((c) => c.id !== comment.id));
    } catch {
      this.toast.error(this.translate.instant('ITINERARY.COMMENTS.DELETE_ERROR'));
    }
  }
}
