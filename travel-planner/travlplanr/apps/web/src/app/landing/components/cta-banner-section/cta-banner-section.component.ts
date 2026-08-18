import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AnimatedLinkComponent } from '../../../shared/components/animated-link/animated-link.component';

@Component({
    selector: 'app-cta-banner-section',
    imports: [AnimatedLinkComponent, RouterLink, TranslatePipe],
    styles: [
        `
      :host { display: block; width: 100%; }

      .cta-wrap {
        background: #111827;
        border-radius: 20px;
        position: relative;
        overflow: hidden;
      }

      .cta-glow {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(ellipse 60% 80% at 80% 50%, rgba(0, 96, 234, 0.18) 0%, transparent 65%),
          radial-gradient(ellipse 40% 60% at 15% 50%, rgba(120, 60, 220, 0.12) 0%, transparent 60%);
        pointer-events: none;
      }

      .avatar-stack { display: flex; }
      .avatar-stack img {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 2px solid #111827;
        margin-left: -8px;
        object-fit: cover;
      }
      .avatar-stack img:first-child { margin-left: 0; }
    `,
    ],
    template: `
    <section id="cta" class="landing-section bg-white">
      <div class="section-container">
        <div class="cta-wrap mx-auto max-w-[1283px] px-8 py-16 text-center text-white md:px-16">
          <div class="cta-glow"></div>

          <div class="relative mb-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <div class="avatar-stack">
              @for (seed of ['Priya', 'Arjun', 'Fatima', 'James', 'Sneha']; track seed) {
                <img
                  [src]="'https://api.dicebear.com/7.x/avataaars/svg?seed=' + seed"
                  [alt]="'LANDING.CTA.TRAVELLER_ALT' | translate"
                />
              }
            </div>
            <div class="text-left">
              <div class="mb-0.5 flex gap-0.5">
                @for (s of [1,2,3,4,5]; track s) {
                  <svg class="h-3.5 w-3.5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                }
              </div>
              <p class="text-sm text-white/70">
                {{ 'LANDING.CTA.SOCIAL_PROOF_PREFIX' | translate }}
                <span class="font-semibold text-white">{{ 'LANDING.CTA.SOCIAL_PROOF_HIGHLIGHT' | translate }}</span>
                {{ 'LANDING.CTA.SOCIAL_PROOF_SUFFIX' | translate }}
              </p>
            </div>
          </div>

          <div class="relative mx-auto max-w-[880px]">
            <h2 class="text-[clamp(2rem,4vw,52px)] font-bold leading-[1.1] text-white">
              {{ 'LANDING.CTA.HEADLINE_LINE1' | translate }}<br class="hidden sm:block" /> {{ 'LANDING.CTA.HEADLINE_LINE2' | translate }}
            </h2>
            <p class="mx-auto mt-5 max-w-[560px] text-lg leading-relaxed text-white/70">
              {{ 'LANDING.CTA.SUBHEADLINE' | translate }}
            </p>
          </div>

          <div class="relative mt-10 flex flex-col items-center gap-3">
            <a routerLink="/wizard" class="btn-primary-pill h-12 bg-white px-10 text-base text-gray-900 no-underline hover:bg-white/90">
              {{ 'LANDING.CTA.PRIMARY_BUTTON' | translate }}
            </a>
            <app-animated-link
              variant="highlight-wipe"
              routerLink="/packages"
              class="text-sm font-medium text-white/75"
            >
              {{ 'LANDING.CTA.SECONDARY_LINK' | translate }}
            </app-animated-link>
          </div>
        </div>
      </div>
    </section>
  `
})
export class CtaBannerSectionComponent {}
