import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, NgZone } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';
import { StoryGroup, Story } from '../services/community-story.service';
import { A11yModule } from '@angular/cdk/a11y';

@Component({
    selector: 'app-community-story-modal',
    imports: [TranslatePipe, A11yModule],
    template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
         (click)="close.emit()"
         (window:keydown.escape)="close.emit()">
      <button
        (click)="close.emit(); $event.stopPropagation()"
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
          <img 
            [src]="currentStory?.media_url" 
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
        </div>
        
        <!-- Navigation invisible zones -->
        <div class="absolute inset-y-0 left-0 w-1/3 cursor-pointer z-0" (click)="prevStory()"></div>
        <div class="absolute inset-y-0 right-0 w-1/3 cursor-pointer z-0" (click)="nextStory()"></div>
      </div>
    </div>
  `
})
export class CommunityStoryModalComponent implements OnInit, OnDestroy {
  @Input() groups: StoryGroup[] = [];
  @Input() initialGroupIndex = 0;
  @Output() close = new EventEmitter<void>();

  currentGroupIndex = 0;
  currentStoryIndex = 0;
  progress = 0; // 0 to 100
  
  private timer: any;
  private readonly STORY_DURATION_MS = 5000;
  private readonly UPDATE_INTERVAL_MS = 50;

  constructor(private ngZone: NgZone) {}

  get activeGroup(): StoryGroup | undefined {
    return this.groups[this.currentGroupIndex];
  }

  get currentStory(): Story | undefined {
    return this.activeGroup?.stories[this.currentStoryIndex];
  }

  ngOnInit() {
    this.currentGroupIndex = this.initialGroupIndex;
    this.currentStoryIndex = 0;
    this.startTimer();
  }

  ngOnDestroy() {
    this.stopTimer();
  }

  getProgressWidth(index: number): number {
    if (index < this.currentStoryIndex) return 100;
    if (index === this.currentStoryIndex) return this.progress;
    return 0;
  }

  handleTap(event: MouseEvent) {
    const width = (event.target as HTMLElement).offsetWidth;
    const clickX = event.offsetX;
    
    if (clickX < width / 3) {
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
    } else if (this.currentGroupIndex < this.groups.length - 1) {
      this.currentGroupIndex++;
      this.currentStoryIndex = 0;
      this.startTimer();
    } else {
      this.close.emit();
    }
  }

  private startTimer() {
    this.progress = 0;
    this.ngZone.runOutsideAngular(() => {
      this.timer = setInterval(() => {
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
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}
