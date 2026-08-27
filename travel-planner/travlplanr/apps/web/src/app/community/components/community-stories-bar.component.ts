import { Component, OnInit, inject, signal } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';
import { CommunityStoryService, StoryGroup } from '../services/community-story.service';
import { CommunityProfileService } from '../services/community-profile.service';
import { CommunityStoryModalComponent } from './community-story-modal.component';
import { CommunityStoryPreviewModalComponent } from './community-story-preview-modal.component';
import { CommunityCreateStoryComponent } from './community-create-story.component';
import { PreviewStoryDetail, PREVIEW_STORY_DETAILS } from './community-story-preview.mock';

const SEEN_STORIES_KEY = 'community_seen_stories';

@Component({
    selector: 'app-community-stories-bar',
    imports: [TranslatePipe, CommunityStoryModalComponent, CommunityStoryPreviewModalComponent, CommunityCreateStoryComponent],
    template: `
    <div class="flex gap-4 overflow-x-auto no-scrollbar items-start max-w-2xl py-2 px-1">

      <!-- Add Story -->
      <button
        type="button"
        (click)="showCreateModal.set(true)"
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
              <img [src]="group.stories[0].media_url" class="w-full h-full object-cover" alt="" />
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
      <app-community-story-modal
        [groups]="feed()"
        [initialGroupIndex]="activeStoryIndex"
        (close)="showStoryModal.set(false)"
      />
    }

    @if (showCreateModal()) {
      <app-community-create-story
        (close)="showCreateModal.set(false)"
        (created)="loadFeed()"
      />
    }

    @if (activePreviewStory(); as story) {
      <app-community-story-preview-modal
        [story]="story"
        (close)="activePreviewStory.set(null)"
      />
    }
  `,
    styles: [`
    .no-scrollbar::-webkit-scrollbar {
      display: none;
    }
    .no-scrollbar {
      -ms-overflow-style: none;  /* IE and Edge */
      scrollbar-width: none;  /* Firefox */
    }
  `]
})
export class CommunityStoriesBarComponent implements OnInit {
  private storyService = inject(CommunityStoryService);
  private profileService = inject(CommunityProfileService);

  feed = signal<StoryGroup[]>([]);
  showStoryModal = signal(false);
  showCreateModal = signal(false);
  activeStoryIndex = 0;
  activePreviewStory = signal<PreviewStoryDetail | null>(null);

  isLoading = signal(true);
  myAvatar = signal<string | null>(null);
  private seenIds = new Set<string>(this.loadSeenIds());

  readonly previewStories = PREVIEW_STORY_DETAILS;

  ngOnInit() {
    this.loadFeed();
    this.loadMyAvatar();
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

  openStory(index: number, group: StoryGroup) {
    this.activeStoryIndex = index;
    this.showStoryModal.set(true);
    this.markGroupSeen(group);
  }

  ringGradient(status: PreviewStoryDetail['status']): string {
    if (status === 'there') return 'linear-gradient(140deg,#0F9D58,#2AA98B)';
    if (status === 'soon') return 'linear-gradient(140deg,#0060EA,#7A4FA3)';
    return '#E2E7EF';
  }

  openPreviewStory(story: PreviewStoryDetail): void {
    this.activePreviewStory.set(story);
  }
}
