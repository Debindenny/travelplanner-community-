import { Component, signal, HostListener } from '@angular/core';

import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AnimatedLinkComponent } from '../../../shared/components/animated-link/animated-link.component';
import { ABOUT_HERO_IMAGE } from '../../../shared/data/about.data';

@Component({
    selector: 'app-about-hero-section',
    imports: [RouterLink, TranslatePipe, AnimatedLinkComponent],
    template: `
    <section class="relative h-[400px] overflow-hidden" id="hero">
      <img
        [src]="heroImage"
        alt=""
        class="absolute inset-0 h-full w-full object-cover transition-transform duration-100 ease-out"
        [style.transform]="'translate3d(0, ' + heroTranslationY() + 'px, 0)'"
        width="1440"
        height="400"
        aria-hidden="true"
        fetchpriority="high"
      />
      <div
        class="absolute inset-0 bg-gradient-to-b from-primary/90 via-primary/80 to-primary"
        aria-hidden="true"
      ></div>

      <div class="relative z-10 mx-auto flex h-full max-w-[1040px] flex-col items-center justify-center px-5 pb-8 pt-[73px] text-center text-white">
        <h1 class="text-4xl md:text-5xl font-bold leading-tight tracking-tight">
          {{ 'ABOUT.HERO.TITLE' | translate }}
        </h1>
        <p class="mt-4 max-w-[666px] text-lg font-medium leading-normal text-white/90">
          {{ 'ABOUT.HERO.SUBTITLE' | translate }}
        </p>
        <div class="mt-8 flex flex-col sm:flex-row items-center gap-4">
          <a
            id="about-hero-cta"
            routerLink="/wizard"
            class="inline-flex h-12 items-center justify-center rounded-btn bg-white px-8 text-base font-semibold text-primary no-underline transition-all duration-300 hover:scale-105 hover:bg-primary-50 shadow-xl hover:shadow-2xl ring-2 ring-white/30 hover:ring-white/60"
          >
            {{ 'ABOUT.HERO.CTA_START' | translate }}
          </a>
          <a
            id="about-hero-explore"
            routerLink="/explore"
            class="inline-flex h-12 items-center justify-center rounded-btn bg-white/10 backdrop-blur-md px-8 text-base font-semibold text-white no-underline transition-all duration-300 hover:scale-105 hover:bg-white/20 border border-white/20"
          >
            {{ 'ABOUT.HERO.CTA_EXPLORE' | translate }}
          </a>
        </div>
        <app-animated-link
          id="about-hero-pricing"
          variant="underline-center"
          routerLink="/pricing"
          class="mt-6 text-sm font-medium text-white/75"
        >
          {{ 'ABOUT.HERO.VIEW_PLANS' | translate }}
        </app-animated-link>
      </div>
    </section>
  `
})
export class AboutHeroSectionComponent {
  readonly heroImage = ABOUT_HERO_IMAGE;
  readonly heroTranslationY = signal(0);
  private readonly reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  @HostListener('window:scroll', [])
  onScroll(): void {
    if (this.reducedMotion || typeof window === 'undefined') return;
    const scrollY = window.scrollY;
    if (scrollY < 600) {
      this.heroTranslationY.set(scrollY * 0.35);
    }
  }
}
