import { Component, OnInit, OnDestroy, inject, signal, computed, NgZone } from '@angular/core';

import { A11yModule } from '@angular/cdk/a11y';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CommunityStoryService, StoryGroup, Story } from '../services/community-story.service';
import { CommunityProfileService } from '../services/community-profile.service';
import { ToastService } from '../../shared/utils/toast.service';
import { PreviewStoryDetail, PREVIEW_STORY_DETAILS } from './community-story-preview.mock';
import { AUDIENCE_OPTIONS, TipAudience } from './community-tip-composer.component';

const SEEN_STORIES_KEY = 'community_seen_stories';
const QUICK_EMOJIS = ['✨', '❤️', '🥳', '🌍', '📷', '☀️', '⛺'];

@Component({
    selector: 'app-community-stories-bar',
    imports: [TranslatePipe, A11yModule],
    template: `
    <div class="flex gap-4 overflow-x-auto no-scrollbar items-start max-w-2xl py-2 px-1">

      <!-- Add Story -->
      <button
        type="button"
        (click)="openCreateStoryModal()"
        class="group flex flex-col items-center gap-1.5 w-[72px] shrink-0 focus:outline-none"
      >
        <span class="relative w-16 h-16 rounded-full border-2 border-dashed border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 flex items-center justify-center overflow-hidden transition-transform duration-300 group-hover:scale-105 group-active:scale-95">
          <img
            [src]="myAvatar() || '/assets/images/default-avatar.svg'"
            class="absolute inset-0 w-full h-full object-cover opacity-40"
          />
          <span class="relative z-10 w-7 h-7 rounded-full bg-primary group-hover:bg-primary-hover text-white flex items-center justify-center border-2 border-white dark:border-gray-800 shadow-md transition-transform group-hover:scale-110">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3.5" d="M12 4v16m8-8H4" />
            </svg>
          </span>
        </span>
        <span class="text-2xs font-semibold text-text-tertiary truncate max-w-full">{{ 'COMMUNITY.STORIES_BAR.YOUR_STORY' | translate }}</span>
      </button>

      <!-- Skeletons (when loading) -->
      @if (isLoading()) {
        @for (i of [1, 2, 3, 4]; track i) {
          <div class="flex flex-col items-center gap-1.5 w-[72px] shrink-0">
            <div class="w-16 h-16 rounded-full bg-slate-200/60 dark:bg-gray-700 animate-pulse"></div>
            <div class="h-2 w-10 rounded bg-slate-200/60 dark:bg-gray-700 animate-pulse"></div>
          </div>
        }
      }

      <!-- Story rings -->
      @for (group of feed(); track group.author.id; let i = $index) {
        <button
          type="button"
          (click)="openStory(i, group)"
          class="group flex flex-col items-center gap-1.5 w-[72px] shrink-0 text-center focus:outline-none"
          [attr.aria-label]="'COMMUNITY.STORIES_BAR.VIEW_STORY_ARIA' | translate"
        >
          <!-- Gradient ring if unseen, grey ring if seen -->
          <span
            class="relative w-16 h-16 rounded-full p-[2.5px] transition-transform duration-300 group-hover:scale-105 group-active:scale-95"
            [class.bg-gradient-to-tr]="!isGroupSeen(group)"
            [class.from-amber-400]="!isGroupSeen(group)"
            [class.via-pink-500]="!isGroupSeen(group)"
            [class.to-fuchsia-600]="!isGroupSeen(group)"
            [class.bg-slate-300]="isGroupSeen(group)"
            [class.dark:bg-gray-600]="isGroupSeen(group)"
          >
            <span class="block w-full h-full rounded-full border-2 border-white dark:border-gray-800 overflow-hidden bg-slate-100 dark:bg-gray-700">
              @if (group.stories[0].media_url; as thumbUrl) {
                <img [src]="thumbUrl" class="w-full h-full object-cover" alt="" />
              } @else {
                <span class="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary to-indigo-600 text-white text-[8px] font-bold text-center px-1 leading-tight">
                  {{ group.stories[0].caption }}
                </span>
              }
            </span>

            <!-- Seen check overlay -->
            @if (isGroupSeen(group)) {
              <span class="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-sm border border-slate-100 dark:border-gray-700">
                <svg class="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              </span>
            }
          </span>

          <!-- Author name -->
          <span class="text-2xs font-semibold text-text-primary truncate max-w-full">{{ group.author.name }}</span>
        </button>
      }

      <!-- Preview stories (shown only while the real feed is empty) -->
      @if (!isLoading() && feed().length === 0) {
        @for (story of previewStories; track story.name) {
          <button
            type="button"
            (click)="openPreviewStory(story)"
            class="group flex flex-col items-center gap-1.5 w-[72px] shrink-0 text-center focus:outline-none"
          >
            <span
              class="relative w-16 h-16 rounded-full p-[2.5px] transition-transform duration-300 group-hover:scale-105 group-active:scale-95"
              [style.background]="ringGradient(story.status)"
            >
              <span class="block w-full h-full rounded-full border-2 border-white dark:border-gray-800 overflow-hidden bg-slate-100 dark:bg-gray-700">
                <img [src]="story.image" class="w-full h-full object-cover" alt="" />
              </span>
            </span>
            <span class="text-2xs font-semibold text-text-primary truncate max-w-full">{{ story.name }}</span>
          </button>
        }
      }

    </div>

    @if (showStoryModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
           (click)="closeStoryModal()"
           (window:keydown.escape)="closeStoryModal()">
        <button
          (click)="closeStoryModal(); $event.stopPropagation()"
          class="absolute top-4 right-4 text-white hover:text-gray-300 z-[60] focus:outline-none"
          [attr.aria-label]="'COMMUNITY.STORY_MODAL.CLOSE' | translate"
        >
          <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div class="relative w-full max-w-md h-[80vh] sm:h-[90vh] bg-black rounded-xl overflow-hidden flex flex-col"
             cdkTrapFocus
             cdkTrapFocusAutoCapture
             (click)="$event.stopPropagation()">
          <!-- Progress Bars -->
          <div class="absolute top-0 inset-x-0 p-4 flex gap-1 z-10 bg-gradient-to-b from-black/60 to-transparent">
            @for (story of activeGroup?.stories; track story.id; let i = $index) {
              <div class="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                <div
                  [id]="'story-progress-' + i"
                  class="h-full bg-white transition-all duration-100 ease-linear"
                  [style.width.%]="getProgressWidth(i)"
                ></div>
              </div>
            }
          </div>

          <!-- Header -->
          <div class="absolute top-6 inset-x-0 px-4 flex items-center gap-3 z-10">
            <img
              [src]="activeGroup?.author?.avatar || '/assets/images/default-avatar.svg'"
              class="w-10 h-10 rounded-full border border-white/50"
            />
            <span class="text-white font-semibold shadow-sm">{{ activeGroup?.author?.name }}</span>
          </div>

          <!-- Media -->
          <div class="flex-1 relative flex items-center justify-center">
            @if (currentStory?.media_url; as storyMediaUrl) {
              <img
                [src]="storyMediaUrl"
                class="w-full h-full object-contain"
                (click)="handleTap($event)"
              />

              @if (currentStory?.caption) {
                <div class="absolute bottom-10 inset-x-0 text-center px-6 z-10">
                  <p class="text-white bg-black/50 backdrop-blur-md px-4 py-2 rounded-xl inline-block text-sm">
                    {{ currentStory?.caption }}
                  </p>
                </div>
              }
            } @else {
              <!-- Text-only story: no media, so the caption itself becomes the story. -->
              <div
                class="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary via-indigo-600 to-fuchsia-600 px-8"
                (click)="handleTap($event)"
              >
                <p class="text-white text-xl sm:text-2xl font-bold text-center leading-snug">{{ currentStory?.caption }}</p>
              </div>
            }
          </div>

          <!-- Navigation invisible zones -->
          <div class="absolute inset-y-0 left-0 w-1/3 cursor-pointer z-0" (click)="prevStory()"></div>
          <div class="absolute inset-y-0 right-0 w-1/3 cursor-pointer z-0" (click)="nextStory()"></div>
        </div>
      </div>
    }

    @if (showCreateModal()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-story-title"
        (click)="closeCreateStoryModal()"
        (window:keydown.escape)="closeCreateStoryModal()"
      >
        <div
          class="relative w-full max-w-md max-h-[90vh] overflow-y-auto no-scrollbar rounded-2xl bg-white dark:bg-gray-800 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          cdkTrapFocus
          cdkTrapFocusAutoCapture
          (click)="$event.stopPropagation()"
        >
          <!-- Header -->
          <div class="sticky top-0 z-10 rounded-t-2xl bg-white dark:bg-gray-800 flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-gray-700">
            <div class="flex flex-col gap-1 min-w-0">
              <h2 id="create-story-title" class="text-lg font-extrabold text-text-primary">{{ 'COMMUNITY.CREATE_STORY.TITLE' | translate }}</h2>
              <p class="text-xs font-medium text-text-faint">{{ 'COMMUNITY.COMPOSER_MODAL.FORM_SUBTITLE' | translate }}</p>
            </div>
            <button
              type="button"
              (click)="closeCreateStoryModal()"
              class="w-7 h-7 rounded-lg border border-slate-200 dark:border-gray-600 flex items-center justify-center text-text-faint hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors shrink-0"
              [attr.aria-label]="'COMMUNITY.CREATE_STORY.CLOSE' | translate"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="p-5 flex flex-col gap-5">

            <!-- Post type row — a story is always Photo/Video-capable, but media is
                 optional (text-only stories are allowed), so this both confirms the
                 type and offers a shortcut to swap the selected media. -->
            <div class="flex items-center gap-2.5 p-2.5 rounded-xl bg-primary-50/50 border border-primary-subtle/40">
              <span class="w-8 h-8 rounded-lg bg-white text-primary flex items-center justify-center shrink-0 shadow-sm">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </span>
              <span class="flex-1 min-w-0">
                <span class="block text-xs font-extrabold text-text-primary">{{ 'COMMUNITY.CREATE_STORY.TYPE_ROW_TITLE' | translate }}</span>
                <span class="block text-[11px] font-medium text-text-faint">{{ 'COMMUNITY.CREATE_STORY.TYPE_ROW_HINT' | translate }}</span>
              </span>
              @if (mediaUrl()) {
                <button
                  type="button"
                  (click)="fileInput.click()"
                  class="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-[11px] font-bold text-text-secondary hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors shrink-0"
                >{{ 'COMMUNITY.COMPOSER_MODAL.CHANGE' | translate }}</button>
              }
            </div>

            <!-- Caption -->
            <div>
              <div class="flex items-center justify-between gap-2 mb-1.5">
                <label for="create-story-caption" class="text-[9.5px] font-extrabold tracking-wide text-text-faint uppercase">{{ 'COMMUNITY.COMPOSER_MODAL.PHOTO_CAPTION_LABEL' | translate }}</label>
                <div class="flex items-center gap-0.5">
                  @for (emoji of quickEmojis; track emoji) {
                    <button
                      type="button"
                      (click)="insertEmoji(emoji)"
                      class="w-6 h-6 flex items-center justify-center text-base rounded-md hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors focus:outline-none"
                      [attr.aria-label]="'COMMUNITY.CREATE_STORY.EMOJI_INSERT_ARIA' | translate: { emoji }"
                    >{{ emoji }}</button>
                  }
                </div>
              </div>
              <textarea
                id="create-story-caption"
                [value]="caption()"
                (input)="caption.set($any($event.target).value)"
                [attr.placeholder]="'COMMUNITY.COMPOSER_MODAL.PHOTO_CAPTION_PLACEHOLDER' | translate"
                maxlength="500"
                rows="3"
                class="w-full px-3.5 py-2.5 bg-white dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm text-text-primary resize-none"
              ></textarea>
            </div>

            <!-- Media upload -->
            <div>
              @if (!mediaUrl() && !isUploading()) {
                <button
                  type="button"
                  (click)="fileInput.click()"
                  class="w-full flex flex-col items-center justify-center gap-1.5 py-8 rounded-xl border-2 border-dashed border-slate-200 dark:border-gray-700 hover:border-primary-subtle hover:bg-primary-50/30 transition-colors text-center focus:outline-none"
                >
                  <svg class="w-6 h-6 text-text-faint" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
                  <span class="text-sm font-extrabold text-text-primary">{{ 'COMMUNITY.CREATE_STORY.DROPZONE_TITLE' | translate }}</span>
                  <span class="text-[11px] font-medium text-text-faint">{{ 'COMMUNITY.CREATE_STORY.DROPZONE_SUBTITLE' | translate }} · {{ 'COMMUNITY.CREATE_STORY.OPTIONAL' | translate }}</span>
                </button>
              } @else if (isUploading()) {
                <div class="flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-slate-200 dark:border-gray-700">
                  <div class="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                  <span class="text-xs font-semibold text-text-faint">{{ 'COMMUNITY.CREATE_STORY.UPLOADING' | translate }}</span>
                </div>
              } @else {
                <div class="relative aspect-[3/4] max-h-72 mx-auto rounded-xl overflow-hidden border border-slate-200/60 dark:border-gray-700 bg-black">
                  @if (isMediaVideo()) {
                    <video [src]="mediaUrl()" controls class="w-full h-full object-contain"></video>
                  } @else {
                    <img
                      [src]="mediaUrl()"
                      [attr.alt]="'COMMUNITY.CREATE_STORY.IMAGE_PREVIEW_ALT' | translate"
                      class="w-full h-full object-cover"
                      (error)="onPreviewError()"
                    />
                  }
                  <button
                    type="button"
                    (click)="clearMedia()"
                    [attr.aria-label]="'COMMUNITY.COMPOSER_MODAL.PHOTO_DROPZONE_REMOVE_ARIA' | translate"
                    class="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
                @if (imageError()) {
                  <p class="text-xs font-semibold text-danger mt-2">{{ 'COMMUNITY.CREATE_STORY.IMAGE_LOAD_ERROR' | translate }}</p>
                }
              }
              <input #fileInput type="file" accept="image/*,video/*" class="hidden" (change)="onFileSelected($event)" />
            </div>

            <!-- Audience -->
            <div>
              <label class="block text-[9.5px] font-extrabold tracking-wide text-text-faint uppercase mb-1.5">{{ 'COMMUNITY.COMPOSER_MODAL.TIP_AUDIENCE_LABEL' | translate }}</label>
              <div class="grid grid-cols-3 gap-2">
                @for (aud of audiences; track aud.value) {
                  <button
                    type="button"
                    (click)="audience.set(aud.value)"
                    class="px-2 py-2 rounded-lg text-[11px] font-bold border text-center leading-tight transition-colors focus:outline-none"
                    [class]="audience() === aud.value ? 'bg-primary-50 text-primary border-primary' : 'bg-white dark:bg-gray-800 text-text-secondary border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700'"
                    [attr.aria-pressed]="audience() === aud.value"
                  >{{ aud.labelKey | translate }}</button>
                }
              </div>
              <p class="text-[11px] font-medium text-text-faint mt-1.5">{{ selectedAudienceHint() | translate }}</p>
            </div>
          </div>

          <!-- Footer -->
          <div class="sticky bottom-0 z-10 rounded-b-2xl bg-white dark:bg-gray-800 flex items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-100 dark:border-gray-700">
            <p class="text-[11px] font-medium text-text-faint">
              {{ canShareStory() ? '' : ('COMMUNITY.CREATE_STORY.FOOTER_HINT' | translate) }}
            </p>
            <div class="flex items-center gap-2 shrink-0">
              <button
                type="button"
                (click)="closeCreateStoryModal()"
                class="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-gray-600 text-xs font-bold text-text-secondary hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
              >{{ 'COMMUNITY.CREATE_STORY.CANCEL' | translate }}</button>
              <button
                type="button"
                [disabled]="!canShareStory() || isSubmitting()"
                (click)="submit()"
                class="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors"
              >{{ isSubmitting() ? ('COMMUNITY.CREATE_STORY.POSTING' | translate) : ('COMMUNITY.CREATE_STORY.SHARE_STORY' | translate) }}</button>
            </div>
          </div>
        </div>
      </div>
    }

    @if (activePreviewStory(); as story) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in-up"
        (click)="activePreviewStory.set(null)"
        (window:keydown.escape)="activePreviewStory.set(null)"
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
                [class]="statusClasses(story)"
              >
                {{ statusLabel(story) | translate }}
              </span>
              <button
                type="button"
                (click)="activePreviewStory.set(null)"
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
                  (click)="togglePreviewFollow(story)"
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
                  (click)="explainUnavailable(story)"
                  class="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors focus:outline-none"
                  [attr.aria-label]="'COMMUNITY.STORIES_BAR.PREVIEW_MODAL.ROUTE_ARIA' | translate"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
                  </svg>
                </button>
                <button
                  type="button"
                  (click)="explainUnavailable(story)"
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
    }
  `,
    styles: [`
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  `]
})
export class CommunityStoriesBarComponent implements OnInit, OnDestroy {
  private storyService = inject(CommunityStoryService);
  private profileService = inject(CommunityProfileService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private ngZone = inject(NgZone);

  feed = signal<StoryGroup[]>([]);
  showStoryModal = signal(false);
  showCreateModal = signal(false);
  activeStoryIndex = 0;
  activePreviewStory = signal<PreviewStoryDetail | null>(null);

  isLoading = signal(true);
  myAvatar = signal<string | null>(null);
  private seenIds = new Set<string>(this.loadSeenIds());

  readonly previewStories = PREVIEW_STORY_DETAILS;

  // Story viewer modal state (formerly CommunityStoryModalComponent)
  currentGroupIndex = 0;
  currentStoryIndex = 0;
  progress = 0; // 0 to 100
  private storyTimer: any;
  private readonly STORY_DURATION_MS = 5000;
  private readonly UPDATE_INTERVAL_MS = 50;

  // Create Story modal state (formerly CommunityCreateStoryComponent)
  mediaUrl = signal('');
  caption = signal('');
  isSubmitting = signal(false);
  isUploading = signal(false);
  imageError = signal(false);
  isMediaVideo = signal(false);
  audience = signal<TipAudience>('everyone');
  readonly audiences = AUDIENCE_OPTIONS;
  readonly quickEmojis = QUICK_EMOJIS;
  readonly selectedAudienceHint = computed(() => this.audiences.find(a => a.value === this.audience())?.hintKey ?? '');
  // A story needs a caption, media, or both — only block submission when both are empty.
  readonly canShareStory = computed(() => (!!this.mediaUrl() || this.caption().trim().length > 0) && !this.imageError());

  // Story preview modal state (formerly CommunityStoryPreviewModalComponent)
  readonly followed = signal(false);
  readonly liked = signal(false);

  ngOnInit() {
    this.loadFeed();
    this.loadMyAvatar();
  }

  ngOnDestroy() {
    this.stopTimer();
  }

  private loadSeenIds(): string[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(SEEN_STORIES_KEY) || '[]');
    } catch {
      return [];
    }
  }

  isGroupSeen(group: StoryGroup): boolean {
    return group.stories.every(s => this.seenIds.has(s.id));
  }

  markGroupSeen(group: StoryGroup) {
    group.stories.forEach(s => this.seenIds.add(s.id));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(SEEN_STORIES_KEY, JSON.stringify([...this.seenIds]));
      } catch {}
    }
  }

  loadFeed() {
    this.isLoading.set(true);
    this.storyService.getFeed().subscribe({
      next: (res) => {
        this.feed.set(res.feed);
        this.isLoading.set(false);
      },
      error: () => {
        this.feed.set([]);
        this.isLoading.set(false);
      }
    });
  }

  loadMyAvatar() {
    this.profileService.getMyProfile().subscribe({
      next: (p) => this.myAvatar.set(p.avatar),
      error: () => {}
    });
  }

  // --- Create Story modal (formerly CommunityCreateStoryComponent) ---

  openCreateStoryModal() {
    // The modal used to be a fresh component instance every time it opened
    // (created by the @if block), so reset its state here to match.
    this.mediaUrl.set('');
    this.caption.set('');
    this.isSubmitting.set(false);
    this.isUploading.set(false);
    this.imageError.set(false);
    this.isMediaVideo.set(false);
    this.audience.set('everyone');
    this.showCreateModal.set(true);
  }

  closeCreateStoryModal() {
    this.showCreateModal.set(false);
  }

  insertEmoji(emoji: string) {
    this.caption.update(c => c + emoji);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.imageError.set(false);
    this.isMediaVideo.set(file.type.startsWith('video/'));
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
    input.value = '';
  }

  clearMedia() {
    this.mediaUrl.set('');
    this.imageError.set(false);
    this.isMediaVideo.set(false);
  }

  onPreviewError() {
    this.imageError.set(true);
  }

  submit() {
    if (!this.canShareStory() || this.isSubmitting()) return;

    this.isSubmitting.set(true);

    // Audience is UI-only for now — CommunityStoryService.createStory() and the
    // backend `stories` table don't have a visibility field yet, so the selection
    // isn't persisted. Kept as local state so the control is fully usable and its
    // hint text is accurate; wire it up once the API supports it.
    const payload = {
      media_url: this.mediaUrl() || undefined,
      caption: this.caption().trim() || undefined
    };

    this.storyService.createStory(payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.toast.success(this.translate.instant('COMMUNITY.CREATE_STORY.SUCCESS'));
        this.loadFeed();
        this.showCreateModal.set(false);
      },
      error: () => {
        this.isSubmitting.set(false);
        this.toast.error(this.translate.instant('COMMUNITY.CREATE_STORY.POST_FAILED'));
      }
    });
  }

  openStory(index: number, group: StoryGroup) {
    this.activeStoryIndex = index;
    this.showStoryModal.set(true);
    this.markGroupSeen(group);
    // Formerly CommunityStoryModalComponent.ngOnInit — the modal used to be
    // (re)created by the @if block, which reset this state each time it opened.
    this.currentGroupIndex = index;
    this.currentStoryIndex = 0;
    this.startTimer();
  }

  ringGradient(status: PreviewStoryDetail['status']): string {
    if (status === 'there') return 'linear-gradient(140deg,#0F9D58,#2AA98B)';
    if (status === 'soon') return 'linear-gradient(140deg,#0060EA,#7A4FA3)';
    return '#E2E7EF';
  }

  openPreviewStory(story: PreviewStoryDetail): void {
    this.activePreviewStory.set(story);
  }

  // --- Story preview modal (formerly CommunityStoryPreviewModalComponent) ---

  statusLabel(story: PreviewStoryDetail): string {
    switch (story.status) {
      case 'there': return 'COMMUNITY.STORIES_BAR.PREVIEW_MODAL.STATUS_THERE';
      case 'soon': return 'COMMUNITY.STORIES_BAR.PREVIEW_MODAL.STATUS_SOON';
      default: return 'COMMUNITY.STORIES_BAR.PREVIEW_MODAL.STATUS_RECENT';
    }
  }

  statusClasses(story: PreviewStoryDetail): string {
    switch (story.status) {
      case 'there': return 'bg-white border-emerald-200 text-emerald-600';
      case 'soon': return 'bg-white border-primary-subtle text-primary';
      default: return 'bg-white border-slate-200 text-text-faint';
    }
  }

  togglePreviewFollow(story: PreviewStoryDetail): void {
    this.followed.update(v => !v);
    this.toast.success(
      this.translate.instant('COMMUNITY.STORIES_BAR.PREVIEW_NOTICE', { name: story.name })
    );
  }

  toggleLike(): void {
    this.liked.update(v => !v);
  }

  explainUnavailable(story: PreviewStoryDetail): void {
    this.toast.success(
      this.translate.instant('COMMUNITY.STORIES_BAR.PREVIEW_NOTICE', { name: story.name })
    );
  }

  // --- Story viewer modal (formerly CommunityStoryModalComponent) ---

  get activeGroup(): StoryGroup | undefined {
    return this.feed()[this.currentGroupIndex];
  }

  get currentStory(): Story | undefined {
    return this.activeGroup?.stories[this.currentStoryIndex];
  }

  closeStoryModal() {
    this.stopTimer();
    this.showStoryModal.set(false);
  }

  getProgressWidth(index: number): number {
    if (index < this.currentStoryIndex) return 100;
    if (index === this.currentStoryIndex) return this.progress;
    return 0;
  }

  handleTap(event: MouseEvent) {
    // Use currentTarget (the element the handler is bound to) rather than target:
    // a text-only story's caption is a child of the tap zone, and offsetX/target
    // would otherwise be measured against whichever inner element was clicked.
    const zone = event.currentTarget as HTMLElement;
    const rect = zone.getBoundingClientRect();
    const clickX = event.clientX - rect.left;

    if (clickX < rect.width / 3) {
      this.prevStory();
    } else {
      this.nextStory();
    }
  }

  prevStory() {
    this.stopTimer();
    this.progress = 0;

    if (this.currentStoryIndex > 0) {
      this.currentStoryIndex--;
      this.startTimer();
    } else if (this.currentGroupIndex > 0) {
      this.currentGroupIndex--;
      this.currentStoryIndex = this.activeGroup!.stories.length - 1;
      this.startTimer();
    } else {
      // Loop or just stay at beginning, let's just restart
      this.startTimer();
    }
  }

  nextStory() {
    this.stopTimer();
    this.progress = 0;

    if (this.activeGroup && this.currentStoryIndex < this.activeGroup.stories.length - 1) {
      this.currentStoryIndex++;
      this.startTimer();
    } else if (this.currentGroupIndex < this.feed().length - 1) {
      this.currentGroupIndex++;
      this.currentStoryIndex = 0;
      this.startTimer();
    } else {
      this.closeStoryModal();
    }
  }

  private startTimer() {
    this.progress = 0;
    this.ngZone.runOutsideAngular(() => {
      this.storyTimer = setInterval(() => {
        this.progress += (100 / (this.STORY_DURATION_MS / this.UPDATE_INTERVAL_MS));

        // Update DOM directly to avoid triggering Angular change detection
        const element = document.getElementById('story-progress-' + this.currentStoryIndex);
        if (element) {
          element.style.width = `${this.progress}%`;
        }

        if (this.progress >= 100) {
          this.ngZone.run(() => {
            this.nextStory();
          });
        }
      }, this.UPDATE_INTERVAL_MS);
    });
  }

  private stopTimer() {
    if (this.storyTimer) {
      clearInterval(this.storyTimer);
    }
  }
}
