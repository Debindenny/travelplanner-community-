import { Component, Input } from '@angular/core';

import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LogoComponent } from '../../../shared/components/logo/logo.component';

@Component({
    selector: 'app-about-cta-section',
    imports: [TranslatePipe, RouterLink, LogoComponent],
    template: `
    <section 
      id="join"
      class="section-container bg-surface py-20 transition-all duration-700 ease-out"
      [class.opacity-100]="isVisible"
      [class.translate-y-0]="isVisible"
      [class.opacity-0]="!isVisible"
      [class.translate-y-12]="!isVisible"
    >
      <div class="mx-auto max-w-content">
        <div class="relative overflow-hidden rounded-card bg-gradient-to-br from-primary via-primary-hover to-slate-900 px-8 py-16 text-white shadow-2xl sm:px-12 sm:py-20 md:px-16 flex flex-col lg:flex-row items-center gap-12">
          <!-- Decorative background shapes -->
          <div class="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/5 blur-3xl" aria-hidden="true"></div>
          <div class="pointer-events-none absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-primary-50/10 blur-3xl" aria-hidden="true"></div>
          <img src="assets/images/about/wave-pattern.svg" alt="" class="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20 mix-blend-overlay" aria-hidden="true" />

          <div class="relative z-10 flex-1 text-center lg:text-left">
            <h2 class="text-4xl md:text-5xl font-bold leading-tight">
              {{ 'ABOUT.JOIN.TITLE_PREFIX' | translate }} <span class="text-primary-50">TRAVL PLANR</span>
            </h2>
            <p class="mt-6 text-base md:text-lg leading-relaxed text-white/90 whitespace-pre-line">
              {{ 'ABOUT.JOIN.TEXT' | translate }}
            </p>
            
            <div class="mt-8 p-6 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 italic text-white/90">
              &ldquo;{{ 'ABOUT.INSPIRE.TEXT' | translate }}&rdquo;
            </div>

            <div class="mt-10 flex flex-col items-center justify-center lg:justify-start gap-4 sm:flex-row">
              <a
                routerLink="/wizard"
                class="inline-flex h-12 items-center justify-center rounded-btn bg-white px-8 text-base font-semibold text-primary no-underline transition-all duration-300 hover:scale-105 hover:bg-primary-50 hover:shadow-lg"
              >
                {{ 'ABOUT.HERO.CTA_START' | translate }}
              </a>
              <a
                routerLink="/pricing"
                class="inline-flex h-12 items-center justify-center rounded-btn bg-transparent border-2 border-white/30 px-8 text-base font-semibold text-white no-underline transition-all duration-300 hover:bg-white/10"
              >
                {{ 'ABOUT.JOIN.CTA_PRICING' | translate }}
              </a>
            </div>
          </div>
          
          <div class="relative z-10 hidden lg:flex w-1/3 justify-center">
            <app-logo variant="light" class="transform scale-150 opacity-90 drop-shadow-2xl" />
          </div>
        </div>
      </div>
    </section>
  `
})
export class AboutCtaSectionComponent {
  @Input() isVisible = false;
}
