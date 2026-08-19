import { Component, OnInit, OnDestroy, computed, effect, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PublicPageShellComponent } from '../shared/components/public-page-shell/public-page-shell.component';
import { SearchFieldComponent } from '../shared/components/search-field/search-field.component';
import { FaqSection } from '../shared/models/faq.models';
import { CmsService } from '../shared/services/cms.service';
import { SeoService } from '../shared/services/seo.service';
import { PrimaryButtonComponent } from 'ui';

@Component({
    selector: 'app-faq-page',
    imports: [FormsModule, TranslatePipe, PublicPageShellComponent, SearchFieldComponent, PrimaryButtonComponent],
    template: `
    <app-public-page-shell variant="content" background="surface-muted" [topStrip]="true">
        <section class="page-container px-5 pb-6 pt-8 xl:px-20">
        <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div class="max-w-[846px]">
            <p class="text-base font-medium text-text-primary">{{ 'FAQ.HELP_CENTRE' | translate }}</p>
            <h1 class="mt-2 text-[clamp(1.75rem,4vw,32px)] font-semibold leading-tight text-text-primary">
              {{ 'FAQ.TITLE' | translate }}
            </h1>
            <p class="mt-2 text-base font-medium text-text-secondary">
              {{ 'FAQ.SUBTITLE' | translate }}
            </p>
          </div>

          <app-search-field
            class="w-full shrink-0 lg:w-80"
            [value]="searchQuery()"
            (valueChange)="searchQuery.set($event)"
            [placeholder]="'FAQ.SEARCH_PLACEHOLDER' | translate"
            [ariaLabel]="'FAQ.SEARCH_PLACEHOLDER' | translate"
            variant="inline"
            size="md"
            prefixIcon="search"
            [debounceMs]="150"
          />
        </div>
      </section>

      <section class="page-container px-5 pb-20 xl:px-20">
        <div class="flex flex-col gap-10 lg:flex-row lg:gap-16">
          <nav class="hidden w-[220px] shrink-0 lg:block" [attr.aria-label]="'FAQ.SECTIONS_NAV' | translate">
            @if (loading()) {
              <div class="space-y-4" aria-hidden="true">
                @for (item of skeletonItems; track item) {
                  <div class="h-5 rounded-full bg-border-light/70"></div>
                }
              </div>
            } @else {
              <ul class="space-y-4">
                @for (section of allSections(); track section.id) {
                  <li>
                    <button
                      type="button"
                      class="text-left text-base transition-colors"
                      [class.font-medium]="activeSection() === section.id"
                      [class.text-text-primary]="activeSection() === section.id"
                      [class.text-text-secondary]="activeSection() !== section.id"
                      [attr.aria-current]="activeSection() === section.id ? 'true' : null"
                      (click)="scrollToSection(section.id)"
                    >
                      {{ section.title }}
                    </button>
                  </li>
                }
              </ul>
            }
          </nav>

          <div class="min-w-0 flex-1">
            @if (loading()) {
              <div class="space-y-6" role="status" aria-live="polite" [attr.aria-label]="'FAQ.LOADING' | translate">
                @for (item of skeletonItems; track item) {
                  <div class="rounded-card border border-border bg-white p-6">
                    <div class="h-5 w-2/3 rounded-full bg-border-light/70"></div>
                    <div class="mt-4 h-4 w-full rounded-full bg-border-light/50"></div>
                    <div class="mt-2 h-4 w-4/5 rounded-full bg-border-light/50"></div>
                  </div>
                }
              </div>
            } @else if (error()) {
              <div class="flex flex-col items-center py-12 text-center">
                <p class="text-lg font-medium text-text-primary">{{ 'FAQ.ERROR_TITLE' | translate }}</p>
                <p class="mt-2 text-base text-text-secondary">{{ (error() ?? '') | translate }}</p>
                <button
                  type="button"
                  (click)="retry()"
                  class="mt-6 w-fit rounded-btn border border-primary px-5 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-white"
                >
                  {{ 'FAQ.TRY_AGAIN' | translate }}
                </button>
              </div>
            } @else if (filteredSections().length === 0) {
              <div class="py-12 text-center">
                <p class="text-lg font-medium text-text-primary">{{ 'FAQ.NO_RESULTS' | translate }}</p>
                <p class="mt-2 text-base text-text-secondary">{{ 'FAQ.NO_RESULTS_HINT' | translate }}</p>
              </div>
            } @else {
              <div class="mb-8 lg:hidden">
                <label for="faq-section-jump" class="mb-2 block text-sm font-medium text-text-secondary">
                  {{ 'FAQ.JUMP_TO_SECTION' | translate }}
                </label>
                <select
                  id="faq-section-jump"
                  class="h-11 w-full rounded-btn border border-border bg-white px-4 text-base text-text-primary"
                  [ngModel]="activeSection()"
                  (ngModelChange)="scrollToSection($event)"
                >
                  @for (section of allSections(); track section.id) {
                    <option [value]="section.id">{{ section.title }}</option>
                  }
                </select>
              </div>
              <div class="space-y-10">
                @for (section of filteredSections(); track section.id) {
                  <div [id]="'faq-' + section.id" class="scroll-mt-28">
                    <h2 class="text-3xl font-medium text-text-primary">{{ section.title }}</h2>

                    <div class="mt-4 border-t border-border">
                      @for (item of section.items; track item.id) {
                        <div class="border-b border-border">
                          <button
                            type="button"
                            class="flex w-full items-center justify-between gap-6 py-5 text-left"
                            [id]="questionId(item.id)"
                            [attr.aria-expanded]="isOpen(item.id)"
                            [attr.aria-controls]="answerId(item.id)"
                            (click)="toggleItem(item.id)"
                          >
                            <span class="text-base leading-relaxed text-text-primary">
                              {{ item.question }}
                            </span>
                            <svg
                              class="h-5 w-5 shrink-0 text-text-tertiary transition-transform"
                              [class.rotate-180]="isOpen(item.id)"
                              viewBox="0 0 24 24"
                              fill="none"
                              aria-hidden="true"
                            >
                              <path
                                d="M6 9l6 6 6-6"
                                stroke="currentColor"
                                stroke-width="1.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              />
                            </svg>
                          </button>

                          @if (isOpen(item.id)) {
                            <div
                              [id]="answerId(item.id)"
                              role="region"
                              [attr.aria-labelledby]="questionId(item.id)"
                              class="pb-5"
                            >
                              <p class="text-base leading-relaxed text-text-secondary">{{ item.answer }}</p>
                              @if (feedbackGiven().has(item.id)) {
                                <p class="mt-3 text-sm text-text-tertiary">{{ 'FAQ.FEEDBACK.THANKS' | translate }}</p>
                              } @else {
                                <div class="mt-3 flex items-center gap-3">
                                  <span class="text-sm text-text-tertiary">{{ 'FAQ.FEEDBACK.PROMPT' | translate }}</span>
                                  <button
                                    type="button"
                                    class="rounded-btn border border-border px-3 py-1 text-sm text-text-secondary transition-colors hover:border-primary hover:text-primary"
                                    (click)="submitFeedback(item.id, true)"
                                  >
                                    {{ 'FAQ.FEEDBACK.YES' | translate }}
                                  </button>
                                  <button
                                    type="button"
                                    class="rounded-btn border border-border px-3 py-1 text-sm text-text-secondary transition-colors hover:border-primary hover:text-primary"
                                    (click)="submitFeedback(item.id, false)"
                                  >
                                    {{ 'FAQ.FEEDBACK.NO' | translate }}
                                  </button>
                                </div>
                              }
                            </div>
                          }
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </section>

      <section class="page-container px-5 pb-20 xl:px-20">
        <div class="rounded-card border border-border bg-surface-muted p-8 text-center sm:p-10">
          <h2 class="text-2xl font-semibold text-text-primary">{{ 'FAQ.CONTACT_CTA.TITLE' | translate }}</h2>
          <p class="mx-auto mt-2 max-w-md text-base text-text-secondary">
            {{ 'FAQ.CONTACT_CTA.SUBTITLE' | translate }}
          </p>
          <app-primary-button
            class="mt-6 inline-flex"
            routerLink="/contact"
            [queryParams]="{ subject: 'General Inquiry' }"
          >
            {{ 'FAQ.CONTACT_CTA.BUTTON' | translate }}
          </app-primary-button>
        </div>
      </section>
    </app-public-page-shell>
  `
})
export class FaqPageComponent implements OnInit, OnDestroy {
  // Must be a signal (not a plain property) — filteredSections() is a
  // computed() that only re-runs when a signal dependency changes; a plain
  // property mutated via ngModel silently froze the filter at its initial value.
  readonly searchQuery = signal('');
  private readonly cms = inject(CmsService);
  private readonly seo = inject(SeoService);
  private readonly translate = inject(TranslateService);

