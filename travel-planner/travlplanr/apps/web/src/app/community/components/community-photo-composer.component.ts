import { ChangeDetectionStrategy, Component, computed, inject, output, signal, ViewChild, ElementRef } from '@angular/core';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin, of } from 'rxjs';
import { CommunityPostService, CommunityPost } from '../services/community-post.service';
import { apiErrorMessage } from '../../shared/utils/api-error.util';
import { AUDIENCE_OPTIONS, TipAudience } from './community-tip-composer.component';

interface MoodOption {
  value: string;
  labelKey: string;
}

const MOOD_OPTIONS: MoodOption[] = [
  { value: 'nature', labelKey: 'COMMUNITY.COMPOSER_MODAL.PHOTO_MOOD_NATURE' },
  { value: 'city', labelKey: 'COMMUNITY.COMPOSER_MODAL.PHOTO_MOOD_CITY' },
  { value: 'food', labelKey: 'COMMUNITY.COMPOSER_MODAL.PHOTO_MOOD_FOOD' },
  { value: 'people', labelKey: 'COMMUNITY.COMPOSER_MODAL.PHOTO_MOOD_PEOPLE' },
  { value: 'golden_hour', labelKey: 'COMMUNITY.COMPOSER_MODAL.PHOTO_MOOD_GOLDEN_HOUR' },
];

