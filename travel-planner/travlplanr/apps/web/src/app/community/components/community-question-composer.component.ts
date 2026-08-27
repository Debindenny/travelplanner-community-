import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CommunityPostService, CommunityPost } from '../services/community-post.service';
import { apiErrorMessage } from '../../shared/utils/api-error.util';
import { AUDIENCE_OPTIONS, TipAudience } from './community-tip-composer.component';

interface QuestionTopic {
  value: string;
  labelKey: string;
}

const TOPIC_OPTIONS: QuestionTopic[] = [
  { value: 'museums', labelKey: 'COMMUNITY.COMPOSER_MODAL.QUESTION_TOPIC_MUSEUMS' },
  { value: 'food', labelKey: 'COMMUNITY.COMPOSER_MODAL.QUESTION_TOPIC_FOOD' },
  { value: 'transport', labelKey: 'COMMUNITY.COMPOSER_MODAL.QUESTION_TOPIC_TRANSPORT' },
  { value: 'budget', labelKey: 'COMMUNITY.COMPOSER_MODAL.QUESTION_TOPIC_BUDGET' },
  { value: 'safety', labelKey: 'COMMUNITY.COMPOSER_MODAL.QUESTION_TOPIC_SAFETY' },
];

@Component({
  selector: 'app-community-question-composer',
  imports: [TranslatePipe],
  template: `
    <div class="p-3.5 flex flex-col gap-3">
      <div>
        <label class="block text-[9.5px] font-extrabold tracking-wide text-text-faint uppercase mb-1">{{ 'COMMUNITY.COMPOSER_MODAL.TIP_DESTINATION_LABEL' | translate }}</label>
        <input
          type="text"
          [value]="destination()"
          (input)="destination.set($any($event.target).value)"
          [attr.placeholder]="'COMMUNITY.COMPOSER_MODAL.QUESTION_DESTINATION_PLACEHOLDER' | translate"
          class="w-full px-3 py-1.5 bg-white dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 rounded-lg focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-medium text-text-primary"
        />
      </div>

      <div>
        <label class="block text-[9.5px] font-extrabold tracking-wide text-text-faint uppercase mb-1">{{ 'COMMUNITY.COMPOSER_MODAL.QUESTION_TEXT_LABEL' | translate }}</label>
        <textarea
          [value]="question()"
          (input)="question.set($any($event.target).value)"
          [attr.placeholder]="'COMMUNITY.COMPOSER_MODAL.QUESTION_TEXT_PLACEHOLDER' | translate"
          maxlength="500"
          class="w-full h-16 px-3 py-1.5 bg-white dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 rounded-lg focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-medium text-text-primary resize-none"
        ></textarea>
      </div>

      <div>
        <label class="block text-[9.5px] font-extrabold tracking-wide text-text-faint uppercase mb-1">{{ 'COMMUNITY.COMPOSER_MODAL.QUESTION_TOPIC_LABEL' | translate }}</label>
        <div class="flex flex-wrap gap-1.5">
          @for (t of topics; track t.value) {
            <button
              type="button"
              (click)="topic.set(t.value)"
              class="px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors focus:outline-none"
              [class]="topic() === t.value ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-gray-800 text-text-secondary border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700'"
            >{{ t.labelKey | translate }}</button>
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
        >{{ 'COMMUNITY.COMPOSER_MODAL.ASK_COMMUNITY' | translate }}</button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunityQuestionComposerComponent {
  private readonly postService = inject(CommunityPostService);
  private readonly translate = inject(TranslateService);

  readonly topics = TOPIC_OPTIONS;
  readonly audiences = AUDIENCE_OPTIONS;

  readonly destination = signal('');
  readonly question = signal('');
  readonly topic = signal<string | null>(null);
  readonly audience = signal<TipAudience>('everyone');
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  readonly canPost = computed(() => this.destination().trim().length > 0 && this.question().trim().length > 0);
  readonly selectedAudienceHint = computed(() => this.audiences.find(a => a.value === this.audience())?.hintKey ?? '');

  readonly posted = output<CommunityPost>();
  readonly cancel = output<void>();

  submit(): void {
    if (!this.canPost() || this.isLoading()) return;

    this.isLoading.set(true);
    this.error.set(null);

    const topic = this.topics.find(t => t.value === this.topic());
    const topicTag = topic ? ` #${this.topic()}` : '';

    this.postService.createPost({
      caption: this.question().trim() + topicTag,
      location: this.destination().trim(),
      images: [],
    }).subscribe({
      next: (post) => {
        this.isLoading.set(false);
        this.posted.emit(post);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(apiErrorMessage(err, this.translate.instant('COMMUNITY.CREATE_POST.CREATE_FAILED')));
      },
    });
  }
}
