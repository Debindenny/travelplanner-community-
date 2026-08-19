import { Component, Input } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';
import { ABOUT_VALUE_CARDS, ABOUT_PILLARS, ABOUT_STORY_IMAGE } from '../../../shared/data/about.data';

@Component({
    selector: 'app-about-intro-section',
    imports: [TranslatePipe],
    template: `
    <section 
      id="intro"
      class="section-container bg-surface py-20 transition-all duration-700 ease-out"
      [class.opacity-100]="isVisible"
      [class.translate-y-0]="isVisible"
      [class.opacity-0]="!isVisible"
      [class.translate-y-12]="!isVisible"
    >
      <div class="mx-auto flex max-w-content flex-col gap-16">
        <div class="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-start">
          <!-- Left Narrative -->
          <div class="flex flex-col gap-6 lg:col-span-7">
            <span class="inline-flex w-fit items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">{{ 'ABOUT.INTRO.BADGE' | translate }}</span>
            <h2 class="text-4xl md:text-5xl font-bold tracking-tight text-text-primary">{{ 'ABOUT.INTRO.TITLE' | translate }}</h2>
            <p class="text-lg font-normal leading-relaxed text-text-secondary">
              {{ 'ABOUT.INTRO.PARAGRAPH' | translate }}
            </p>

            <div class="mt-4 flex flex-col gap-6 border-l-2 border-primary/20 pl-6">
              <div>
                <h3 class="text-xl font-semibold text-text-primary">{{ 'ABOUT.INTRO.WHY_TITLE' | translate }}</h3>
                <p class="mt-2 text-base leading-relaxed text-text-secondary">{{ 'ABOUT.INTRO.WHY_TEXT' | translate }}</p>
              </div>

              <div>
                <h3 class="text-lg font-semibold italic text-primary">{{ 'ABOUT.INTRO.ASKED_TITLE' | translate }}</h3>
                <p class="mt-1 whitespace-pre-line text-lg font-normal leading-relaxed text-text-secondary">
                  {{ 'ABOUT.INTRO.ASKED_TEXT' | translate }}
                </p>
              </div>
            </div>
            
            <div class="mt-6 rounded-card overflow-hidden h-[300px] relative">
               <img [src]="storyImage" [alt]="'ABOUT.STORY.IMAGE_ALT' | translate" class="w-full h-full object-cover" loading="lazy" />
               <div class="absolute inset-0 bg-black/40 flex flex-col justify-end p-6">
                 <h3 class="text-xl font-bold text-white">{{ 'ABOUT.STORY.HEADING' | translate }}</h3>
                 <p class="text-sm text-white/90 mt-2">{{ 'ABOUT.STORY.TEXT' | translate }}</p>
               </div>
            </div>
          </div>

          <!-- Right Product Pillars -->
          <div class="flex flex-col gap-6 rounded-card border border-border-light bg-surface-muted p-8 lg:col-span-5 shadow-sm">
            <h3 class="text-xl font-bold text-text-primary">{{ 'ABOUT.INTRO.PILLARS_TITLE' | translate }}</h3>
            <div class="grid gap-6 sm:grid-cols-3 lg:grid-cols-1">
              @for (pillar of pillars; track pillar.id; let last = $last) {
                <div class="flex flex-col gap-1 pb-4" [class.border-b]="!last" [class.border-border-light]="!last" [class.pb-0]="last">
                  <span class="text-3xl font-extrabold tracking-tight text-primary">
                    {{ 'ABOUT.STATS.' + pillar.id + '.VALUE' | translate }}
                  </span>
                  <span class="text-sm font-semibold text-text-primary">{{ 'ABOUT.STATS.' + pillar.id + '.LABEL' | translate }}</span>
                  <span class="text-xs text-text-tertiary leading-relaxed">{{ 'ABOUT.STATS.' + pillar.id + '.DESCRIPTION' | translate }}</span>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Value Cards -->
        <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
          @for (card of valueCards; track card.id) {
            <article class="flex flex-col justify-between rounded-card border border-border-light/80 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-card-hover">
              <div class="flex flex-col gap-4">
                <div class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xl">
                  {{ card.icon }}
                </div>
                <h3 class="text-2xl font-bold text-text-primary">{{ 'ABOUT.VALUES.' + card.id + '.TITLE' | translate }}</h3>
                <p class="text-sm-plus leading-relaxed text-text-secondary">{{ 'ABOUT.VALUES.' + card.id + '.DESCRIPTION' | translate }}</p>
              </div>
            </article>
          }
        </div>
      </div>
    </section>
  `
})
export class AboutIntroSectionComponent {
  @Input() isVisible = false;
  readonly valueCards = ABOUT_VALUE_CARDS;
  readonly pillars = ABOUT_PILLARS;
  readonly storyImage = ABOUT_STORY_IMAGE;
}
