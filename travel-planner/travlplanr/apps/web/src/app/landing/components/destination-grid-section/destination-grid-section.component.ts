import { NgClass } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SectionHeaderComponent } from '../../../shared/components/section-header/section-header.component';
import { DestinationTile } from '../../../shared/models/landing.models';
import { CurrencyConverterPipe } from '../../../shared/utils/currency-converter.pipe';

@Component({
    selector: 'app-destination-grid-section',
    imports: [NgClass, SectionHeaderComponent, RouterLink, CurrencyConverterPipe, TranslatePipe],
    template: `
    <section
      [id]="sectionId"
      class="landing-section"
      [class.bg-white]="background === 'white'"
      [class.bg-surface-muted]="background === 'muted'"
    >
      <div class="section-container section-gap">
        <app-section-header
          [title]="title"
          [subtitle]="subtitle"
          [watermark]="watermark"
          [subtleWatermark]="true"
        />

        @if (loading) {
          <div class="destination-bento mx-auto max-w-[1280px]" [ngClass]="bentoClass">
            @for (i of [1, 2, 3, 4, 5, 6]; track i) {
              <div class="skeleton-tile rounded-tile" [ngClass]="'tile-skeleton-' + i"></div>
            }
          </div>
        } @else {
          <div class="destination-bento mx-auto max-w-[1280px]" [ngClass]="bentoClass">
            @for (destination of destinations; track destination.name; let i = $index) {
              <article
                class="destination-tile group cursor-pointer"
                [ngClass]="destination.gridArea ? 'tile-' + destination.gridArea : null"
                [routerLink]="['/packages']"
                [queryParams]="{ region: destination.name }"
              >
                <img
                  [src]="destination.image"
                  [alt]="destination.name"
                  class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  [style.object-position]="destination.imagePosition || 'center'"
                  [attr.loading]="i < 2 ? 'eager' : 'lazy'"
                  [attr.fetchpriority]="i < 2 ? 'high' : 'auto'"
                />
                <div class="destination-gradient absolute inset-0 rounded-tile"></div>
                <div class="absolute bottom-5 left-[35px] text-white">
                  <h3 class="text-3xl font-semibold leading-none">{{ destination.name }}</h3>
                  <p class="mt-2 text-sm font-medium leading-none">
                    {{ 'LANDING.STARTS_FROM' | translate }} {{ destination.price | appCurrency }}*
                  </p>
                </div>
                <div class="card-cta absolute inset-0 flex items-end rounded-tile p-4 opacity-0 transition-opacity duration-250 group-hover:opacity-100">
                  <span class="plan-btn">
                    {{ 'LANDING.DESTINATIONS.PLAN_TRIP' | translate }}
                    <svg class="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </span>
                </div>
              </article>
            }
          </div>
          <p class="mx-auto mt-4 max-w-[1280px] text-center text-xs text-text-tertiary">
            {{ 'LANDING.PRICE_DISCLAIMER' | translate }}
          </p>
        }
      </div>
    </section>
  `,
    styles: [
        `
      .destination-tile {
        position: relative;
        overflow: hidden;
        border-radius: 12px;
        min-height: 180px;
      }

      .card-cta {
        background: linear-gradient(to top, rgba(0, 0, 0, 0.72) 0%, rgba(0, 0, 0, 0) 50%);
      }

      .plan-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #fff;
        color: #0060ea;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
        padding: 6px 14px;
        white-space: nowrap;
      }

      .skeleton-tile {
        min-height: 180px;
        background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: shimmer 1.4s infinite;
      }

      @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }

      @media (min-width: 1280px) {
        .bento-trending {
          display: grid;
          gap: 16px;
          grid-template-columns: 411px 410px 411px;
          grid-template-rows: 308px 104px 206px;
        }

        /* Fallback when tiles lack bento placement classes (e.g. partial API data). */
        .bento-trending:not(:has([class*='tile-malaysia'])) {
          grid-template-rows: none;
          grid-auto-rows: minmax(220px, auto);
        }

        .bento-trending .tile-malaysia { grid-column: 1; grid-row: 1 / 3; min-height: 412px; }
        .bento-trending .tile-maldives { grid-column: 2; grid-row: 1; min-height: 308px; }
        .bento-trending .tile-seychelles { grid-column: 3; grid-row: 1 / 3; min-height: 421px; }
        .bento-trending .tile-singapore { grid-column: 2; grid-row: 2 / 4; min-height: 316px; }
        .bento-trending .tile-switzerland { grid-column: 1; grid-row: 3; min-height: 206px; }
        .bento-trending .tile-thailand { grid-column: 3; grid-row: 3; min-height: 206px; }

        .bento-iconic {
          display: grid;
          gap: 16px;
          grid-template-columns: 411px 410px 411px;
          grid-template-rows: 412px 96px 220px;
        }

        .bento-iconic:not(:has([class*='tile-uae'])) {
          grid-template-rows: none;
          grid-auto-rows: minmax(220px, auto);
        }

        .bento-iconic .tile-uae { grid-column: 1; grid-row: 1 / 3; }
        .bento-iconic .tile-usa { grid-column: 2; grid-row: 1; }
        .bento-iconic .tile-europe { grid-column: 3; grid-row: 1 / 3; }
        .bento-iconic .tile-australia { grid-column: 1; grid-row: 3; }
        .bento-iconic .tile-china { grid-column: 2; grid-row: 2 / 4; }
        .bento-iconic .tile-india { grid-column: 3; grid-row: 3; }
      }

      @media (max-width: 1279px) {
        .bento-trending,
        .bento-iconic {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }
      }

      @media (max-width: 639px) {
        .bento-trending,
        .bento-iconic {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          padding-bottom: 4px;
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .bento-trending::-webkit-scrollbar,
        .bento-iconic::-webkit-scrollbar { display: none; }
        .bento-trending .destination-tile,
        .bento-iconic .destination-tile,
        .bento-trending .skeleton-tile,
        .bento-iconic .skeleton-tile {
          min-width: 78vw;
          scroll-snap-align: start;
          min-height: 260px;
        }
      }
    `,
    ]
})
export class DestinationGridSectionComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) subtitle!: string;
  @Input() watermark = '';
  @Input() sectionId = '';
  @Input({ required: true }) destinations!: DestinationTile[];
  @Input() bentoClass: 'bento-trending' | 'bento-iconic' = 'bento-trending';
  @Input() background: 'white' | 'muted' = 'muted';
  @Input() loading = false;
}
