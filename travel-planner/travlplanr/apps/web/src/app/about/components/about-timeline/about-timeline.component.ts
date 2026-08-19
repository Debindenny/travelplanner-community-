import { NgClass } from '@angular/common';
import { Component, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ABOUT_TIMELINE } from '../../../shared/data/about.data';

@Component({
    selector: 'app-about-timeline',
    imports: [NgClass, TranslatePipe],
    template: `
    <div class="w-full rounded-card border border-border-light bg-white p-8 shadow-sm">
      <div class="text-center">
        <h3 class="text-3xl font-bold text-text-primary">{{ 'ABOUT.TIMELINE.TITLE' | translate }}</h3>
        <p class="mt-2 text-base text-text-secondary">{{ 'ABOUT.TIMELINE.SUBTITLE' | translate }}</p>
      </div>

      <!-- Timeline Track and Markers -->
      <div class="relative mt-12 mx-auto max-w-[800px] px-8">
        <!-- Connecting Line background -->
        <div class="absolute left-8 right-8 top-1/2 h-[3px] -translate-y-1/2 bg-border-light" aria-hidden="true"></div>
        
        <!-- Connecting Line Active progress -->
        <div 
          class="absolute left-8 top-1/2 h-[3px] -translate-y-1/2 bg-primary transition-all duration-500 ease-out" 
          [style.width.%]="activePercent"
          aria-hidden="true"
        ></div>

        <!-- Terminal dot at the right end -->
        <div class="absolute right-8 top-1/2 h-3 w-3 -translate-y-1/2 translate-x-1/2 rounded-full border-2 border-border-light bg-white" aria-hidden="true"></div>

        <!-- Markers Grid -->
        <div class="relative z-10 flex justify-between" role="tablist" [attr.aria-label]="'ABOUT.TIMELINE.ARIA_LABEL' | translate">
          @for (milestone of timeline; track milestone.year; let idx = $index) {
            <button 
              type="button"
              role="tab"
              class="flex flex-col items-center gap-3 cursor-pointer group rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4"
              [id]="tabId(idx)"
              [attr.aria-selected]="activeIdx() === idx"
              [attr.aria-current]="activeIdx() === idx ? 'step' : null"
              [attr.aria-controls]="panelId(idx)"
              [attr.tabindex]="activeIdx() === idx ? 0 : -1"
              (click)="setActive(idx)"
              (keydown.arrowRight)="focusAdjacent(idx, 1, $event)"
              (keydown.arrowLeft)="focusAdjacent(idx, -1, $event)"
            >
              <div
                class="flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-300 shadow-sm"
                [ngClass]="
                  activeIdx() === idx
                    ? 'bg-primary border-primary text-white scale-110'
                    : 'bg-white border-border text-text-secondary hover:border-primary/50'
                "
              >
                <span class="text-xs font-bold">{{ milestone.year }}</span>
              </div>
            </button>
          }
        </div>
      </div>

      <!-- Milestone Detail Card -->
      <div class="mt-10 mx-auto max-w-[600px] min-h-[160px]">
        @if (timeline[activeIdx()]; as item) {
          <div
            role="tabpanel"
            [id]="panelId(activeIdx())"
            [attr.aria-labelledby]="tabId(activeIdx())"
            aria-live="polite"
            class="rounded-tile bg-surface-muted p-6 border border-border-light/60 transition-all duration-300 animate-fade-in text-center shadow-2xs"
          >
            <span class="text-sm font-bold text-primary uppercase tracking-widest">{{ 'ABOUT.TIMELINE.MILESTONE_LABEL' | translate: { year: item.year } }}</span>
            <h4 class="mt-2 text-xl font-bold text-text-primary">{{ 'ABOUT.TIMELINE.' + item.year + '.TITLE' | translate }}</h4>
            <p class="mt-3 text-base-plus leading-relaxed text-text-secondary">
              {{ 'ABOUT.TIMELINE.' + item.year + '.DESCRIPTION' | translate }}
            </p>
          </div>
        }
      </div>
    </div>
  `,
    styles: [`
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in {
      animation: fadeIn 0.4s ease-out forwards;
    }
  `]
})
export class AboutTimelineComponent {
  readonly timeline = ABOUT_TIMELINE;
  readonly activeIdx = signal(3); // Start with latest (2026)

  get activePercent(): number {
    return (this.activeIdx() / (this.timeline.length - 1)) * 100;
  }

  setActive(idx: number): void {
    this.activeIdx.set(idx);
  }

  tabId(idx: number): string {
    return `about-timeline-tab-${idx}`;
  }

  panelId(idx: number): string {
    return `about-timeline-panel-${idx}`;
  }

  focusAdjacent(idx: number, direction: 1 | -1, event: Event): void {
    event.preventDefault();
    const nextIdx = (idx + direction + this.timeline.length) % this.timeline.length;
    this.setActive(nextIdx);
    document.getElementById(this.tabId(nextIdx))?.focus();
  }
}
