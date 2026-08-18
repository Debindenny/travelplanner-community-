import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SectionHeaderComponent } from '../../../shared/components/section-header/section-header.component';
import { PackageCardComponent } from '../../../shared/components/package-card/package-card.component';
import { READY_PACKAGES } from '../../../shared/data/landing.data';
import { PackageCard } from '../../../shared/models/landing.models';
import { apiUrl } from '../../../shared/utils/api-url';
import { humanizePackageTheme } from '../../../shared/utils/package-theme.util';

import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LocaleService } from '../../../core/services/locale.service';

@Component({
    selector: 'app-packages-carousel-section',
    imports: [
    RouterLink,
    SectionHeaderComponent,
    PackageCardComponent,
    TranslatePipe
],
    styles: [
        `
      :host { display: block; width: 100%; }

      .carousel-shell {
        position: relative;
      }

      .carousel-fade-left,
      .carousel-fade-right {
        pointer-events: none;
        position: absolute;
        top: 0;
        bottom: 0;
        width: 48px;
        z-index: 2;
      }
      .carousel-fade-left {
        left: 0;
        background: linear-gradient(to right, var(--fade-color, #f8fafc) 15%, transparent);
      }
      .carousel-fade-right {
        right: 0;
        background: linear-gradient(to left, var(--fade-color, #f8fafc) 15%, transparent);
      }

      .dot {
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.18);
        transition: width 0.2s ease, background 0.2s ease;
      }
      .dot.active {
        width: 18px;
        background: #0060EA;
      }
    `,
    ],
    template: `
    <section
      id="packages"
      class="landing-section bg-surface-muted"
      style="--fade-color: var(--color-surface-muted, #f8fafc);"
    >
      <div class="section-container flex flex-col gap-8">
        <div class="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <app-section-header
            [title]="'LANDING.PACKAGES.TITLE' | translate"
            [watermark]="'LANDING.PACKAGES.WATERMARK' | translate"
            [subtitle]="'LANDING.PACKAGES.SUBTITLE' | translate"
            [subtleWatermark]="true"
            [narrow]="false"
            class="flex-1"
          />

          <div class="hidden shrink-0 gap-3 lg:flex">
            <button
              type="button"
              class="flex h-11 w-11 items-center justify-center rounded-full border border-border text-text-primary transition-colors hover:bg-black/5 disabled:opacity-40"
              [attr.aria-label]="'LANDING.PACKAGES.SCROLL_LEFT' | translate"
              [disabled]="!canScrollLeft()"
              (click)="scroll(-1)"
            >
              <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
            <button
              type="button"
              class="flex h-11 w-11 items-center justify-center rounded-full border border-border text-text-primary transition-colors hover:bg-black/5 disabled:opacity-40"
              [attr.aria-label]="'LANDING.PACKAGES.SCROLL_RIGHT' | translate"
              [disabled]="!canScrollRight()"
              (click)="scroll(1)"
            >
              <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div class="carousel-shell">
          @if (canScrollLeft()) {
            <div class="carousel-fade-left hidden sm:block" aria-hidden="true"></div>
          }
          @if (canScrollRight()) {
            <div class="carousel-fade-right hidden sm:block" aria-hidden="true"></div>
          }

          <div
            #scroller
            class="hide-scrollbar -mx-5 flex gap-5 overflow-x-auto px-5 pb-2 lg:-mx-0 lg:px-0"
            (scroll)="onScrollerScroll()"
          >
            @for (pkg of packagesList(); track pkg.id || pkg.title) {
              <app-package-card [package]="pkg" />
            }
          </div>
        </div>

        @if (packagesList().length > 1) {
          <div class="flex justify-center gap-1.5 lg:hidden" aria-hidden="true">
            @for (pkg of packagesList(); track pkg.id || pkg.title; let i = $index) {
              <span class="dot" [class.active]="activeDot() === i"></span>
            }
          </div>
        }

        <div class="flex justify-center pt-2">
          <a
            routerLink="/packages"
            class="btn-secondary-pill px-6 py-3 text-sm no-underline"
          >
            {{ 'LANDING.PACKAGES.BROWSE_ALL' | translate }}
            <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </a>
        </div>
      </div>
    </section>
  `
})
export class PackagesCarouselSectionComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly locale = inject(LocaleService);
  private lastCurrencyEpoch = 0;

  readonly packagesList = signal<PackageCard[]>(READY_PACKAGES);
  readonly canScrollLeft = signal(false);
  readonly canScrollRight = signal(false);
  readonly activeDot = signal(0);

  @ViewChild('scroller') scroller?: ElementRef<HTMLDivElement>;

  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    effect(() => {
      const epoch = this.locale.currencyEpoch();
      if (epoch <= this.lastCurrencyEpoch) return;
      this.lastCurrencyEpoch = epoch;
      this.loadPackages();
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    this.loadPackages();
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.updateScrollState());

    const el = this.scroller?.nativeElement;
    if (el && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.updateScrollState());
      this.resizeObserver.observe(el);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  scroll(direction: -1 | 1): void {
    const el = this.scroller?.nativeElement;
    if (!el) return;
    el.scrollBy({ left: direction * 340, behavior: 'smooth' });
  }

  onScrollerScroll(): void {
    this.updateScrollState();
  }

  private updateScrollState(): void {
    const el = this.scroller?.nativeElement;
    if (!el) return;

    const maxScroll = el.scrollWidth - el.clientWidth;
    this.canScrollLeft.set(el.scrollLeft > 8);
    this.canScrollRight.set(el.scrollLeft < maxScroll - 8);

    const cardWidth = 340;
    const index = Math.round(el.scrollLeft / cardWidth);
    this.activeDot.set(Math.min(Math.max(index, 0), this.packagesList().length - 1));
  }

  private loadPackages(): void {
    this.http.get<any[]>(apiUrl('/packages')).subscribe({
      next: (pkgs) => {
        if (pkgs && pkgs.length > 0) {
          const mapped: PackageCard[] = pkgs.map((p) => ({
            id: p.id,
            title: p.title,
            price: p.price != null ? String(p.price) : '79999',
            days: p.days || '6 Days',
            group: p.group || 'Family / Friends',
            theme: humanizePackageTheme(p.theme || p.region || ''),
            image: p.image || 'assets/images/placeholder.jpg',
            rating: typeof p.rating === 'number' ? p.rating : undefined,
            reviewCount: typeof p.review_count === 'number' ? p.review_count : undefined,
          }));
          this.packagesList.set(mapped.slice(0, 6));
          queueMicrotask(() => this.updateScrollState());
        }
      },
      error: (err) => {
        console.warn('Backend packages API offline/empty. Using pre-seeded static escapes.', err);
      },
    });
  }
}
