import { Component, OnInit, inject, signal } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';
import { CommunityStoryService, StoryGroup } from '../services/community-story.service';
import { CommunityProfileService } from '../services/community-profile.service';
import { CommunityStoryModalComponent } from './community-story-modal.component';
import { CommunityCreateStoryComponent } from './community-create-story.component';

const SEEN_STORIES_KEY = 'community_seen_stories';

@Component({
    selector: 'app-community-stories-bar',
    imports: [TranslatePipe, CommunityStoryModalComponent, CommunityCreateStoryComponent],
    template: `
    <div class="flex gap-3 overflow-x-auto no-scrollbar items-center max-w-2xl mx-auto py-2">
      
      <!-- Add Story Button -->
      <div 
        (click)="showCreateModal.set(true)"
        class="group relative w-24 h-36 rounded-2xl overflow-hidden shadow-sm border border-slate-200/50 shrink-0 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-md active:scale-95"
      >
        <!-- Background avatar blurred -->
        <img 
          [src]="myAvatar() || '/assets/images/default-avatar.svg'" 
          class="absolute inset-0 w-full h-full object-cover blur-[1.5px] brightness-[0.55] transition-transform duration-500 group-hover:scale-110" 
        />
        <!-- Inner card content -->
        <div class="absolute inset-0 flex flex-col items-center justify-between p-3 z-10">
          <!-- Plus Icon -->
          <div class="w-8 h-8 rounded-full bg-primary hover:bg-primary-hover text-white flex items-center justify-center border-2 border-white shadow-md transform group-hover:scale-110 transition-transform mt-6">
            <svg class="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3.5" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <span class="text-[9px] font-extrabold text-white uppercase tracking-wider text-center drop-shadow-md">{{ 'COMMUNITY.STORIES_BAR.YOUR_STORY' | translate }}</span>
        </div>
      </div>

      <!-- Skeletons (when loading) -->
      @if (isLoading()) {
        @for (i of [1, 2, 3, 4]; track i) {
          <div class="w-24 h-36 rounded-2xl bg-slate-200/60 animate-pulse shrink-0 border border-slate-100"></div>
        }
      }

      <!-- Story Cards -->
      @for (group of feed(); track group.author.id; let i = $index) {
        <button
          (click)="openStory(i, group)"
          class="group relative w-24 h-36 rounded-2xl overflow-hidden shrink-0 transition-all duration-300 hover:scale-105 hover:shadow-md active:scale-95 text-left focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          [class.shadow-sm]="!isGroupSeen(group)"
          [class.opacity-70]="isGroupSeen(group)"
          [attr.aria-label]="'COMMUNITY.STORIES_BAR.VIEW_STORY_ARIA' | translate"
        >
          <!-- Background preview image of first story -->
          <img
            [src]="group.stories[0].media_url"
            class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            alt=""
          />
          <!-- Dark gradient overlay for readability -->
          <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/35"></div>

          <!-- Author Profile photo (top left) — gradient ring if unseen, grey if seen -->
          <div class="absolute top-2 left-2 z-10 w-8 h-8 rounded-full p-[1.5px] shadow-md"
            [class.bg-gradient-to-tr]="!isGroupSeen(group)"
            [class.from-yellow-400]="!isGroupSeen(group)"
            [class.via-pink-500]="!isGroupSeen(group)"
            [class.to-fuchsia-600]="!isGroupSeen(group)"
            [class.bg-slate-400]="isGroupSeen(group)"
          >
            <div class="w-full h-full rounded-full border border-white overflow-hidden bg-slate-100">
              <img [src]="group.author.avatar || '/assets/images/default-avatar.svg'" class="w-full h-full object-cover" />
            </div>
          </div>

          <!-- Seen check overlay -->
          @if (isGroupSeen(group)) {
            <div class="absolute top-2 right-2 z-10 w-5 h-5 bg-white/90 rounded-full flex items-center justify-center shadow-sm">
              <svg class="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
            </div>
          }

          <!-- Author Name (bottom left) -->
          <div class="absolute bottom-2 left-2 right-2 z-10">
            <p class="text-2xs font-extrabold text-white truncate drop-shadow-sm">{{ group.author.name }}</p>
          </div>
        </button>
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

  isLoading = signal(true);
  myAvatar = signal<string | null>(null);
  private seenIds = new Set<string>(this.loadSeenIds());

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
}