@Component({
  selector: 'app-community-photo-composer',
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
        <label class="block text-[9.5px] font-extrabold tracking-wide text-text-faint uppercase mb-1">{{ 'COMMUNITY.COMPOSER_MODAL.PHOTO_CAPTION_LABEL' | translate }}</label>
        <textarea
          [value]="caption()"
          (input)="caption.set($any($event.target).value)"
          [attr.placeholder]="'COMMUNITY.COMPOSER_MODAL.PHOTO_CAPTION_PLACEHOLDER' | translate"
          maxlength="500"
          class="w-full h-16 px-3 py-1.5 bg-white dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 rounded-lg focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-medium text-text-primary resize-none"
        ></textarea>
      </div>

      @if (previewImages().length === 0 && !videoPreviewUrl()) {
        <button
          type="button"
          (click)="fileInput.click()"
          class="flex flex-col items-center justify-center gap-1 py-3.5 rounded-xl border-2 border-dashed border-slate-200 dark:border-gray-700 hover:border-primary-subtle hover:bg-primary-50/30 transition-colors text-center"
        >
          <svg class="w-4 h-4 text-text-faint" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
          <span class="text-xs font-extrabold text-text-primary">{{ 'COMMUNITY.COMPOSER_MODAL.PHOTO_DROPZONE_TITLE' | translate }}</span>
          <span class="text-[11px] font-medium text-text-faint">{{ 'COMMUNITY.COMPOSER_MODAL.PHOTO_DROPZONE_SUBTITLE' | translate }}</span>
        </button>
      } @else {
        <div class="space-y-2">
          @if (previewImages().length > 0) {
            <div class="grid grid-cols-3 gap-1.5">
              @for (image of previewImages(); track image.url; let i = $index) {
                <div class="relative aspect-square rounded-lg overflow-hidden border border-slate-200/60 group">
                  <img [src]="image.url" class="w-full h-full object-cover" alt="" />
                  <button
                    type="button"
                    (click)="removeImage(i)"
                    [attr.aria-label]="'COMMUNITY.COMPOSER_MODAL.PHOTO_DROPZONE_REMOVE_ARIA' | translate"
                    class="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              }
            </div>
          }
          @if (videoPreviewUrl(); as url) {
            <div class="relative rounded-lg overflow-hidden border border-slate-200/60 bg-black">
              <video [src]="url" controls class="w-full max-h-44"></video>
              <button
                type="button"
                (click)="removeVideo()"
                [attr.aria-label]="'COMMUNITY.COMPOSER_MODAL.PHOTO_DROPZONE_REMOVE_ARIA' | translate"
                class="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          }
          <button type="button" (click)="fileInput.click()" class="text-[11px] font-bold text-primary hover:underline">
            {{ 'COMMUNITY.COMPOSER_MODAL.PHOTO_DROPZONE_TITLE' | translate }}
          </button>
        </div>
      }
      <input #fileInput type="file" accept="image/*,video/mp4,video/webm,video/quicktime" multiple class="hidden" (change)="onFileSelect($event)" />

      <div>
        <label class="block text-[9.5px] font-extrabold tracking-wide text-text-faint uppercase mb-1">{{ 'COMMUNITY.COMPOSER_MODAL.PHOTO_MOOD_LABEL' | translate }}</label>
        <div class="flex flex-wrap gap-1.5">
          @for (m of moods; track m.value) {
            <button
              type="button"
              (click)="mood.set(m.value)"
              class="px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors focus:outline-none"
              [class]="mood() === m.value ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-gray-800 text-text-secondary border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700'"
            >{{ m.labelKey | translate }}</button>
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
        >{{ 'COMMUNITY.COMPOSER_MODAL.SHARE_MOMENT' | translate }}</button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunityPhotoComposerComponent {
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  private readonly postService = inject(CommunityPostService);
  private readonly translate = inject(TranslateService);

  readonly moods = MOOD_OPTIONS;
  readonly audiences = AUDIENCE_OPTIONS;

  readonly destination = signal('');
  readonly caption = signal('');
  readonly mood = signal<string | null>(null);
  readonly audience = signal<TipAudience>('everyone');
  readonly previewImages = signal<{ file: File; url: string }[]>([]);
  readonly videoFile = signal<File | null>(null);
  readonly videoPreviewUrl = signal<string | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  readonly canPost = computed(() =>
    this.destination().trim().length > 0 && (this.previewImages().length > 0 || !!this.videoFile())
  );
  readonly selectedAudienceHint = computed(() => this.audiences.find(a => a.value === this.audience())?.hintKey ?? '');

  readonly posted = output<CommunityPost>();
  readonly cancel = output<void>();

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    Array.from(input.files).forEach(file => {
      if (file.type.startsWith('video/')) {
        this.videoFile.set(file);
        this.videoPreviewUrl.set(URL.createObjectURL(file));
      } else {
        this.previewImages.update(imgs => [...imgs, { file, url: URL.createObjectURL(file) }]);
      }
    });
    input.value = '';
  }

  removeImage(index: number): void {
    const imgs = this.previewImages();
    const removed = imgs[index];
    if (removed) URL.revokeObjectURL(removed.url);
    this.previewImages.set(imgs.filter((_, i) => i !== index));
  }

  removeVideo(): void {
    const url = this.videoPreviewUrl();
    if (url) URL.revokeObjectURL(url);
    this.videoFile.set(null);
    this.videoPreviewUrl.set(null);
  }

  submit(): void {
    if (!this.canPost() || this.isLoading()) return;

    this.isLoading.set(true);
    this.error.set(null);

    const moodTag = this.mood() ? ` #${this.mood()}` : '';
    const imageUploads = this.previewImages().map(img => this.postService.uploadImage(img.file));
    const video = this.videoFile();
    const videoUpload = video ? this.postService.uploadImage(video) : of(null);

    forkJoin({
      images: imageUploads.length ? forkJoin(imageUploads) : of([] as { url: string }[]),
      video: videoUpload,
    }).subscribe({
      next: ({ images, video }) => {
        this.postService.createPost({
          caption: this.caption().trim() + moodTag,
          location: this.destination().trim(),
          images: images.map(i => i.url),
          video_url: video?.url,
          is_reel: !!video,
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
      },
      error: () => {
        this.isLoading.set(false);
        this.error.set(this.translate.instant('COMMUNITY.CREATE_POST.UPLOAD_FAILED'));
      },
    });
  }
}
