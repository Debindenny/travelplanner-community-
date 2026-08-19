import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AnimatedLinkComponent } from '../../../shared/components/animated-link/animated-link.component';
import { LogoComponent } from '../../../shared/components/logo/logo.component';
import { ToastService } from '../../../shared/utils/toast.service';
import { NewsletterService } from '../../../shared/services/newsletter.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.util';
import {
  FOOTER_LINK_GROUPS,
  PARTNER_LOGOS,
  SOCIAL_LINKS,
  SUPPORT_CONTACTS,
} from '../../../shared/data/landing.data';

@Component({
    selector: 'app-footer-section',
    imports: [LogoComponent, AnimatedLinkComponent, RouterLink, TranslatePipe, FormsModule],
    template: `
    <footer class="bg-dark-footer text-white">
      <div class="section-container pt-16">
        <div class="text-center">
          <p class="text-xl font-medium leading-normal text-white/60">
            {{ 'LANDING.FOOTER.PARTNERS_TITLE' | translate }}
          </p>
          <div class="mt-11 flex flex-col gap-10 md:gap-[60px]">
            @for (row of partnerRows; track $index) {
              <div class="flex flex-wrap items-center justify-center gap-x-8 gap-y-6 md:justify-between">
                @for (partner of row; track partner.name) {
                  @if (partner.companionText) {
                    <div class="flex min-w-0 items-center gap-1.5">
                      <img
                        [src]="partner.image"
                        alt=""
                        [class]="(partner.className || 'h-[45px]') + ' object-contain mix-blend-screen'"
                        aria-hidden="true"
                      />
                      <span class="text-3xl font-medium leading-none text-white sm:text-4xl">{{ partner.companionText | translate }}</span>
                    </div>
                  } @else if (partner.image) {
                    <img
                      [src]="partner.image"
                      [alt]="partner.name"
                      [class]="(partner.className || 'h-[45px]') + ' w-auto object-contain'"
                    />
                  } @else {
                    <span class="text-lg font-medium text-white/80">{{ partner.name }}</span>
                  }
                }
              </div>
            }
          </div>
        </div>

        <hr class="my-12 border-0 border-t border-border" aria-hidden="true" />

        <div class="relative z-10 grid gap-14 lg:grid-cols-[302px_1fr_1fr_1fr]">
          <div class="space-y-6">
            <app-logo variant="light" />
            <p class="max-w-[302px] text-sm leading-normal text-white">
              {{ 'LANDING.FOOTER.TAGLINE' | translate }}
            </p>

            <form class="max-w-[302px]" (submit)="onNewsletterSubmit($event)">
              <label class="mb-2 block text-sm font-medium text-white/70" for="newsletter-email">
                {{ 'LANDING.FOOTER.NEWSLETTER_LABEL' | translate }}
              </label>
              <div class="flex gap-2">
                <input
                  id="newsletter-email"
                  type="email"
                  [(ngModel)]="newsletterEmail"
                  name="newsletterEmail"
                  [placeholder]="'LANDING.FOOTER.NEWSLETTER_PLACEHOLDER' | translate"
                  class="min-w-0 flex-1 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-primary"
                />
                <button type="submit" [disabled]="newsletterSubmitting()" class="btn-primary-pill shrink-0 px-4 py-2.5 text-sm disabled:opacity-60">
                  {{ 'LANDING.FOOTER.NEWSLETTER_BUTTON' | translate }}
                </button>
              </div>
              <label class="mt-3 flex items-start gap-2 text-xs text-white/60">
                <input
                  type="checkbox"
                  id="newsletter-consent"
                  name="newsletterConsent"
                  [(ngModel)]="newsletterConsent"
                  class="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-white/30 bg-white/10"
                />
                <span>{{ 'LANDING.FOOTER.NEWSLETTER_CONSENT' | translate }}</span>
              </label>
            </form>

            <div class="flex gap-8">
              @for (social of socials; track social.label) {
                <a
                  [href]="social.href"
                  class="flex h-5 w-5 items-center justify-center opacity-90 hover:opacity-100"
                  [attr.aria-label]="social.label"
                >
                  <img [src]="social.icon" [alt]="''" class="h-5 w-5 brightness-0 invert" />
                </a>
              }
            </div>
          </div>

          @for (group of linkGroups; track $index) {
            <div>
              @if (group.title) {
                <h4 class="mb-6 text-base font-medium text-white/70">{{ group.title | translate }}</h4>
              } @else {
                <div class="mb-6 h-6"></div>
              }
              <ul class="space-y-4">
                @for (link of group.links; track link.label) {
                  <li>
                    @if (link.children?.length) {
                      <div class="relative">
                        <button
                          type="button"
                          class="flex items-center gap-2 text-base text-border-light transition-colors hover:text-white"
                          (click)="toggleDropdown(link.label)"
                          [attr.aria-expanded]="isDropdownOpen(link.label)"
                        >
                          {{ link.label | translate }}
                          <svg
                            class="h-4 w-4 transition-transform"
                            [class.rotate-180]="isDropdownOpen(link.label)"
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                          </svg>
                        </button>
                        @if (isDropdownOpen(link.label)) {
                          <ul class="mt-3 space-y-3 border-l border-white/20 pl-4">
                            @for (child of link.children; track child.label) {
                              <li>
                                <a
                                  [href]="child.href"
                                  [target]="child.href.startsWith('http') ? '_blank' : '_self'"
                                  [attr.rel]="child.href.startsWith('http') ? 'noopener noreferrer' : null"
                                  (click)="onResourceLinkClick($event, child)"
                                  class="inline-flex items-center gap-1 text-sm text-border-light no-underline transition-colors hover:text-white"
                                >
                                  {{ child.label | translate }}
                                  @if (child.href.startsWith('http')) {
                                    <svg class="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                      <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4.5M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  }
                                </a>
                              </li>
                            }
                          </ul>
                        }
                      </div>
                    } @else {
                      @if (link.href.startsWith('/')) {
                        <a
                          [routerLink]="link.href"
                          class="inline-block text-base no-underline transition-colors hover:text-white"
                          [class.text-white]="link.highlighted"
                          [class.text-border-light]="!link.highlighted"
                        >{{ link.label | translate }}</a>
                      } @else {
                        <a
                          [href]="link.href"
                          class="inline-block text-base no-underline transition-colors hover:text-white"
                          [class.text-white]="link.highlighted"
                          [class.text-border-light]="!link.highlighted"
                        >{{ link.label | translate }}</a>
                      }
                    }
                  </li>
                }
              </ul>
            </div>
          }

          <div>
            <h4 class="mb-6 text-base font-medium text-white/70">{{ 'LANDING.FOOTER.SUPPORT_TITLE' | translate }}</h4>
            <ul class="space-y-8">
              @for (contact of supportContacts; track contact.label) {
                <li class="flex items-center gap-4">
                  <img [src]="contact.icon" alt="" class="h-6 w-6 shrink-0 brightness-0 invert opacity-80" />
                  <app-animated-link
                    variant="underline-arrow"
                    [href]="contact.href || '#'"
                    linkClass="text-base text-border-light transition-colors hover:text-white"
                  >
                    {{ contact.label }}
                  </app-animated-link>
                </li>
              }
            </ul>
          </div>
        </div>

        <div class="mt-12 flex flex-col items-center justify-between gap-4 py-8 sm:flex-row">
          <p class="text-sm text-white">{{ 'LANDING.FOOTER.COPYRIGHT' | translate:{ year: currentYear } }}</p>
          <button
            type="button"
            class="flex h-11 w-11 items-center justify-center rounded-full border border-white/80"
            [attr.aria-label]="'LANDING.FOOTER.SCROLL_TO_TOP' | translate"
            (click)="scrollToTop()"
          >
            <img src="assets/images/icons/scroll-up.svg" alt="" class="h-6 w-6 brightness-0 invert" />
          </button>
        </div>
      </div>
    </footer>
  `
})
export class FooterSectionComponent {
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly newsletter = inject(NewsletterService);
  readonly linkGroups = FOOTER_LINK_GROUPS;
  readonly partners = PARTNER_LOGOS;
  readonly partnerRows = this.chunkPartners(PARTNER_LOGOS, 4);
  readonly supportContacts = SUPPORT_CONTACTS;
  readonly socials = SOCIAL_LINKS;
  readonly currentYear = new Date().getFullYear();
  newsletterEmail = '';
  newsletterConsent = false;
  readonly newsletterSubmitting = signal(false);
  private readonly openDropdowns = signal<Set<string>>(new Set());

