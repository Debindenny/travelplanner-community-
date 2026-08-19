import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SectionHeaderComponent } from '../../../shared/components/section-header/section-header.component';
import { CarouselCard } from '../../../shared/models/landing.models';

@Component({
    selector: 'app-destination-carousel-section',
    imports: [NgTemplateOutlet, SectionHeaderComponent, RouterLink, TranslatePipe],
    styles: [
        `
      :host { display: block; width: 100%; }

      .card-cta {
        position: absolute;
        inset: 0;
        background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 45%);
        display: flex;
        align-items: flex-end;
        padding: 16px;
        opacity: 0;
        transition: opacity 0.25s ease;
      }
      .group:hover .card-cta { opacity: 1; }

      .plan-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #fff;
        color: #0060EA;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
        padding: 6px 14px;
        white-space: nowrap;
        transform: translateY(6px);
        transition: transform 0.25s ease;
      }
      .group:hover .plan-btn { transform: translateY(0); }

      .hide-scrollbar {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .hide-scrollbar::-webkit-scrollbar { display: none; }
    `,
    ],
    template: `
    @if (!embedded) {
      <section class="scroll-mt-28 bg-surface-muted py-24">
        <div class="section-container section-gap">
          <ng-container *ngTemplateOutlet="headerRow" />
          <ng-container *ngTemplateOutlet="scrollerRow" />
        </div>
      </section>
    } @else {
      <div class="mt-6">
        <ng-container *ngTemplateOutlet="headerRow" />
        <ng-container *ngTemplateOutlet="scrollerRow" />
      </div>
    }

    <ng-template #headerRow>
      @if (showHeader) {
        <div class="mb-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <app-section-header
            [title]="title"
            [subtitle]="subtitle"
            [watermark]="watermark"
            [subtleWatermark]="true"
            [narrow]="false"
            class="flex-1"
          />
          <div class="hidden shrink-0 gap-3 lg:flex">
            <button
              type="button"
              class="flex h-11 w-11 items-center justify-center rounded-full border border-border text-text-primary transition-colors hover:bg-black/5"
              [attr.aria-label]="'LANDING.DESTINATIONS.SCROLL_LEFT' | translate"
              (click)="scroll(-1)"
            >
              <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
            <button
              type="button"
              class="flex h-11 w-11 items-center justify-center rounded-full border border-border text-text-primary transition-colors hover:bg-black/5"
              [attr.aria-label]="'LANDING.DESTINATIONS.SCROLL_RIGHT' | translate"
              (click)="scroll(1)"
            >
              <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
          </div>
        </div>
      } @else if (title) {
        <h3 class="mb-4 text-center text-2xl font-bold text-text-primary lg:text-left">{{ title }}</h3>
      }
    </ng-template>

    <ng-template #scrollerRow>
      @if (loading) {
        <div class="hide-scrollbar -mx-5 flex gap-5 overflow-x-auto px-5 pb-2 lg:-mx-0 lg:px-0">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="h-[270px] w-[302px] shrink-0 animate-pulse rounded-2xl bg-gray-200"></div>
          }
        </div>
      } @else if (!cards.length) {
        <p class="py-8 text-center text-sm text-text-secondary">{{ 'LANDING.REGIONS.EMPTY' | translate }}</p>
      } @else {
        <div
          #scroller
          class="hide-scrollbar -mx-5 flex gap-5 overflow-x-auto px-5 pb-2 lg:-mx-0 lg:px-0"
        >
          @for (card of cards; track card.title; let i = $index) {
            <article
              class="group relative h-[270px] w-[302px] shrink-0 cursor-pointer overflow-hidden rounded-2xl hover-scale hover-glow"
              [routerLink]="['/packages']"
              [queryParams]="{ region: card.title }"
            >
              <img
                [src]="card.image"
                [alt]="card.title"
                width="302"
                height="270"
                [attr.loading]="i < 2 ? 'eager' : 'lazy'"
                [attr.fetchpriority]="i < 2 ? 'high' : 'auto'"
                class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div class="absolute inset-x-0 bottom-0 h-[120px] bg-gradient-to-t from-black/85 to-transparent"></div>
              <div class="absolute bottom-4 left-0 right-0 px-4 text-white">
                <p class="mb-1 text-xs font-medium uppercase tracking-[0.06em] text-white/70">{{ card.subtitle | translate }}</p>
                <h3 class="text-2xl font-bold leading-none">{{ card.title }}</h3>
              </div>

              @if (getTravelTag(card.title)) {
                <span
                  class="absolute left-3 top-3 rounded-full px-2.5 py-1 text-2xs-plus font-semibold text-white backdrop-blur-sm"
                  style="background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.2);"
                >
                  {{ getTravelTagEmoji(card.title) }} {{ getTravelTag(card.title) | translate }}
                </span>
              }

              <div class="card-cta">
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
      }
    </ng-template>
  `
})
export class DestinationCarouselSectionComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle = '';
  @Input() watermark = '';
  @Input({ required: true }) cards!: CarouselCard[];
  @Input() embedded = false;
  @Input() showHeader = true;
  @Input() loading = false;

  @ViewChild('scroller') scroller?: ElementRef<HTMLDivElement>;

  scroll(direction: -1 | 1): void {
    const el = this.scroller?.nativeElement;
    if (!el) return;
    el.scrollBy({ left: direction * 326, behavior: 'smooth' });
  }

  private readonly travelTags: Record<string, [string, string]> = {
    Dubai: ['🏙️', 'LANDING.TAGS.LUXURY'], 'Abu Dhabi': ['🏛️', 'LANDING.TAGS.CULTURE'], Bahrain: ['🌊', 'LANDING.TAGS.ISLAND'],
    Qatar: ['⚽', 'LANDING.TAGS.SPORTS'], Alula: ['🗿', 'LANDING.TAGS.HISTORY'], 'Saudi Arabia': ['🕌', 'LANDING.TAGS.CULTURE'],
    Kuwait: ['🌇', 'LANDING.TAGS.CITY'], Muscat: ['⛵', 'LANDING.TAGS.COASTAL'], Doha: ['✨', 'LANDING.TAGS.MODERN'],
    'New York': ['🗽', 'LANDING.TAGS.CITY'], 'East coast': ['🚂', 'LANDING.TAGS.ROAD_TRIP'], Orlando: ['🎢', 'LANDING.TAGS.FAMILY'],
    'west coast': ['🌊', 'LANDING.TAGS.COASTAL'], 'Los Angeles': ['🎬', 'LANDING.TAGS.LIFESTYLE'], Dallas: ['🤠', 'LANDING.TAGS.CULTURE'],
    Belgium: ['🍫', 'LANDING.TAGS.CULTURE'], Austria: ['🎵', 'LANDING.TAGS.MUSIC'], London: ['👑', 'LANDING.TAGS.HISTORIC'],
    Norway: ['🏔️', 'LANDING.TAGS.NATURE'], Greece: ['🏛️', 'LANDING.TAGS.ANCIENT'], Spain: ['💃', 'LANDING.TAGS.FIESTA'],
    Finland: ['🌌', 'LANDING.TAGS.AURORA'], Italy: ['🍕', 'LANDING.TAGS.FOOD'],
    Philippines: ['🏝️', 'LANDING.TAGS.BEACH'], 'Sri Lanka': ['🍃', 'LANDING.TAGS.NATURE'], Singapore: ['🦁', 'LANDING.TAGS.MODERN'],
    Malaysia: ['🌴', 'LANDING.TAGS.TROPICAL'], Japan: ['⛩️', 'LANDING.TAGS.CULTURE'], China: ['🐲', 'LANDING.TAGS.HERITAGE'],
    France: ['🗼', 'LANDING.TAGS.ROMANCE'], Bali: ['🌺', 'LANDING.TAGS.WELLNESS'], Thailand: ['🐘', 'LANDING.TAGS.ADVENTURE'],
    Australia: ['🦘', 'LANDING.TAGS.WILD'], Kenya: ['🦁', 'LANDING.TAGS.SAFARI'], Goa: ['🏖️', 'LANDING.TAGS.BEACH'],
    Fiji: ['💎', 'LANDING.TAGS.LUXURY'], Queensland: ['🐠', 'LANDING.TAGS.REEF'], Morocco: ['🕌', 'LANDING.TAGS.DESERT'],
    Perth: ['🌊', 'LANDING.TAGS.COASTAL'], Egypt: ['🏺', 'LANDING.TAGS.ANCIENT'],
  };

  getTravelTagEmoji(title: string): string {
    return this.travelTags[title]?.[0] || '';
  }

  getTravelTag(title: string): string {
    return this.travelTags[title]?.[1] || '';
  }
}
