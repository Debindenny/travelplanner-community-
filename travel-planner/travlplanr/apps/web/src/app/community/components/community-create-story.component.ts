import { Component, EventEmitter, Output, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CommunityStoryService } from '../services/community-story.service';
import { ToastService } from '../../shared/utils/toast.service';

@Component({
    selector: 'app-community-create-story',
    imports: [FormsModule, TranslatePipe],
    template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div class="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">

        <div class="flex items-center justify-between p-4 border-b">
          <h2 class="text-lg font-bold text-gray-900">{{ 'COMMUNITY.CREATE_STORY.TITLE' | translate }}</h2>
          <button
            (click)="close.emit()"
            class="text-gray-500 hover:text-gray-700 focus:outline-none"
            [attr.aria-label]="'COMMUNITY.CREATE_STORY.CLOSE' | translate"
          >
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="p-6 space-y-6">
          <!-- Media upload -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">{{ 'COMMUNITY.CREATE_STORY.IMAGE_URL' | translate }}</label>
            <input
              type="file"
              accept="image/*,video/*"
              (change)="onFileSelected($event)"
              class="w-full text-sm text-gray-700"
            />

            @if (isUploading()) {
              <p class="text-xs text-gray-500 mt-2">{{ 'COMMUNITY.CREATE_STORY.UPLOADING' | translate }}</p>
            }
            @if (mediaUrl()) {
              <div class="mt-4 aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden">
                <img [src]="mediaUrl()" [attr.alt]="'COMMUNITY.CREATE_STORY.IMAGE_PREVIEW_ALT' | translate" class="w-full h-full object-cover" (error)="imageError = true" />
              </div>
              @if (imageError) {
                <p class="text-xs text-red-500 mt-1">{{ 'COMMUNITY.CREATE_STORY.IMAGE_LOAD_ERROR' | translate }}</p>
              }
            }
          </div>

          <!-- Caption -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">{{ 'COMMUNITY.CREATE_STORY.CAPTION_OPTIONAL' | translate }}</label>
            <input
              type="text"
              [(ngModel)]="caption"
              [attr.placeholder]="'COMMUNITY.CREATE_STORY.CAPTION_PLACEHOLDER' | translate"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>
        </div>

        <div class="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <button
            (click)="close.emit()"
            class="px-4 py-2 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors"
          >
            {{ 'COMMUNITY.CREATE_STORY.CANCEL' | translate }}
          </button>
          <button
            (click)="submit()"
            [disabled]="isSubmitting() || isUploading() || !mediaUrl() || imageError"
            class="px-6 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {{ isSubmitting() ? ('COMMUNITY.CREATE_STORY.POSTING' | translate) : ('COMMUNITY.CREATE_STORY.SHARE_STORY' | translate) }}
          </button>
        </div>

      </div>
    </div>
  `
})
export class CommunityCreateStoryComponent {
  @Output() close = new EventEmitter<void>();
  @Output() created = new EventEmitter<void>();

  private storyService = inject(CommunityStoryService);
  private translate = inject(TranslateService);
  private toast = inject(ToastService);

  mediaUrl = signal('');
  caption = signal('');
  isSubmitting = signal(false);
  isUploading = signal(false);
  imageError = false;

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.imageError = false;
    this.isUploading.set(true);
    this.storyService.uploadMedia(file).subscribe({
      next: (res) => {
        this.mediaUrl.set(res.url);
        this.isUploading.set(false);
      },
      error: () => {
        this.isUploading.set(false);
        this.toast.error(this.translate.instant('COMMUNITY.CREATE_STORY.POST_FAILED'));
      }
    });
  }

  submit() {
    if (!this.mediaUrl() || this.imageError) return;

    this.isSubmitting.set(true);

    const payload = {
      media_url: this.mediaUrl(),
      caption: this.caption() || undefined
    };

    this.storyService.createStory(payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.created.emit();
        this.close.emit();
      },
      error: () => {
        this.isSubmitting.set(false);
        this.toast.error(this.translate.instant('COMMUNITY.CREATE_STORY.POST_FAILED'));
      }
    });
  }
}
