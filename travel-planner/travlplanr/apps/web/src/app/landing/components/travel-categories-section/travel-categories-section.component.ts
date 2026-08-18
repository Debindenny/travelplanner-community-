import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SectionHeaderComponent } from '../../../shared/components/section-header/section-header.component';
import { DestinationTile } from '../../../shared/models/landing.models';

@Component({
  selector: 'app-travel-categories-section',
  standalone: true,
  imports: [SectionHeaderComponent, TranslatePipe],
  template: `
    <section class="bg-surface-muted py-[80px]">
      <div class="section-container section-gap">
        <app-section-header
          [title]="'LANDING.CATEGORIES.TITLE' | translate"
          [subtitle]="'LANDING.CATEGORIES.SUBTITLE' | translate"
        />

        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          @for (category of categories; track category.title; let i = $index) {
            <article class="group relative h-[480px] w-full max-w-[302px] justify-self-center overflow-hidden rounded-card">
              <img
                [src]="category.image"
                [alt]="category.title"
                class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                [style.object-position]="category.objectPosition || 'center'"
                [attr.loading]="i < 2 ? 'eager' : 'lazy'"
                [attr.fetchpriority]="i < 2 ? 'high' : 'auto'"
              />
              <div
                class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"
              ></div>
              <h3
                class="absolute bottom-[58px] left-0 right-0 text-center text-5xl font-semibold leading-none text-white"
              >
                {{ category.title }}
              </h3>
            </article>
          }
        </div>
      </div>
    </section>
  `,
})
export class TravelCategoriesSectionComponent {
  readonly categories: DestinationTile[] = [];
}