  readonly allSections = signal<FaqSection[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly skeletonItems = [1, 2, 3, 4];

  private sectionObserver: IntersectionObserver | null = null;

  constructor() {
    this.load();
    // activeSection previously only changed on click (scrollToSection) and
    // desynced the moment the user scrolled manually — re-attach a scroll-spy
    // observer whenever the rendered section list changes.
    effect(() => {
      this.allSections();
      setTimeout(() => this.setupScrollSpy());
    });
    // When a search narrows the results to a single question, open it
    // automatically instead of making the user click through one more time.
    effect(() => {
      const query = this.searchQuery().trim();
      const sections = this.filteredSections();
      if (!query) return;
      const items = sections.flatMap((section) => section.items);
      if (items.length === 1) {
        this.openItems.update((current) => new Set(current).add(items[0].id));
      }
    });
  }

  private setupScrollSpy(): void {
    this.sectionObserver?.disconnect();
    const sections = this.allSections();
    if (!sections.length || typeof IntersectionObserver === 'undefined') return;

    this.sectionObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          this.activeSection.set(visible[0].target.id.replace(/^faq-/, ''));
        }
      },
      { rootMargin: '-112px 0px -70% 0px', threshold: 0 },
    );

    for (const section of sections) {
      const el = document.getElementById(`faq-${section.id}`);
      if (el) this.sectionObserver.observe(el);
    }
  }

  ngOnDestroy(): void {
    this.sectionObserver?.disconnect();
  }

  ngOnInit(): void {
    this.seo.set({
      title: this.translate.instant('FAQ.SEO_TITLE'),
      description: this.translate.instant('FAQ.SEO_DESCRIPTION'),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.cms.getFaqs().subscribe({
      next: (sections) => {
        this.allSections.set(sections as FaqSection[]);
        if (sections.length > 0) {
          this.activeSection.set(sections[0].id);
        }
        this.emitFaqJsonLd(sections as FaqSection[]);
        this.loading.set(false);
        setTimeout(() => this.applyDeepLinkFromHash());
      },
      error: () => {
        this.error.set('FAQ.LOAD_FAILED');
        this.loading.set(false);
      }
    });
  }

  retry(): void {
    this.load();
  }

  private emitFaqJsonLd(sections: FaqSection[]): void {
    const items = sections.flatMap((section) => section.items);
    if (items.length === 0) return;
    this.seo.setJsonLd({
      '@type': 'FAQPage',
      mainEntity: items.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    });
  }

  readonly activeSection = signal('general');
  private readonly openItems = signal<Set<string>>(new Set());

  readonly filteredSections = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) {
      return this.allSections();
    }

    return this.allSections()
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.question.toLowerCase().includes(query) ||
            item.answer.toLowerCase().includes(query),
        ),
      }))
      .filter((section) => section.items.length > 0);
  });

  isOpen(id: string): boolean {
    return this.openItems().has(id);
  }

  readonly feedbackGiven = signal<Set<string>>(new Set());

  submitFeedback(itemId: string, helpful: boolean): void {
    // Optimistic — mark as answered immediately so a slow/failed request
    // doesn't leave the buttons sitting there inviting a second click.
    this.feedbackGiven.update((current) => new Set(current).add(itemId));
    this.cms.submitFaqFeedback(itemId, helpful).subscribe({ error: () => {} });
  }

  toggleItem(id: string): void {
    this.openItems.update((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        this.updateHash(this.questionId(id));
      }
      return next;
    });
  }

  scrollToSection(id: string): void {
    this.activeSection.set(id);
    document.getElementById(`faq-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.updateHash(`faq-${id}`);
  }

  questionId(itemId: string): string {
    return `faq-question-${itemId}`;
  }

  answerId(itemId: string): string {
    return `faq-answer-${itemId}`;
  }

  /** Honors /faq#faq-<sectionId> and /faq#faq-question-<itemId> on load. */
  private applyDeepLinkFromHash(): void {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;

    const questionMatch = hash.match(/^faq-question-(.+)$/);
    if (questionMatch) {
      const itemId = questionMatch[1];
      const section = this.allSections().find((s) => s.items.some((item) => item.id === itemId));
      if (!section) return;
      this.activeSection.set(section.id);
      this.openItems.update((current) => new Set(current).add(itemId));
      setTimeout(() =>
        document.getElementById(this.questionId(itemId))?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
      return;
    }

    const sectionMatch = hash.match(/^faq-(.+)$/);
    const sectionId = sectionMatch?.[1];
    if (sectionId && this.allSections().some((s) => s.id === sectionId)) {
      this.scrollToSection(sectionId);
    }
  }

  private updateHash(hash: string): void {
    if (typeof window === 'undefined' || typeof history === 'undefined') return;
    history.replaceState(null, '', `#${hash}`);
  }
}