  async onNewsletterSubmit(event: Event): Promise<void> {
    event.preventDefault();
    const email = this.newsletterEmail.trim();
    if (!email) return;
    if (!this.newsletterConsent) {
      this.toast.error(this.translate.instant('LANDING.FOOTER.NEWSLETTER_CONSENT_REQUIRED'));
      return;
    }

    this.newsletterSubmitting.set(true);
    try {
      await this.newsletter.subscribe(email, this.newsletterConsent);
      this.toast.success(this.translate.instant('LANDING.FOOTER.NEWSLETTER_SUCCESS'));
      this.newsletterEmail = '';
      this.newsletterConsent = false;
    } catch (err) {
      this.toast.error(apiErrorMessage(err, this.translate.instant('LANDING.FOOTER.NEWSLETTER_ERROR')));
    } finally {
      this.newsletterSubmitting.set(false);
    }
  }

  private chunkPartners(partners: typeof PARTNER_LOGOS, rowSize: number): (typeof PARTNER_LOGOS)[] {
    const rows: (typeof PARTNER_LOGOS)[] = [];
    for (let index = 0; index < partners.length; index += rowSize) {
      rows.push(partners.slice(index, index + rowSize));
    }
    return rows;
  }

  onResourceLinkClick(event: Event, link: { label: string; href: string }): void {
    // These resource pages aren't built yet — without this, href="#" force-
    // scrolls the page to the top with no explanation, which reads as a
    // broken link rather than "coming soon".
    if (link.href === '#') {
      event.preventDefault();
      const label = this.translate.instant(link.label);
      this.toast.info(this.translate.instant('LANDING.FOOTER.COMING_SOON', { label }));
    }
  }

  isDropdownOpen(label: string): boolean {
    return this.openDropdowns().has(label);
  }

  toggleDropdown(label: string): void {
    this.openDropdowns.update((current) => {
      const next = new Set(current);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
