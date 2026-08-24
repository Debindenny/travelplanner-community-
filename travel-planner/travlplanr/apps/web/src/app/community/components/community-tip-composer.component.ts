import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CommunityPostService, CommunityPost } from '../services/community-post.service';
import { apiErrorMessage } from '../../shared/utils/api-error.util';

export type TipAudience = 'everyone' | 'going' | 'circles';

interface TipCategory {
  value: string;
  labelKey: string;
}

const TIP_CATEGORIES: TipCategory[] = [
  { value: 'food', labelKey: 'COMMUNITY.COMPOSER_MODAL.TIP_CATEGORY_FOOD' },
  { value: 'transport', labelKey: 'COMMUNITY.COMPOSER_MODAL.TIP_CATEGORY_TRANSPORT' },
  { value: 'stays', labelKey: 'COMMUNITY.COMPOSER_MODAL.TIP_CATEGORY_STAYS' },
  { value: 'sights', labelKey: 'COMMUNITY.COMPOSER_MODAL.TIP_CATEGORY_SIGHTS' },
  { value: 'money', labelKey: 'COMMUNITY.COMPOSER_MODAL.TIP_CATEGORY_MONEY' },
  { value: 'safety', labelKey: 'COMMUNITY.COMPOSER_MODAL.TIP_CATEGORY_SAFETY' },
];

export const AUDIENCE_OPTIONS: { value: TipAudience; labelKey: string; hintKey: string }[] = [
  { value: 'everyone', labelKey: 'COMMUNITY.COMPOSER_MODAL.TIP_AUDIENCE_EVERYONE', hintKey: 'COMMUNITY.COMPOSER_MODAL.TIP_AUDIENCE_HINT_EVERYONE' },
  { value: 'going', labelKey: 'COMMUNITY.COMPOSER_MODAL.TIP_AUDIENCE_GOING', hintKey: 'COMMUNITY.COMPOSER_MODAL.TIP_AUDIENCE_HINT_GOING' },
  { value: 'circles', labelKey: 'COMMUNITY.COMPOSER_MODAL.TIP_AUDIENCE_CIRCLES', hintKey: 'COMMUNITY.COMPOSER_MODAL.TIP_AUDIENCE_HINT_CIRCLES' },
];

@Component({
  selector: 'app-community-tip-composer',
  imports: [TranslatePipe],
  template: `
    <div class="p-3.5 flex flex-col gap-3">
      <div>
        <label class="block text-[9.5px] font-extrabold tracking-wide text-text-faint uppercase mb-1">{{ 'COMMUNITY.COMPOSER_MODAL.TIP_DESTINATION_LABEL' | translate }}</label>
        <input
          type="text"
          [value]="destination()"
          (input)="destination.set($any($event.target).value)"
          [attr.placeholder]="'COMMUNITY.COMPOSER_MODAL.TIP_DESTINATION_PLACEHOLDER' | translate"
          class="w-full px-3 py-1.5 bg-white dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 rounded-lg focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-medium text-text-primary"
        />
      </div>

      <div>
        <label class="block text-[9.5px] font-extrabold tracking-wide text-text-faint uppercase mb-1">{{ 'COMMUNITY.COMPOSER_MODAL.TIP_TEXT_LABEL' | translate }}</label>
        <textarea
          [value]="tipText()"
          (input)="tipText.set($any($event.target).value)"
          [attr.placeholder]="'COMMUNITY.COMPOSER_MODAL.TIP_TEXT_PLACEHOLDER' | translate"
          maxlength="500"
          class="w-full h-16 px-3 py-1.5 bg-white dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 rounded-lg focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-medium text-text-primary resize-none"
        ></textarea>
      </div>

      <div>
        <label class="block text-[9.5px] font-extrabold tracking-wide text-text-faint uppercase mb-1">{{ 'COMMUNITY.COMPOSER_MODAL.TIP_CATEGORY_LABEL' | translate }}</label>
        <div class="flex flex-wrap gap-1.5">
          @for (cat of categories; track cat.value) {
            <button
              type="button"
              (click)="category.set(cat.value)"
              class="px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors focus:outline-none"
              [class]="category() === cat.value ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-gray-800 text-text-secondary border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700'"
            >{{ cat.labelKey | translate }}</button>
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
        >{{ 'COMMUNITY.COMPOSER_MODAL.POST_TIP' | translate }}</button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunityTipComposerComponent {
  private readonly postService = inject(CommunityPostService);
  private readonly translate = inject(TranslateService);

  readonly categories = TIP_CATEGORIES;
  readonly audiences = AUDIENCE_OPTIONS;

  readonly destination = signal('');
  readonly tipText = signal('');
  readonly category = signal<string | null>(null);
  readonly audience = signal<TipAudience>('everyone');
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  readonly canPost = computed(() => this.destination().trim().length > 0 && this.tipText().trim().length > 0);
  readonly selectedAudienceHint = computed(() => this.audiences.find(a => a.value === this.audience())?.hintKey ?? '');

  readonly posted = output<CommunityPost>();
  readonly cancel = output<void>();

  submit(): void {
    if (!this.canPost() || this.isLoading()) return;

    this.isLoading.set(true);
    this.error.set(null);

    const category = this.categories.find(c => c.value === this.category());
    const categoryTag = category ? ` #${this.category()}` : '';

    this.postService.createPost({
      caption: this.tipText().trim() + categoryTag,
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
