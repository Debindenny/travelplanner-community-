import { Component, effect, inject, OnInit } from '@angular/core';
import { HeroSectionComponent } from './components/hero-section/hero-section.component';
import { HowItWorksSectionComponent } from './components/how-it-works-section/how-it-works-section.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { TrendingDestinationsSectionComponent } from './components/trending-destinations-section/trending-destinations-section.component';
import { CtaBannerSectionComponent } from './components/cta-banner-section/cta-banner-section.component';
import { FooterSectionComponent } from './components/footer-section/footer-section.component';
import { TestimonialsSectionComponent } from './components/testimonials-section/testimonials-section.component';
import { PackagesCarouselSectionComponent } from './components/packages-carousel-section/packages-carousel-section.component';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SeoService } from '../shared/services/seo.service';
import { LandingDestinationsService } from './services/landing-destinations.service';
import { RegionTabsSectionComponent } from './components/region-tabs-section/region-tabs-section.component';
import { ChatContextService } from '../shared/services/chat-context.service';
import { LandingSectionNavComponent } from './components/landing-section-nav/landing-section-nav.component';
import { LocaleService } from '../core/services/locale.service';

@Component({
    selector: 'app-landing-page',
    imports: [
        RouterLink,
        HeroSectionComponent,
        NavbarComponent,
        LandingSectionNavComponent,
        HowItWorksSectionComponent,
        TrendingDestinationsSectionComponent,
        CtaBannerSectionComponent,
        FooterSectionComponent,
        TestimonialsSectionComponent,
        PackagesCarouselSectionComponent,
        RegionTabsSectionComponent,
        TranslatePipe,
    ],
    providers: [LandingDestinationsService],
    template: `
    <div class="min-h-screen">
      <div [class.landing-dock-padded]="chatContext.heroDockPinned()">
        <app-navbar variant="hero" [overlayHero]="true" [showUserActions]="true" />
        <app-hero-section />
      </div>

      <app-landing-section-nav />

      @if (destinations.error()) {
        <div class="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-800">
          {{ destinations.error() }}
          <button
            type="button"
            class="ml-2 font-semibold underline"
            (click)="destinations.loadDestinations()"
          >
            {{ 'LANDING.RETRY_LIVE_DATA' | translate }}
          </button>
        </div>
      }

      <app-how-it-works-section />
      <app-packages-carousel-section />
      <app-trending-destinations-section
        [destinations]="destinations.popularDestinations()"
        [loading]="destinations.isLoading()"
      />
      <app-testimonials-section />
      <app-cta-banner-section />
      <app-region-tabs-section />

      <a [routerLink]="['/explore']" [queryParams]="{q: 'Paris'}" class="sr-only">{{ 'LANDING.EXPLORE_DESTINATIONS_SR' | translate }}</a>
      <app-footer-section />
    </div>
  `
})
export class LandingPageComponent implements OnInit {
  private readonly seo = inject(SeoService);
  private readonly locale = inject(LocaleService);
  readonly destinations = inject(LandingDestinationsService);
  readonly chatContext = inject(ChatContextService);
  private lastCurrencyEpoch = 0;

  constructor() {
    effect(() => {
      const epoch = this.locale.currencyEpoch();
      if (epoch <= this.lastCurrencyEpoch) return;
      this.lastCurrencyEpoch = epoch;
      this.destinations.loadDestinations();
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
    this.seo.set({
      title: 'Travl Planr — AI Trip Planner & Curated Travel Packages',
      description:
        'Plan your perfect trip with Travl Planr. Discover trending destinations, AI-built itineraries, and curated travel packages across the world.',
    });
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://travlplanr.com';
    this.seo.setJsonLd([
      {
        '@type': 'Organization',
        name: 'Travl Planr',
        url: siteUrl,
        description:
          'AI trip planner and curated travel packages — trending destinations and AI-built itineraries across the world.',
      },
      {
        '@type': 'WebSite',
        name: 'Travl Planr',
        url: siteUrl,
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${siteUrl}/explore?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ]);
    this.destinations.loadDestinations();
  }
}
