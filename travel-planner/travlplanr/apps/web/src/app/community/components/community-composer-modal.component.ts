import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';

import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { CommunityCreatePostComponent } from './community-create-post.component';
import { CommunityPost } from '../services/community-post.service';

interface ComposerTypeOption {
  labelKey: string;
  hintKey: string;
  icon: string;
  /** Real create-post type value to preselect, or null to navigate elsewhere instead of opening the composer. */
  postType: string | null;
  route?: string;
}

const TYPE_OPTIONS: ComposerTypeOption[] = [
  { labelKey: 'COMMUNITY.COMPOSER_MODAL.TYPE_TIP', hintKey: 'COMMUNITY.COMPOSER_MODAL.HINT_TIP', icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z', postType: 'photo' },
  { labelKey: 'COMMUNITY.COMPOSER_MODAL.TYPE_PHOTO', hintKey: 'COMMUNITY.COMPOSER_MODAL.HINT_PHOTO', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z', postType: 'photo' },
  { labelKey: 'COMMUNITY.COMPOSER_MODAL.TYPE_TRIP', hintKey: 'COMMUNITY.COMPOSER_MODAL.HINT_TRIP', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z', postType: 'trip_share' },
  { labelKey: 'COMMUNITY.COMPOSER_MODAL.TYPE_QUESTION', hintKey: 'COMMUNITY.COMPOSER_MODAL.HINT_QUESTION', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', postType: 'question' },
  { labelKey: 'COMMUNITY.COMPOSER_MODAL.TYPE_POLL', hintKey: 'COMMUNITY.COMPOSER_MODAL.HINT_POLL', icon: 'M3 3v18h18M8 17V9m4 8V5m4 12v-6', postType: 'poll' },
  { labelKey: 'COMMUNITY.COMPOSER_MODAL.TYPE_MEETUP', hintKey: 'COMMUNITY.COMPOSER_MODAL.HINT_MEETUP', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', postType: null, route: '/community/events' },
  { labelKey: 'COMMUNITY.COMPOSER_MODAL.TYPE_BUDDY', hintKey: 'COMMUNITY.COMPOSER_MODAL.HINT_BUDDY', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm6-3h-3m0 0h-3m3 0v-3m0 3v3M13 7a4 4 0 11-8 0 4 4 0 018 0z', postType: 'buddy_request' },
];

@Component({
  selector: 'app-community-composer-modal',
  imports: [TranslatePipe, CommunityCreatePostComponent],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="composer-modal-title"
      (click)="close.emit()"
    >
      <div
        class="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-800 shadow-2xl"
        (click)="$event.stopPropagation()"
      >
        <div class="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-gray-700">
          <div class="flex items-center gap-2.5 min-w-0">
            @if (selectedType()) {
              <button
                type="button"
                (click)="selectedType.set(null)"
                class="w-8 h-8 rounded-lg flex items-center justify-center text-text-faint hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors shrink-0"
                [attr.aria-label]="'COMMUNITY.COMPOSER_MODAL.BACK_ARIA' | translate"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
              </button>
            }
            <div class="flex flex-col gap-0.5 min-w-0">
              <h2 id="composer-modal-title" class="text-base font-extrabold text-text-primary">{{ 'COMMUNITY.COMPOSER_MODAL.TITLE' | translate }}</h2>
              <p class="text-xs font-medium text-text-faint">{{ 'COMMUNITY.COMPOSER_MODAL.SUBTITLE' | translate }}</p>
            </div>
          </div>
          <button
            type="button"
            (click)="close.emit()"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-text-faint hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors shrink-0"
            [attr.aria-label]="'COMMUNITY.COMPOSER_MODAL.CLOSE_ARIA' | translate"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        @if (!selectedType()) {
          <div class="p-4 flex flex-col gap-2.5">
            @for (option of typeOptions; track option.labelKey) {
              <button
                type="button"
                (click)="selectType(option)"
                class="flex items-center gap-3.5 p-3.5 rounded-xl border border-slate-100 dark:border-gray-700 hover:border-primary-subtle/60 hover:bg-primary-50/40 dark:hover:bg-gray-700/40 transition-colors text-left focus:outline-none"
              >
                <span class="w-10 h-10 rounded-xl bg-primary-50 text-primary flex items-center justify-center shrink-0">
                  <svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" [attr.d]="option.icon"/></svg>
                </span>
                <span class="flex-1 min-w-0">
                  <span class="block text-sm font-extrabold text-text-primary">{{ option.labelKey | translate }}</span>
                  <span class="block text-xs font-medium text-text-faint mt-0.5">{{ option.hintKey | translate }}</span>
                </span>
                <svg class="w-4 h-4 text-text-disabled shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
            }
          </div>
        } @else {
          <div class="p-4">
            <app-community-create-post
              [userAvatar]="userAvatar"
              [initialType]="selectedType() ?? undefined"
              (postCreated)="postCreated.emit($event); close.emit()"
              (closed)="close.emit()"
            />
          </div>
        }
      </div>
    </div>
  `,
})
export class CommunityComposerModalComponent {
  @Input() userAvatar?: string;
  @Output() postCreated = new EventEmitter<CommunityPost>();
  @Output() close = new EventEmitter<void>();

  private readonly router = inject(Router);

  readonly typeOptions = TYPE_OPTIONS;
  readonly selectedType = signal<string | null>(null);

  selectType(option: ComposerTypeOption): void {
    if (option.postType) {
      this.selectedType.set(option.postType);
      return;
    }
    if (option.route) {
      this.close.emit();
      this.router.navigateByUrl(option.route);
    }
  }
}
