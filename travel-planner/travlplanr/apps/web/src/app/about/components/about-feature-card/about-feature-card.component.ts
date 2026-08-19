import { Component, Input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AboutFeature } from '../../../shared/models/about.models';

@Component({
    selector: 'app-about-feature-card',
    imports: [TranslatePipe],
    template: `
    <article
      class="group flex h-full min-h-[200px] w-full flex-col justify-between rounded-card border-l-4 border-l-primary/30 border border-border-light/60 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-l-primary hover:border-primary/20 hover:shadow-[0_8px_30px_rgba(0,96,234,0.12)]"
    >
      <div class="flex flex-col gap-4">
        <div class="inline-flex h-12 w-12 items-center justify-center rounded-tile bg-primary-50 transition-colors duration-300 group-hover:bg-primary-subtle">
          <img
            [src]="feature.icon"
            alt=""
            class="h-6 w-6 object-contain transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
            aria-hidden="true"
          />
        </div>
        <h3 class="text-lg font-semibold leading-snug text-text-primary">
          {{ 'ABOUT.FEATURES.' + feature.id + '.TITLE' | translate }}
        </h3>
        <p class="text-sm-plus leading-relaxed text-text-secondary">
          {{ 'ABOUT.FEATURES.' + feature.id + '.DESCRIPTION' | translate }}
        </p>
      </div>
    </article>
  `
})
export class AboutFeatureCardComponent {
  @Input({ required: true }) feature!: AboutFeature;
}
