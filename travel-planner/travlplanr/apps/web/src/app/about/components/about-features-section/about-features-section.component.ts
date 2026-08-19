import { Component, Input } from '@angular/core';

import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AboutFeatureCardComponent } from '../about-feature-card/about-feature-card.component';
import { ABOUT_FEATURES } from '../../../shared/data/about.data';

@Component({
    selector: 'app-about-features-section',
    imports: [TranslatePipe, RouterLink, AboutFeatureCardComponent],
    template: `
    <section 
      id="features"
      class="section-container bg-surface-muted py-20 border-t border-border-light/40 transition-all duration-700 ease-out"
      [class.opacity-100]="isVisible"
      [class.translate-y-0]="isVisible"
      [class.opacity-0]="!isVisible"
      [class.translate-y-12]="!isVisible"
    >
      <div class="mx-auto max-w-content flex flex-col lg:flex-row lg:items-end justify-between gap-6 text-center lg:text-left">
        <div>
           <h2 class="text-3xl md:text-4xl font-bold tracking-tight text-text-primary">{{ 'ABOUT.FEATURES.HEADING' | translate }}</h2>
           <p class="mt-2 text-text-secondary">{{ 'ABOUT.FEATURES.SUBTITLE' | translate }}</p>
        </div>
        <a routerLink="/" class="inline-flex items-center gap-2 text-primary font-semibold hover:text-primary-hover transition-colors">
          {{ 'ABOUT.FEATURES.SEE_HOW' | translate }}
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </a>
      </div>

      <div class="mx-auto max-w-content mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        @for (feature of features; track feature.id) {
          <app-about-feature-card [feature]="feature" />
        }
      </div>
    </section>
  `
})
export class AboutFeaturesSectionComponent {
  @Input() isVisible = false;
  readonly features = ABOUT_FEATURES;
}
