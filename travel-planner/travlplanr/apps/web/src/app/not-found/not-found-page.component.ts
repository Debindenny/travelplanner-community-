import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { FooterSectionComponent } from '../landing/components/footer-section/footer-section.component';
import { NavbarComponent } from '../landing/components/navbar/navbar.component';
import { SeoService } from '../shared/services/seo.service';

@Component({
    selector: 'app-not-found-page',
    imports: [RouterLink, TranslatePipe, FooterSectionComponent, NavbarComponent],
    template: `
    <div class="min-h-screen bg-surface-muted font-poppins">
      <app-navbar variant="default" [showUserActions]="true" />

      <main class="pt-[73px]">
        <section class="section-container flex min-h-[560px] items-center justify-center py-20">
          <div class="flex w-full max-w-[720px] flex-col items-center gap-6 text-center">
            <div class="flex w-full flex-col items-center">
              <p class="text-[clamp(5rem,20vw,8rem)] font-bold leading-none text-primary">404</p>
              <h1 class="mt-4 text-[clamp(2rem,6vw,3rem)] font-semibold leading-tight text-text-primary">
                {{ 'NOTFOUND.TITLE' | translate }}
              </h1>
              <p class="mt-3 max-w-[520px] text-base leading-relaxed text-text-secondary">
                {{ 'NOTFOUND.DESCRIPTION' | translate }}
              </p>
            </div>

            <div class="flex flex-wrap items-center justify-center gap-3">
              <a
                routerLink="/"
                class="inline-flex h-12 items-center justify-center rounded-btn bg-primary px-6 text-base font-medium text-white no-underline transition-colors hover:bg-primary-hover"
              >
                {{ 'NOTFOUND.BACK_HOME' | translate }}
              </a>
              <a
                routerLink="/explore"
                class="inline-flex h-12 items-center justify-center rounded-btn border border-border bg-white px-6 text-base font-medium text-text-primary no-underline transition-colors hover:border-primary hover:text-primary"
              >
                {{ 'NOTFOUND.EXPLORE' | translate }}
              </a>
              <a
                routerLink="/blog"
                class="inline-flex h-12 items-center justify-center rounded-btn border border-border bg-white px-6 text-base font-medium text-text-primary no-underline transition-colors hover:border-primary hover:text-primary"
              >
                {{ 'NOTFOUND.BLOG' | translate }}
              </a>
              <a
                routerLink="/contact"
                class="inline-flex h-12 items-center justify-center rounded-btn border border-border bg-white px-6 text-base font-medium text-text-primary no-underline transition-colors hover:border-primary hover:text-primary"
              >
                {{ 'NOTFOUND.CONTACT' | translate }}
              </a>
            </div>
          </div>
        </section>
      </main>

      <app-footer-section />
    </div>
  `
})
export class NotFoundPageComponent implements OnInit {
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.set({
      title: 'Page not found | TRAVL PLANR',
      description: 'The page you are looking for could not be found.',
      robots: 'noindex, nofollow',
    });
  }
}
