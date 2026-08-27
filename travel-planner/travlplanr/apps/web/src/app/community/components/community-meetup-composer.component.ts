import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CommunityEventsService } from '../services/community-events.service';
import { apiErrorMessage } from '../../shared/utils/api-error.util';
import { AUDIENCE_OPTIONS, TipAudience } from './community-tip-composer.component';

interface MeetupKind {
  value: string;
  labelKey: string;
}

const KIND_OPTIONS: MeetupKind[] = [
  { value: 'walk', labelKey: 'COMMUNITY.COMPOSER_MODAL.MEETUP_KIND_WALK' },
  { value: 'food', labelKey: 'COMMUNITY.COMPOSER_MODAL.MEETUP_KIND_FOOD' },
  { value: 'photography', labelKey: 'COMMUNITY.COMPOSER_MODAL.MEETUP_KIND_PHOTOGRAPHY' },
  { value: 'online', labelKey: 'COMMUNITY.COMPOSER_MODAL.MEETUP_KIND_ONLINE' },
  { value: 'free', labelKey: 'COMMUNITY.COMPOSER_MODAL.MEETUP_KIND_FREE' },
];

@Component({
  selector: 'app-community-meetup-composer',
  imports: [TranslatePipe],
  template: `
    <div class="p-3.5 flex flex-col gap-3">
      <div>
        <label class="block text-[9.5px] font-extrabold tracking-wide text-text-faint uppercase mb-1">{{ 'COMMUNITY.COMPOSER_MODAL.MEETUP_TITLE_LABEL' | translate }}</label>
        <input
          type="text"
          [value]="title()"
          (input)="title.set($any($event.target).value)"
          [attr.placeholder]="'COMMUNITY.COMPOSER_MODAL.MEETUP_TITLE_PLACEHOLDER' | translate"
          class="w-full px-3 py-1.5 bg-white dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 rounded-lg focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-medium text-text-primary"
        />
      </div>

      <div>
        <label class="block text-[9.5px] font-extrabold tracking-wide text-text-faint uppercase mb-1">{{ 'COMMUNITY.COMPOSER_MODAL.MEETUP_WHEN_WHERE_LABEL' | translate }}</label>
        <div class="flex flex-wrap gap-1.5">
          <input
            type="date"
            [value]="date()"
            (input)="date.set($any($event.target).value)"
            class="flex-1 min-w-[110px] px-3 py-1.5 bg-white dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 rounded-lg focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-medium text-text-primary"
          />
          <input
            type="time"
            [value]="time()"
            (input)="time.set($any($event.target).value)"
            class="w-24 px-3 py-1.5 bg-white dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 rounded-lg focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-medium text-text-primary"
          />
          <input
            type="text"
            [value]="location()"
            (input)="location.set($any($event.target).value)"
            [attr.placeholder]="'COMMUNITY.COMPOSER_MODAL.MEETUP_LOCATION_PLACEHOLDER' | translate"
            class="flex-[2] min-w-[140px] px-3 py-1.5 bg-white dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 rounded-lg focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-medium text-text-primary"
          />
        </div>
      </div>

      <div>
        <label class="block text-[9.5px] font-extrabold tracking-wide text-text-faint uppercase mb-1">
          Event Cost
        </label>

        <input
          type="text"
          [value]="cost()"
          (input)="cost.set($any($event.target).value)"
          placeholder="Free, ¥3000, ₹500, $20"
          class="w-full px-3 py-1.5 bg-white dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 rounded-lg focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-medium text-text-primary"
        />
      </div>

      <div>
        <label class="block text-[9.5px] font-extrabold tracking-wide text-text-faint uppercase mb-1">{{ 'COMMUNITY.COMPOSER_MODAL.MEETUP_DETAILS_LABEL' | translate }}</label>
        <textarea
          [value]="details()"
          (input)="details.set($any($event.target).value)"
          [attr.placeholder]="'COMMUNITY.COMPOSER_MODAL.MEETUP_DETAILS_PLACEHOLDER' | translate"
          maxlength="500"
          class="w-full h-16 px-3 py-1.5 bg-white dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 rounded-lg focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-medium text-text-primary resize-none"
        ></textarea>
      </div>

      <div>
        <label class="block text-[9.5px] font-extrabold tracking-wide text-text-faint uppercase mb-1">{{ 'COMMUNITY.COMPOSER_MODAL.MEETUP_KIND_LABEL' | translate }}</label>
        <div class="flex flex-wrap gap-1.5">
          @for (k of kinds; track k.value) {
            <button
              type="button"
              (click)="kind.set(k.value)"
              class="px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors focus:outline-none"
              [class]="kind() === k.value ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-gray-800 text-text-secondary border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700'"
            >{{ k.labelKey | translate }}</button>
          }
        </div>
      </div>

      <div>
        <label class="block text-[9.5px] font-extrabold tracking-wide text-text-faint uppercase mb-1">{{ 'COMMUNITY.COMPOSER_MODAL.TIP_AUDIENCE_LABEL' | translate }}</label>
        <div class="flex flex-wrap gap-1.5">
          @for (aud of audiences; track aud.value) {
            <button
              type="button"
              (click)="audience.set(aud.value)"
              class="px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors focus:outline-none"
              [class]="audience() === aud.value ? 'bg-white text-primary border-primary ring-2 ring-primary/20' : 'bg-white dark:bg-gray-800 text-text-secondary border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700'"
            >{{ aud.labelKey | translate }}</button>
          }
        </div>
        <p class="text-[11px] font-medium text-text-faint mt-1">{{ selectedAudienceHint() | translate }}</p>
      </div>

      @if (error()) {
        <div class="bg-danger-50 border border-red-200 text-danger px-2.5 py-2 rounded-lg text-[11px] font-semibold">
          {{ error() }}
        </div>
      }
    </div>

    <div class="sticky bottom-0 z-10 rounded-b-2xl bg-white dark:bg-gray-800 flex items-center justify-between gap-3 px-4 py-2.5 border-t border-slate-100 dark:border-gray-700">
      <p class="text-[11px] font-medium text-text-faint">
        {{ canPost() ? '' : ('COMMUNITY.COMPOSER_MODAL.TIP_FOOTER_HINT' | translate) }}
      </p>
      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          (click)="cancel.emit()"
          class="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-gray-600 text-xs font-bold text-text-secondary hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
        >{{ 'COMMUNITY.COMPOSER_MODAL.CANCEL' | translate }}</button>
        <button
          type="button"
          [disabled]="!canPost() || isLoading()"
          (click)="submit()"
          class="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors"
        >{{ 'COMMUNITY.COMPOSER_MODAL.PUBLISH_MEETUP' | translate }}</button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunityMeetupComposerComponent {
  private readonly eventsService = inject(CommunityEventsService);
  private readonly translate = inject(TranslateService);

  readonly kinds = KIND_OPTIONS;
  readonly audiences = AUDIENCE_OPTIONS;

  readonly title = signal('');
  readonly date = signal('');
  readonly time = signal('');
  readonly location = signal('');
  readonly cost = signal('');
  readonly details = signal('');
  readonly kind = signal<string | null>(null);
  readonly audience = signal<TipAudience>('everyone');
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  readonly canPost = computed(() =>
    this.title().trim().length > 0 && this.date().trim().length > 0 && this.time().trim().length > 0
  );
  readonly selectedAudienceHint = computed(() => this.audiences.find(a => a.value === this.audience())?.hintKey ?? '');

  readonly posted = output<void>();
  readonly cancel = output<void>();

  submit(): void {
    if (!this.canPost() || this.isLoading()) return;

    this.isLoading.set(true);
    this.error.set(null);

    const kindTag = this.kind() ? ` #${this.kind()}` : '';
    const startsAt = new Date(`${this.date()}T${this.time()}`).toISOString();

    this.eventsService.createEvent({
      title: this.title().trim(),
      description: this.details().trim() + kindTag,
      location: this.location().trim() || undefined,
      cost: this.cost().trim() || undefined,
      starts_at: startsAt,
    }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.posted.emit();
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(apiErrorMessage(err, this.translate.instant('COMMUNITY.CREATE_POST.CREATE_FAILED')));
      },
    });
  }
}
