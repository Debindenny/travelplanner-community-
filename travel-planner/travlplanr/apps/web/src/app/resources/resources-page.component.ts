import { Component, OnInit, inject } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PublicPageShellComponent } from '../shared/components/public-page-shell/public-page-shell.component';
import { PublicPageCtaComponent } from '../shared/components/public-page-cta/public-page-cta.component';
import { SeoService } from '../shared/services/seo.service';

interface ResourceCategory {
  titleKey: string;
  descriptionKey: string;
  href: string;
  linkLabelKey: string;
}

const RESOURCE_CATEGORIES: ResourceCategory[] = [
  {
    titleKey: 'RESOURCES.VISA.TITLE',
    descriptionKey: 'RESOURCES.VISA.DESCRIPTION',
    href: 'https://www.passportindex.org',
    linkLabelKey: 'RESOURCES.VISA.LINK_LABEL',
  },
  {
    titleKey: 'RESOURCES.INSURANCE.TITLE',
    descriptionKey: 'RESOURCES.INSURANCE.DESCRIPTION',
    href: 'https://www.insuremytrip.com',
    linkLabelKey: 'RESOURCES.INSURANCE.LINK_LABEL',
  },
  {
    titleKey: 'RESOURCES.CURRENCY.TITLE',
    descriptionKey: 'RESOURCES.CURRENCY.DESCRIPTION',
    href: 'https://www.xe.com',
    linkLabelKey: 'RESOURCES.CURRENCY.LINK_LABEL',
  },
  {
    titleKey: 'RESOURCES.PACKING.TITLE',
    descriptionKey: 'RESOURCES.PACKING.DESCRIPTION',
    href: 'https://www.travelandleisure.com/trip-ideas/packing-tips',
    linkLabelKey: 'RESOURCES.PACKING.LINK_LABEL',
  },
];

@Component({
    selector: 'app-resources-page',
    imports: [TranslatePipe, PublicPageShellComponent, PublicPageCtaComponent],
    template: `
    <app-public-page-shell variant="content">
      <section class="section-container py-16">
        <div class="max-w-[720px]">
          <h1 class="text-[clamp(1.75rem,4vw,40px)] font-semibold leading-tight text-text-primary">
            {{ 'RESOURCES.HEADING' | translate }}
          </h1>
          <p class="mt-3 text-lg text-text-secondary">
            {{ 'RESOURCES.SUBHEADING' | translate }}
          </p>
        </div>

        <div class="mt-10 grid gap-6 sm:grid-cols-2">
          @for (category of categories; track category.titleKey) {
            <div class="rounded-card border border-border bg-white p-7">
              <h2 class="text-xl font-semibold text-text-primary">{{ category.titleKey | translate }}</h2>
              <p class="mt-2 text-base leading-relaxed text-text-secondary">
                {{ category.descriptionKey | translate }}
              </p>
              <a
                [href]="category.href"
                target="_blank"
                rel="noopener noreferrer"
                class="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary no-underline hover:underline"
              >
                {{ category.linkLabelKey | translate }}
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4.5M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          }
        </div>

        <p class="mt-10 max-w-[720px] text-sm text-text-tertiary">
          {{ 'RESOURCES.AFFILIATE_DISCLOSURE' | translate }}
        </p>
      </section>

      <app-public-page-cta />
    </app-public-page-shell>
  `
})
export class ResourcesPageComponent implements OnInit {
  private readonly seo = inject(SeoService);
  private readonly translate = inject(TranslateService);
  readonly categories = RESOURCE_CATEGORIES;

  ngOnInit(): void {
    this.seo.set({
      title: this.translate.instant('RESOURCES.SEO.TITLE'),
      description: this.translate.instant('RESOURCES.SEO.DESCRIPTION'),
    });
  }
}
