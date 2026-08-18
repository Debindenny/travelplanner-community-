import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  inject,
  signal,
  ElementRef,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { PublicPageShellComponent } from '../shared/components/public-page-shell/public-page-shell.component';
import { SeoService } from '../shared/services/seo.service';
import { AboutMapComponent } from './components/about-map/about-map.component';
import { AboutTimelineComponent } from './components/about-timeline/about-timeline.component';
import { AboutHeroSectionComponent } from './components/about-hero-section/about-hero-section.component';
import { AboutIntroSectionComponent } from './components/about-intro-section/about-intro-section.component';
import { AboutFeaturesSectionComponent } from './components/about-features-section/about-features-section.component';
import { AboutTeamSectionComponent } from './components/about-team-section/about-team-section.component';
import { AboutCtaSectionComponent } from './components/about-cta-section/about-cta-section.component';
import { AboutSectionNavComponent } from './components/about-section-nav/about-section-nav.component';
import { ABOUT_HERO_IMAGE } from '../shared/data/about.data';

@Component({
    selector: 'app-about-page',
    imports: [
        TranslatePipe,
        PublicPageShellComponent,
        AboutMapComponent,
        AboutTimelineComponent,
        AboutHeroSectionComponent,
        AboutIntroSectionComponent,
        AboutFeaturesSectionComponent,
        AboutTeamSectionComponent,
        AboutCtaSectionComponent,
        AboutSectionNavComponent
    ],
    template: `
    <app-public-page-shell variant="hero" background="surface-muted">
      <app-about-hero-section />
      <app-about-section-nav />

      <!-- Story / Intro -->
      <app-about-intro-section 
        data-section-id="intro" 
        [isVisible]="visibleSections()['intro']" 
      />

      <!-- Timeline -->
      <section 
        id="timeline"
        data-section-id="timeline"
        class="section-container bg-surface py-20 transition-all duration-700 ease-out"
        [class.opacity-100]="visibleSections()['timeline']"
        [class.translate-y-0]="visibleSections()['timeline']"
        [class.opacity-0]="!visibleSections()['timeline']"
        [class.translate-y-12]="!visibleSections()['timeline']"
      >
        <div class="mx-auto max-w-content">
          <app-about-timeline />
        </div>
      </section>

      <!-- Features -->
      <app-about-features-section 
        data-section-id="features"
        [isVisible]="visibleSections()['features']" 
      />

      <!-- Map -->
      <section 
        id="map"
        data-section-id="map"
        class="section-container bg-surface py-20 transition-all duration-700 ease-out"
        [class.opacity-100]="visibleSections()['map']"
        [class.translate-y-0]="visibleSections()['map']"
        [class.opacity-0]="!visibleSections()['map']"
        [class.translate-y-12]="!visibleSections()['map']"
      >
        <div class="mx-auto max-w-content">
          <app-about-map />
        </div>
      </section>

      <!-- Team -->
      <app-about-team-section 
        data-section-id="team"
        [isVisible]="visibleSections()['team']" 
      />

      <!-- Join CTA -->
      <app-about-cta-section
        data-section-id="join"
        [isVisible]="visibleSections()['join']"
      />
    </app-public-page-shell>
  `
})
export class AboutPageComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly seo = inject(SeoService);
  private readonly elementRef = inject(ElementRef);
  private intersectionObserver: IntersectionObserver | null = null;

  // Viewport Reveal States
  readonly visibleSections = signal<{ [key: string]: boolean }>({});

  ngOnInit(): void {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://travlplanr.com';
    const ogImageUrl = `${origin}/${ABOUT_HERO_IMAGE}`;

    this.seo.set({
      title: 'About Us | TRAVL PLANR - Effortless Travel Planning',
      description:
        'Learn more about TRAVL PLANR, our mission, vision, and how our intelligent AI-powered itineraries make travel planning effortless and smart.',
      ogImage: ogImageUrl
    });

    this.seo.setJsonLd({
      '@type': 'Organization',
      name: 'TRAVL PLANR',
      url: origin,
      logo: `${origin}/assets/images/logo.svg`,
      foundingDate: '2023',
      sameAs: [
        'https://twitter.com/travlplanr',
        'https://linkedin.com/company/travlplanr',
      ],
    });
  }

  ngAfterViewInit(): void {
    if (typeof IntersectionObserver !== 'undefined') {
      this.intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.getAttribute('data-section-id');
            if (sectionId) {
              this.visibleSections.update(state => ({ ...state, [sectionId]: true }));
            }
          }
        });
      }, { threshold: 0.12 });

      // Grab elements that have the data-section-id attribute
      const sections = this.elementRef.nativeElement.querySelectorAll('[data-section-id]');
      sections.forEach((sec: HTMLElement) => this.intersectionObserver?.observe(sec));
    } else {
      // Fallback for non-browser/SSR environments
      this.visibleSections.set({
        intro: true,
        timeline: true,
        features: true,
        map: true,
        team: true,
        join: true
      });
    }
  }

  ngOnDestroy(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
  }
}
