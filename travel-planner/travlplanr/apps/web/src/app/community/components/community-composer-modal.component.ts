import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';
import { CommunityCreatePostComponent } from './community-create-post.component';
import { CommunityTipComposerComponent } from './community-tip-composer.component';
import { CommunityPhotoComposerComponent } from './community-photo-composer.component';
import { CommunityTripComposerComponent } from './community-trip-composer.component';
import { CommunityQuestionComposerComponent } from './community-question-composer.component';
import { CommunityMeetupComposerComponent } from './community-meetup-composer.component';
import { CommunityBuddyComposerComponent } from './community-buddy-composer.component';
import { CommunityPost } from '../services/community-post.service';

interface ComposerTypeOption {
  labelKey: string;
  hintKey: string;
  icon: string;
  postType: string;
}

const TYPE_OPTIONS: ComposerTypeOption[] = [
  { labelKey: 'COMMUNITY.COMPOSER_MODAL.TYPE_TIP', hintKey: 'COMMUNITY.COMPOSER_MODAL.HINT_TIP', icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z', postType: 'tip' },
  { labelKey: 'COMMUNITY.COMPOSER_MODAL.TYPE_PHOTO', hintKey: 'COMMUNITY.COMPOSER_MODAL.HINT_PHOTO', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z', postType: 'photo' },
  { labelKey: 'COMMUNITY.COMPOSER_MODAL.TYPE_TRIP', hintKey: 'COMMUNITY.COMPOSER_MODAL.HINT_TRIP', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z', postType: 'trip_share' },
  { labelKey: 'COMMUNITY.COMPOSER_MODAL.TYPE_QUESTION', hintKey: 'COMMUNITY.COMPOSER_MODAL.HINT_QUESTION', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', postType: 'question' },
  { labelKey: 'COMMUNITY.COMPOSER_MODAL.TYPE_POLL', hintKey: 'COMMUNITY.COMPOSER_MODAL.HINT_POLL', icon: 'M3 3v18h18M8 17V9m4 8V5m4 12v-6', postType: 'poll' },
  { labelKey: 'COMMUNITY.COMPOSER_MODAL.TYPE_MEETUP', hintKey: 'COMMUNITY.COMPOSER_MODAL.HINT_MEETUP', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', postType: 'meetup' },
  { labelKey: 'COMMUNITY.COMPOSER_MODAL.TYPE_BUDDY', hintKey: 'COMMUNITY.COMPOSER_MODAL.HINT_BUDDY', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm6-3h-3m0 0h-3m3 0v-3m0 3v3M13 7a4 4 0 11-8 0 4 4 0 018 0z', postType: 'buddy_request' },
];

@Component({
  selector: 'app-community-composer-modal',
  imports: [TranslatePipe, CommunityCreatePostComponent, CommunityTipComposerComponent, CommunityPhotoComposerComponent, CommunityTripComposerComponent, CommunityQuestionComposerComponent, CommunityMeetupComposerComponent, CommunityBuddyComposerComponent],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="composer-modal-title"
      (click)="close.emit()"
    >
      <div
        class="no-scrollbar w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-800 shadow-2xl"
        (click)="$event.stopPropagation()"
      >
        <div class="sticky top-0 z-10 rounded-t-2xl bg-white dark:bg-gray-800 flex items-start justify-between gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-gray-700">
          <div class="flex flex-col gap-1 min-w-0">
            @if (selectedType()) {
              <h2 id="composer-modal-title" class="text-base font-extrabold text-text-primary">{{ 'COMMUNITY.COMPOSER_MODAL.FORM_TITLE' | translate }}</h2>
              <p class="text-xs font-medium text-text-faint">{{ 'COMMUNITY.COMPOSER_MODAL.FORM_SUBTITLE' | translate }}</p>
            } @else {
              <h2 id="composer-modal-title" class="text-base font-extrabold text-text-primary">{{ 'COMMUNITY.COMPOSER_MODAL.TITLE' | translate }}</h2>
              <p class="text-xs font-medium text-text-faint">{{ 'COMMUNITY.COMPOSER_MODAL.SUBTITLE' | translate }}</p>
            }
          </div>
          <button
            type="button"
            (click)="close.emit()"
            class="w-7 h-7 rounded-lg border border-slate-200 dark:border-gray-600 flex items-center justify-center text-text-faint hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors shrink-0"
            [attr.aria-label]="'COMMUNITY.COMPOSER_MODAL.CLOSE_ARIA' | translate"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        @if (!selectedType()) {
          <div class="p-4 flex flex-col gap-2">
            @for (option of typeOptions; track option.labelKey) {
              <button
                type="button"
                (click)="selectType(option)"
                class="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-gray-700 hover:border-primary-subtle/60 hover:bg-primary-50/40 dark:hover:bg-gray-700/40 transition-colors text-left focus:outline-none"
              >
                <span class="w-9 h-9 rounded-lg bg-primary-50 text-primary flex items-center justify-center shrink-0">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" [attr.d]="option.icon"/></svg>
                </span>
                <span class="flex-1 min-w-0">
                  <span class="block text-sm font-extrabold text-text-primary">{{ option.labelKey | translate }}</span>
                  <span class="block text-xs font-medium text-text-faint mt-0.5">{{ option.hintKey | translate }}</span>
                </span>
                <svg class="w-3.5 h-3.5 text-text-disabled shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
            }
          </div>
        } @else {
          @if (selectedOption(); as option) {
            <div class="mx-4 mt-3 flex items-center gap-2.5 p-2.5 rounded-xl bg-primary-50/50 border border-primary-subtle/40">
              <span class="w-8 h-8 rounded-lg bg-white text-primary flex items-center justify-center shrink-0 shadow-sm">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" [attr.d]="option.icon"/></svg>
              </span>
              <span class="flex-1 min-w-0">
                <span class="block text-xs font-extrabold text-text-primary">{{ option.labelKey | translate }}</span>
                <span class="block text-[11px] font-medium text-text-faint">{{ option.hintKey | translate }}</span>
              </span>
              <button
                type="button"
                (click)="selectedType.set(null)"
                class="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-[11px] font-bold text-text-secondary hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors shrink-0"
              >{{ 'COMMUNITY.COMPOSER_MODAL.CHANGE' | translate }}</button>
            </div>
          }

          @if (selectedType() === 'tip') {
            <app-community-tip-composer
              (posted)="postCreated.emit($event); close.emit()"
              (cancel)="close.emit()"
            />
          } @else if (selectedType() === 'photo') {
            <app-community-photo-composer
              (posted)="postCreated.emit($event); close.emit()"
              (cancel)="close.emit()"
            />
          } @else if (selectedType() === 'trip_share') {
            <app-community-trip-composer
              (posted)="postCreated.emit($event); close.emit()"
              (cancel)="close.emit()"
            />
          } @else if (selectedType() === 'question') {
            <app-community-question-composer
              (posted)="postCreated.emit($event); close.emit()"
              (cancel)="close.emit()"
            />
          } @else if (selectedType() === 'meetup') {
            <app-community-meetup-composer
              (posted)="close.emit()"
              (cancel)="close.emit()"
            />
          } @else if (selectedType() === 'buddy_request') {
            <app-community-buddy-composer
              (posted)="postCreated.emit($event); close.emit()"
              (cancel)="close.emit()"
            />
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
        }
      </div>
    </div>
  `,
  styles: [`
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  `],
})
export class CommunityComposerModalComponent {
  @Input() userAvatar?: string;
  @Output() postCreated = new EventEmitter<CommunityPost>();
  @Output() close = new EventEmitter<void>();

  readonly typeOptions = TYPE_OPTIONS;
  readonly selectedType = signal<string | null>(null);
  readonly selectedOption = computed(() => this.typeOptions.find(o => o.postType === this.selectedType()) ?? null);

  selectType(option: ComposerTypeOption): void {
    this.selectedType.set(option.postType);
  }
}
