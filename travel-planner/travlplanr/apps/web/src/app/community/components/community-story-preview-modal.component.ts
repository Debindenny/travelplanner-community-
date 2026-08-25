import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';

import { A11yModule } from '@angular/cdk/a11y';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ToastService } from '../../shared/utils/toast.service';
import { PreviewStoryDetail } from './community-story-preview.mock';

@Component({
  selector: 'app-community-story-preview-modal',
  imports: [A11yModule, TranslatePipe],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in-up"
      (click)="close.emit()"
      (window:keydown.escape)="close.emit()"
    >
      <div
        class="relative w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl"
        cdkTrapFocus
        cdkTrapFocusAutoCapture
        (click)="$event.stopPropagation()"
      >
        <!-- Header: progress bar, avatar/name/location, status badge, close -->
        <div class="px-4 pt-3 pb-3">
          <div class="h-1 rounded-full bg-slate-200 overflow-hidden mb-3">
            <div class="h-full w-full rounded-full bg-primary"></div>
          </div>
          <div class="flex items-center gap-3">
            <span class="w-10 h-10 rounded-full shrink-0 bg-primary-50 text-primary flex items-center justify-center text-sm">
              {{ story.name.charAt(0) }}
            </span>
            <div class="flex-1 min-w-0">
              <p class="text-[13px] text-text-primary truncate">{{ story.name }}</p>
              <p class="text-[11.5px] text-text-faint truncate">{{ story.location }}</p>
            </div>
            <span
              class="shrink-0 text-[11px] px-3 py-1 rounded-full border whitespace-nowrap"
              [class]="statusClasses()"
            >
              {{ statusLabel() | translate }}
            </span>
            <button
              type="button"
              (click)="close.emit()"
              class="shrink-0 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 transition-colors focus:outline-none"
              [attr.aria-label]="'COMMUNITY.STORY_MODAL.CLOSE' | translate"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Photo -->
        <img [src]="story.image" class="w-full h-72 sm:h-80 object-cover" alt="" />

        <!-- Caption + actions -->
        <div class="bg-slate-900 text-white px-5 py-4">
          <p class="text-[12.5px] leading-relaxed">
            {{ 'COMMUNITY.STORIES_BAR.PREVIEW_MODAL.CAPTION' | translate: { name: story.name, location: story.location } }}
          </p>
          <div class="flex items-center justify-between mt-4">
            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="toggleFollow()"
                class="w-9 h-9 rounded-full flex items-center justify-center transition-colors focus:outline-none"
                [class.bg-primary]="!followed()"
                [class.bg-white]="followed()"
                [class.text-white]="!followed()"
                [class.text-primary]="followed()"
                [attr.aria-label]="(followed() ? 'COMMUNITY.STORIES_BAR.PREVIEW_MODAL.FOLLOWING_ARIA' : 'COMMUNITY.STORIES_BAR.PREVIEW_MODAL.FOLLOW_ARIA') | translate"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </button>
              <button
                type="button"
                (click)="explainUnavailable()"
                class="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors focus:outline-none"
                [attr.aria-label]="'COMMUNITY.STORIES_BAR.PREVIEW_MODAL.ROUTE_ARIA' | translate"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
                </svg>
              </button>
              <button
                type="button"
                (click)="explainUnavailable()"
                class="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors focus:outline-none"
                [attr.aria-label]="'COMMUNITY.STORIES_BAR.PREVIEW_MODAL.COMMENT_ARIA' | translate"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                </svg>
              </button>
            </div>
            <button
              type="button"
              (click)="toggleLike()"
              class="w-9 h-9 rounded-full border border-white flex items-center justify-center transition-colors focus:outline-none"
              [class.text-white]="!liked()"
              [class.bg-white]="liked()"
              [class.text-danger]="liked()"
              [attr.aria-label]="(liked() ? 'COMMUNITY.STORIES_BAR.PREVIEW_MODAL.UNLIKE_ARIA' : 'COMMUNITY.STORIES_BAR.PREVIEW_MODAL.LIKE_ARIA') | translate"
            >
              <svg class="w-4 h-4" [attr.fill]="liked() ? 'currentColor' : 'none'" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class CommunityStoryPreviewModalComponent {
  @Input({ required: true }) story!: PreviewStoryDetail;
  @Output() close = new EventEmitter<void>();

  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  readonly followed = signal(false);
  readonly liked = signal(false);

  statusLabel(): string {
    switch (this.story.status) {
      case 'there': return 'COMMUNITY.STORIES_BAR.PREVIEW_MODAL.STATUS_THERE';
      case 'soon': return 'COMMUNITY.STORIES_BAR.PREVIEW_MODAL.STATUS_SOON';
      default: return 'COMMUNITY.STORIES_BAR.PREVIEW_MODAL.STATUS_RECENT';
    }
  }

  statusClasses(): string {
    switch (this.story.status) {
      case 'there': return 'bg-white border-emerald-200 text-emerald-600';
      case 'soon': return 'bg-white border-primary-subtle text-primary';
      default: return 'bg-white border-slate-200 text-text-faint';
    }
  }

  toggleFollow(): void {
    this.followed.update(v => !v);
    this.toast.success(
      this.translate.instant('COMMUNITY.STORIES_BAR.PREVIEW_NOTICE', { name: this.story.name })
    );
  }

  toggleLike(): void {
    this.liked.update(v => !v);
  }

  explainUnavailable(): void {
    this.toast.success(
      this.translate.instant('COMMUNITY.STORIES_BAR.PREVIEW_NOTICE', { name: this.story.name })
    );
  }
}
