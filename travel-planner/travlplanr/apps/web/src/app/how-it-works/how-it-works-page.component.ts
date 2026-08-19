import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicPageShellComponent } from '../shared/components/public-page-shell/public-page-shell.component';
import { FaqItem } from '../shared/models/faq.models';
import { CmsService } from '../shared/services/cms.service';
import { SeoService } from '../shared/services/seo.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-how-it-works-page',
    imports: [
        RouterLink,
        PublicPageShellComponent,
        TranslatePipe,
    ],
    template: `
    <app-public-page-shell variant="hero">
      <!-- Hero -->
      <section class="hero-gradient-dark relative flex min-h-[580px] w-full items-end justify-center overflow-hidden pb-20 pt-[73px]">
        <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div class="absolute -right-40 -top-40 h-[600px] w-[600px] rounded-full opacity-10" style="background:radial-gradient(circle,#ffffff 0%,transparent 70%)"></div>
          <div class="absolute -bottom-32 -left-32 h-[500px] w-[500px] rounded-full opacity-10" style="background:radial-gradient(circle,#60a5fa 0%,transparent 70%)"></div>
        </div>
        <div class="section-container relative z-10 text-center">
          <span class="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-400/40 bg-white/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-widest text-blue-200 backdrop-blur-sm">
            {{ 'HOW_IT_WORKS.HERO.BADGE' | translate }}
          </span>
          <h1 class="mt-4 text-5xl font-bold leading-tight tracking-tight text-white md:text-6xl lg:text-[72px]">
            {{ 'HOW_IT_WORKS.HERO.TITLE' | translate }}
          </h1>
          <p class="mx-auto mt-6 max-w-2xl text-xl font-normal leading-relaxed text-blue-100">
            {{ 'HOW_IT_WORKS.HERO.SUBTITLE' | translate }}
          </p>
          <div class="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a routerLink="/wizard" class="inline-flex h-14 items-center justify-center rounded-full bg-white px-8 text-base font-bold text-primary shadow-2xl transition-all duration-300 hover:scale-105 no-underline">
              {{ 'HOW_IT_WORKS.HERO.CTA_PRIMARY' | translate }}
            </a>
            <a routerLink="/explore" class="inline-flex h-14 items-center justify-center rounded-full border-2 border-white/30 px-8 text-base font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:border-white/60 hover:bg-white/10 no-underline">
              {{ 'HOW_IT_WORKS.HERO.CTA_SECONDARY' | translate }}
            </a>
          </div>
          <div class="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-3 sm:divide-x sm:divide-white/20">
            @for (stat of heroStats; track stat.label) {
              <div class="px-2">
                <p class="text-2xl font-extrabold text-white sm:text-4xl">{{ stat.value | translate }}</p>
                <p class="mt-1 text-sm font-medium text-blue-200">{{ stat.label | translate }}</p>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- 3-Step Guide -->
      <section class="bg-white py-24">
        <div class="section-container">
          <div class="mb-16 text-center">
            <p class="mb-3 text-sm font-bold uppercase tracking-widest text-primary">{{ 'HOW_IT_WORKS.STEPS.EYEBROW' | translate }}</p>
            <h2 class="text-4xl font-bold text-text-primary md:text-5xl">{{ 'HOW_IT_WORKS.STEPS.HEADING' | translate }}</h2>
            <p class="mx-auto mt-4 max-w-xl text-lg text-text-secondary">{{ 'HOW_IT_WORKS.STEPS.SUBHEADING' | translate }}</p>
          </div>
          <div class="space-y-6">

            <!-- Step 1 -->
            <div class="group relative overflow-hidden rounded-3xl border border-border-light bg-surface-muted p-8 transition-all duration-300 hover:border-primary/20 hover:shadow-xl md:p-12">
              <div class="absolute right-8 top-8 text-8xl font-black text-border-light select-none md:text-[160px]" aria-hidden="true">01</div>
              <div class="relative z-10 grid gap-10 md:grid-cols-2 md:items-center">
                <div>
                  <div class="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E5E4FF] text-2xl shadow-sm">🎯</div>
                  <span class="mb-2 block text-xs font-bold uppercase tracking-widest text-primary">{{ 'HOW_IT_WORKS.STEPS.STEP1.LABEL' | translate }}</span>
                  <h3 class="text-3xl font-bold text-text-primary">{{ 'HOW_IT_WORKS.STEPS.STEP1.TITLE' | translate }}</h3>
                  <p class="mt-4 text-lg leading-relaxed text-text-secondary">{{ 'HOW_IT_WORKS.STEPS.STEP1.DESCRIPTION' | translate }}</p>
                  <div class="mt-6 space-y-3">
                    @for (highlight of stepHighlights[0]; track highlight) {
                      <div class="flex items-start gap-3">
                        <div [class]="checkIconClass(0)"><svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></div>
                        <p class="text-text-primary">{{ highlight | translate }}</p>
                      </div>
                    }
                  </div>
                </div>
                <div class="flex flex-col gap-3">
                  <div class="rounded-2xl border border-border bg-white p-5 shadow-sm">
                    <p class="mb-3 text-xs font-bold uppercase tracking-widest text-text-tertiary">{{ 'HOW_IT_WORKS.STEPS.STEP1.MOCK.WHERE_TO_LABEL' | translate }}</p>
                    <div class="flex items-center gap-3 rounded-xl bg-primary/5 px-4 py-3">
                      <span class="text-xl">🌏</span>
                      <div><p class="font-semibold text-text-primary">{{ 'HOW_IT_WORKS.STEPS.STEP1.MOCK.DESTINATION' | translate }}</p><p class="text-xs text-text-secondary">{{ 'HOW_IT_WORKS.STEPS.STEP1.MOCK.DATES' | translate }}</p></div>
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div class="rounded-2xl border border-border bg-white p-4 shadow-sm text-center"><p class="text-2xl">🧳</p><p class="mt-1 text-sm font-semibold text-text-primary">{{ 'HOW_IT_WORKS.STEPS.STEP1.MOCK.TRAVEL_TYPE' | translate }}</p></div>
                    <div class="rounded-2xl border border-border bg-white p-4 shadow-sm text-center"><p class="text-2xl">💰</p><p class="mt-1 text-sm font-semibold text-text-primary">{{ 'HOW_IT_WORKS.STEPS.STEP1.MOCK.BUDGET' | translate }}</p></div>
                    <div class="rounded-2xl border border-border bg-white p-4 shadow-sm text-center"><p class="text-2xl">🏄</p><p class="mt-1 text-sm font-semibold text-text-primary">{{ 'HOW_IT_WORKS.STEPS.STEP1.MOCK.STYLE' | translate }}</p></div>
                    <div class="rounded-2xl border border-border bg-white p-4 shadow-sm text-center"><p class="text-2xl">🍜</p><p class="mt-1 text-sm font-semibold text-text-primary">{{ 'HOW_IT_WORKS.STEPS.STEP1.MOCK.INTEREST' | translate }}</p></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 2 -->
            <div class="group relative overflow-hidden rounded-3xl border border-border-light bg-surface-muted p-8 transition-all duration-300 hover:border-primary/20 hover:shadow-xl md:p-12">
              <div class="absolute right-8 top-8 text-8xl font-black text-border-light select-none md:text-[160px]" aria-hidden="true">02</div>
              <div class="relative z-10 grid gap-10 md:grid-cols-2 md:items-center">
                <div class="md:order-2">
                  <div class="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E9F3FF] text-2xl shadow-sm">⚡</div>
                  <span class="mb-2 block text-xs font-bold uppercase tracking-widest text-primary">{{ 'HOW_IT_WORKS.STEPS.STEP2.LABEL' | translate }}</span>
                  <h3 class="text-3xl font-bold text-text-primary">{{ 'HOW_IT_WORKS.STEPS.STEP2.TITLE' | translate }}</h3>
                  <p class="mt-4 text-lg leading-relaxed text-text-secondary">{{ 'HOW_IT_WORKS.STEPS.STEP2.DESCRIPTION' | translate }}</p>
                  <div class="mt-6 space-y-3">
                    @for (highlight of stepHighlights[1]; track highlight) {
                      <div class="flex items-start gap-3">
                        <div [class]="checkIconClass(1)"><svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></div>
                        <p class="text-text-primary">{{ highlight | translate }}</p>
                      </div>
                    }
                  </div>
                </div>
                <div class="md:order-1">
                  <div class="rounded-2xl border border-border bg-white p-5 shadow-sm">
                    <div class="mb-3 flex items-center gap-2">
                      <div class="h-2 w-2 rounded-full bg-green-400 animate-pulse"></div>
                      <p class="text-xs font-bold text-text-secondary">{{ 'HOW_IT_WORKS.STEPS.STEP2.MOCK.GENERATING' | translate }}</p>
                    </div>
                    <div class="space-y-3">
                      <div class="rounded-xl bg-blue-50 border border-blue-100 p-4">
                        <p class="text-xs font-bold uppercase tracking-wider text-blue-600">{{ 'HOW_IT_WORKS.STEPS.STEP2.MOCK.DAY1_LABEL' | translate }}</p>
                        <p class="mt-1 font-semibold text-text-primary">{{ 'HOW_IT_WORKS.STEPS.STEP2.MOCK.DAY1_TITLE' | translate }}</p>
                        <p class="mt-0.5 text-sm text-text-secondary">{{ 'HOW_IT_WORKS.STEPS.STEP2.MOCK.DAY1_DETAIL' | translate }}</p>
                      </div>
                      <div class="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
                        <p class="text-xs font-bold uppercase tracking-wider text-indigo-600">{{ 'HOW_IT_WORKS.STEPS.STEP2.MOCK.DAY2_LABEL' | translate }}</p>
                        <p class="mt-1 font-semibold text-text-primary">{{ 'HOW_IT_WORKS.STEPS.STEP2.MOCK.DAY2_TITLE' | translate }}</p>
                        <p class="mt-0.5 text-sm text-text-secondary">{{ 'HOW_IT_WORKS.STEPS.STEP2.MOCK.DAY2_DETAIL' | translate }}</p>
                      </div>
                      <div class="rounded-xl bg-violet-50 border border-violet-100 p-4">
                        <p class="text-xs font-bold uppercase tracking-wider text-violet-600">{{ 'HOW_IT_WORKS.STEPS.STEP2.MOCK.DAY3_LABEL' | translate }}</p>
                        <p class="mt-1 font-semibold text-text-primary">{{ 'HOW_IT_WORKS.STEPS.STEP2.MOCK.DAY3_TITLE' | translate }}</p>
                        <p class="mt-0.5 text-sm text-text-secondary">{{ 'HOW_IT_WORKS.STEPS.STEP2.MOCK.DAY3_DETAIL' | translate }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 3 -->
            <div class="group relative overflow-hidden rounded-3xl border border-border-light bg-surface-muted p-8 transition-all duration-300 hover:border-primary/20 hover:shadow-xl md:p-12">
              <div class="absolute right-8 top-8 text-8xl font-black text-border-light select-none md:text-[160px]" aria-hidden="true">03</div>
              <div class="relative z-10 grid gap-10 md:grid-cols-2 md:items-center">
                <div>
                  <div class="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFF5D8] text-2xl shadow-sm">✏️</div>
                  <span class="mb-2 block text-xs font-bold uppercase tracking-widest text-primary">{{ 'HOW_IT_WORKS.STEPS.STEP3.LABEL' | translate }}</span>
                  <h3 class="text-3xl font-bold text-text-primary">{{ 'HOW_IT_WORKS.STEPS.STEP3.TITLE' | translate }}</h3>
                  <p class="mt-4 text-lg leading-relaxed text-text-secondary">{{ 'HOW_IT_WORKS.STEPS.STEP3.DESCRIPTION' | translate }}</p>
                  <div class="mt-6 space-y-3">
                    @for (highlight of stepHighlights[2]; track highlight) {
                      <div class="flex items-start gap-3">
                        <div [class]="checkIconClass(2)"><svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></div>
                        <p class="text-text-primary">{{ highlight | translate }}</p>
                      </div>
                    }
                  </div>
                </div>
                <div>
                  <div class="rounded-2xl border border-border bg-white p-5 shadow-sm">
                    <p class="mb-3 text-xs font-bold uppercase tracking-widest text-text-tertiary">{{ 'HOW_IT_WORKS.STEPS.STEP3.MOCK.HEADING' | translate }}</p>
                    <div class="space-y-3">
                      <div class="flex items-center justify-between rounded-xl border border-border-light bg-surface-muted p-4">
                        <div class="flex items-center gap-3">
                          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white text-xs font-black">B.</div>
                          <div><p class="font-semibold text-text-primary text-sm">{{ 'HOW_IT_WORKS.STEPS.STEP3.MOCK.ITEM1_TITLE' | translate }}</p><p class="text-xs text-text-secondary">{{ 'HOW_IT_WORKS.STEPS.STEP3.MOCK.ITEM1_DETAIL' | translate }}</p></div>
                        </div>
                        <div class="rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">{{ 'HOW_IT_WORKS.STEPS.STEP3.MOCK.BOOK_CTA' | translate }}</div>
                      </div>
                      <div class="flex items-center justify-between rounded-xl border border-border-light bg-surface-muted p-4">
                        <div class="flex items-center gap-3">
                          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500 text-white text-xs font-black">✈</div>
                          <div><p class="font-semibold text-text-primary text-sm">{{ 'HOW_IT_WORKS.STEPS.STEP3.MOCK.ITEM2_TITLE' | translate }}</p><p class="text-xs text-text-secondary">{{ 'HOW_IT_WORKS.STEPS.STEP3.MOCK.ITEM2_DETAIL' | translate }}</p></div>
                        </div>
                        <div class="rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">{{ 'HOW_IT_WORKS.STEPS.STEP3.MOCK.BOOK_CTA' | translate }}</div>
                      </div>
                      <div class="flex items-center justify-between rounded-xl border border-border-light bg-surface-muted p-4">
                        <div class="flex items-center gap-3">
                          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600 text-white text-xs font-black">V</div>
                          <div><p class="font-semibold text-text-primary text-sm">{{ 'HOW_IT_WORKS.STEPS.STEP3.MOCK.ITEM3_TITLE' | translate }}</p><p class="text-xs text-text-secondary">{{ 'HOW_IT_WORKS.STEPS.STEP3.MOCK.ITEM3_DETAIL' | translate }}</p></div>
                        </div>
                        <div class="rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">{{ 'HOW_IT_WORKS.STEPS.STEP3.MOCK.BOOK_CTA' | translate }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      <!-- AI Deep-Dive -->
      <section class="bg-dark py-24">
        <div class="section-container">
          <div class="mb-16 text-center">
            <p class="mb-3 text-sm font-bold uppercase tracking-widest text-blue-400">{{ 'HOW_IT_WORKS.AI.EYEBROW' | translate }}</p>
            <h2 class="text-4xl font-bold text-white md:text-5xl">{{ 'HOW_IT_WORKS.AI.HEADING' | translate }}</h2>
            <p class="mx-auto mt-4 max-w-2xl text-lg text-blue-100">{{ 'HOW_IT_WORKS.AI.SUBHEADING' | translate }}</p>
          </div>
          <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            @for (capability of aiCapabilities; track capability.title) {
              <div class="rounded-2xl border border-white/10 bg-white/5 p-7 backdrop-blur-sm transition-all duration-300 hover:border-blue-500/40 hover:bg-white/10">
                <div [class]="'mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-2xl ' + capability.iconBg">{{ capability.icon }}</div>
                <h3 class="text-xl font-bold text-white">{{ capability.title | translate }}</h3>
                <p class="mt-3 text-blue-100 leading-relaxed">{{ capability.description | translate }}</p>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- Platform Features -->
      <section class="bg-white py-24">
        <div class="section-container">
          <div class="mb-16 text-center">
            <p class="mb-3 text-sm font-bold uppercase tracking-widest text-primary">{{ 'HOW_IT_WORKS.FEATURES.EYEBROW' | translate }}</p>
            <h2 class="text-4xl font-bold text-text-primary md:text-5xl">{{ 'HOW_IT_WORKS.FEATURES.HEADING' | translate }}</h2>
            <p class="mx-auto mt-4 max-w-xl text-lg text-text-secondary">{{ 'HOW_IT_WORKS.FEATURES.SUBHEADING' | translate }}</p>
          </div>
          <div class="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            @for (feature of platformFeatures; track feature.title) {
              <div class="flex gap-5">
                <div [class]="'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl ' + feature.iconBg">{{ feature.icon }}</div>
                <div>
                  <h4 class="text-lg font-bold text-text-primary">{{ feature.title | translate }}</h4>
                  <p class="mt-2 text-text-secondary leading-relaxed">{{ feature.description | translate }}</p>
                </div>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- Trusted Partners -->
      <section class="bg-surface-muted py-20">
        <div class="section-container">
          <div class="mb-12 text-center">
            <p class="mb-3 text-sm font-bold uppercase tracking-widest text-primary">{{ 'HOW_IT_WORKS.PARTNERS.EYEBROW' | translate }}</p>
            <h2 class="text-3xl font-bold text-text-primary md:text-4xl">{{ 'HOW_IT_WORKS.PARTNERS.HEADING' | translate }}</h2>
            <p class="mx-auto mt-4 max-w-xl text-text-secondary">{{ 'HOW_IT_WORKS.PARTNERS.SUBHEADING' | translate }}</p>
          </div>
          <div class="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
            @for (partner of partnerCards; track partner.title) {
              <div class="flex items-start gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 duration-200">
                <div [class]="'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white ' + partner.iconClass">{{ partner.icon }}</div>
                <div>
                  <p class="font-bold text-text-primary">{{ partner.title | translate }}</p>
                  <p class="mt-1 text-sm text-text-secondary">{{ partner.description | translate }}</p>
                </div>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- FAQ -->
      <section class="bg-white py-24">
        <div class="section-container">
          <div class="mb-14 text-center">
            <p class="mb-3 text-sm font-bold uppercase tracking-widest text-primary">{{ 'HOW_IT_WORKS.FAQ.EYEBROW' | translate }}</p>
            <h2 class="text-4xl font-bold text-text-primary md:text-5xl">{{ 'HOW_IT_WORKS.FAQ.HEADING' | translate }}</h2>
          </div>
          <div class="mx-auto max-w-3xl space-y-4">
            @if (faqLoading()) {
              @for (item of faqSkeletonItems; track item) {
                <div class="rounded-2xl border border-border bg-surface-muted px-7 py-5" aria-hidden="true">
                  <div class="h-5 w-3/4 rounded-full bg-border-light"></div>
                  <div class="mt-4 h-4 w-full rounded-full bg-border-light/80"></div>
                </div>
              }
            } @else {
              @for (item of faqPreview(); track item.id) {
                <details class="group rounded-2xl border border-border bg-surface-muted px-7 py-5 cursor-pointer transition-all duration-200 open:border-primary/30 open:bg-blue-50">
                  <summary class="flex items-center justify-between gap-6 text-lg font-semibold text-text-primary list-none">
                    {{ item.question }}
                    <svg class="h-5 w-5 shrink-0 text-text-tertiary transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                  </summary>
                  <p class="mt-4 text-text-secondary leading-relaxed">{{ item.answer }}</p>
                </details>
              } @empty {
                <div class="rounded-2xl border border-border bg-surface-muted px-7 py-5 text-center text-text-secondary">
                  {{ 'HOW_IT_WORKS.FAQ.EMPTY' | translate }}
                </div>
              }
            }
          </div>
          <div class="mt-10 text-center">
            <a routerLink="/faq" class="inline-flex items-center gap-2 text-base font-semibold text-primary no-underline hover:underline">
              {{ 'HOW_IT_WORKS.FAQ.VIEW_ALL' | translate }}
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
            </a>
          </div>
        </div>
      </section>

      <!-- Final CTA -->
      <section class="hero-gradient-dark relative overflow-hidden py-28">
        <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div class="absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full opacity-10" style="background:radial-gradient(circle,#ffffff 0%,transparent 70%)"></div>
          <div class="absolute -bottom-24 -left-24 h-[400px] w-[400px] rounded-full opacity-10" style="background:radial-gradient(circle,#60a5fa 0%,transparent 70%)"></div>
        </div>
        <div class="section-container relative z-10 text-center">
          <span class="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-400/40 bg-white/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-widest text-blue-200 backdrop-blur-sm">{{ 'HOW_IT_WORKS.CTA.BADGE' | translate }}</span>
          <h2 class="text-4xl font-bold text-white md:text-5xl lg:text-6xl">{{ 'HOW_IT_WORKS.CTA.TITLE_LINE1' | translate }}<br class="hidden md:block" /> {{ 'HOW_IT_WORKS.CTA.TITLE_LINE2' | translate }}</h2>
          <p class="mx-auto mt-6 max-w-xl text-xl text-blue-100">{{ 'HOW_IT_WORKS.CTA.SUBTITLE' | translate }}</p>
          <div class="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a routerLink="/wizard" class="inline-flex h-14 items-center justify-center rounded-full bg-white px-8 text-base font-bold text-primary shadow-2xl transition-all duration-300 hover:scale-105 no-underline">
              {{ 'HOW_IT_WORKS.CTA.CTA_PRIMARY' | translate }}
            </a>
            <a routerLink="/explore" class="inline-flex h-14 items-center justify-center rounded-full border-2 border-white/30 px-8 text-base font-semibold text-white transition-all duration-300 hover:border-white/60 hover:bg-white/10 no-underline">
              {{ 'HOW_IT_WORKS.CTA.CTA_SECONDARY' | translate }}
            </a>
          </div>
        </div>
      </section>

    </app-public-page-shell>
  `,
    styles: [`
    details > summary::-webkit-details-marker { display: none; }
    details > summary { user-select: none; }
  `]
})
export class HowItWorksPageComponent implements OnInit {
  private readonly seo = inject(SeoService);
  private readonly cms = inject(CmsService);
  private readonly translate = inject(TranslateService);
  readonly faqPreview = signal<FaqItem[]>([]);
  readonly faqLoading = signal(true);
  readonly faqSkeletonItems = [1, 2, 3];

  readonly heroStats = [
    { value: 'HOW_IT_WORKS.HERO.STATS.GUIDED.VALUE', label: 'HOW_IT_WORKS.HERO.STATS.GUIDED.LABEL' },
    { value: 'HOW_IT_WORKS.HERO.STATS.EDITABLE.VALUE', label: 'HOW_IT_WORKS.HERO.STATS.EDITABLE.LABEL' },
    { value: 'HOW_IT_WORKS.HERO.STATS.DIRECT.VALUE', label: 'HOW_IT_WORKS.HERO.STATS.DIRECT.LABEL' },
  ];

  readonly stepHighlights = [
    [
      'HOW_IT_WORKS.STEPS.STEP1.HIGHLIGHTS.ITEM1',
      'HOW_IT_WORKS.STEPS.STEP1.HIGHLIGHTS.ITEM2',
      'HOW_IT_WORKS.STEPS.STEP1.HIGHLIGHTS.ITEM3',
      'HOW_IT_WORKS.STEPS.STEP1.HIGHLIGHTS.ITEM4',
    ],
    [
      'HOW_IT_WORKS.STEPS.STEP2.HIGHLIGHTS.ITEM1',
      'HOW_IT_WORKS.STEPS.STEP2.HIGHLIGHTS.ITEM2',
      'HOW_IT_WORKS.STEPS.STEP2.HIGHLIGHTS.ITEM3',
      'HOW_IT_WORKS.STEPS.STEP2.HIGHLIGHTS.ITEM4',
    ],
    [
      'HOW_IT_WORKS.STEPS.STEP3.HIGHLIGHTS.ITEM1',
      'HOW_IT_WORKS.STEPS.STEP3.HIGHLIGHTS.ITEM2',
      'HOW_IT_WORKS.STEPS.STEP3.HIGHLIGHTS.ITEM3',
      'HOW_IT_WORKS.STEPS.STEP3.HIGHLIGHTS.ITEM4',
    ],
  ];

  readonly aiCapabilities = [
    {
      icon: '🧠',
      iconBg: 'bg-blue-500/20',
      title: 'HOW_IT_WORKS.AI.CAPABILITIES.PREFERENCE_MATCHING.TITLE',
      description: 'HOW_IT_WORKS.AI.CAPABILITIES.PREFERENCE_MATCHING.DESCRIPTION',
    },
    {
      icon: '🗺️',
      iconBg: 'bg-indigo-500/20',
      title: 'HOW_IT_WORKS.AI.CAPABILITIES.ROUTE_AWARE_PLANNING.TITLE',
      description: 'HOW_IT_WORKS.AI.CAPABILITIES.ROUTE_AWARE_PLANNING.DESCRIPTION',
    },
    {
      icon: '💸',
      iconBg: 'bg-violet-500/20',
      title: 'HOW_IT_WORKS.AI.CAPABILITIES.BUDGET_AWARENESS.TITLE',
      description: 'HOW_IT_WORKS.AI.CAPABILITIES.BUDGET_AWARENESS.DESCRIPTION',
    },
    {
      icon: '🔄',
      iconBg: 'bg-cyan-500/20',
      title: 'HOW_IT_WORKS.AI.CAPABILITIES.EDITABLE_REPLANNING.TITLE',
      description: 'HOW_IT_WORKS.AI.CAPABILITIES.EDITABLE_REPLANNING.DESCRIPTION',
    },
    {
      icon: '🚆',
      iconBg: 'bg-emerald-500/20',
      title: 'HOW_IT_WORKS.AI.CAPABILITIES.INTERCITY_TRANSFERS.TITLE',
      description: 'HOW_IT_WORKS.AI.CAPABILITIES.INTERCITY_TRANSFERS.DESCRIPTION',
    },
    {
      icon: '🏡',
      iconBg: 'bg-rose-500/20',
      title: 'HOW_IT_WORKS.AI.CAPABILITIES.LOCAL_CONTEXT.TITLE',
      description: 'HOW_IT_WORKS.AI.CAPABILITIES.LOCAL_CONTEXT.DESCRIPTION',
    },
  ];

  readonly platformFeatures = [
    {
      icon: '✏️',
      iconBg: 'bg-blue-50',
      title: 'HOW_IT_WORKS.FEATURES.ITEMS.EDITABLE_ITINERARIES.TITLE',
      description: 'HOW_IT_WORKS.FEATURES.ITEMS.EDITABLE_ITINERARIES.DESCRIPTION',
    },
    {
      icon: '🌍',
      iconBg: 'bg-indigo-50',
      title: 'HOW_IT_WORKS.FEATURES.ITEMS.DESTINATION_PLANNING.TITLE',
      description: 'HOW_IT_WORKS.FEATURES.ITEMS.DESTINATION_PLANNING.DESCRIPTION',
    },
    {
      icon: '👥',
      iconBg: 'bg-violet-50',
      title: 'HOW_IT_WORKS.FEATURES.ITEMS.COLLABORATIVE_PLANNING.TITLE',
      description: 'HOW_IT_WORKS.FEATURES.ITEMS.COLLABORATIVE_PLANNING.DESCRIPTION',
    },
    {
      icon: '🤖',
      iconBg: 'bg-amber-50',
      title: 'HOW_IT_WORKS.FEATURES.ITEMS.AI_CHATBOT.TITLE',
      description: 'HOW_IT_WORKS.FEATURES.ITEMS.AI_CHATBOT.DESCRIPTION',
    },
    {
      icon: '📦',
      iconBg: 'bg-cyan-50',
      title: 'HOW_IT_WORKS.FEATURES.ITEMS.READY_MADE_PACKAGES.TITLE',
      description: 'HOW_IT_WORKS.FEATURES.ITEMS.READY_MADE_PACKAGES.DESCRIPTION',
    },
    {
      icon: '✉️',
      iconBg: 'bg-rose-50',
      title: 'HOW_IT_WORKS.FEATURES.ITEMS.EMAIL_SUPPORT.TITLE',
      description: 'HOW_IT_WORKS.FEATURES.ITEMS.EMAIL_SUPPORT.DESCRIPTION',
    },
  ];

  readonly partnerCards = [
    {
      icon: 'T',
      iconClass: 'bg-sky-600 text-lg font-black',
      title: 'HOW_IT_WORKS.PARTNERS.ITEMS.TRAVELNEXT.TITLE',
      description: 'HOW_IT_WORKS.PARTNERS.ITEMS.TRAVELNEXT.DESCRIPTION',
    },
    {
      icon: '📍',
      iconClass: 'bg-red-500 text-xl',
      title: 'HOW_IT_WORKS.PARTNERS.ITEMS.GOOGLE_MAPS.TITLE',
      description: 'HOW_IT_WORKS.PARTNERS.ITEMS.GOOGLE_MAPS.DESCRIPTION',
    },
    {
      icon: '⭐',
      iconClass: 'bg-emerald-600 text-xl',
      title: 'HOW_IT_WORKS.PARTNERS.ITEMS.TRIPADVISOR.TITLE',
      description: 'HOW_IT_WORKS.PARTNERS.ITEMS.TRIPADVISOR.DESCRIPTION',
    },
  ];

  ngOnInit(): void {
    this.seo.set({
      title: this.translate.instant('HOW_IT_WORKS.SEO.TITLE'),
      description: this.translate.instant('HOW_IT_WORKS.SEO.DESCRIPTION'),
    });
    this.emitHowToJsonLd();
    this.loadFaqPreview();
  }

  private emitHowToJsonLd(): void {
    const stepKeys = ['STEP1', 'STEP2', 'STEP3'];
    this.seo.setJsonLd({
      '@type': 'HowTo',
      name: this.translate.instant('HOW_IT_WORKS.HERO.TITLE'),
      description: this.translate.instant('HOW_IT_WORKS.HERO.SUBTITLE'),
      step: stepKeys.map((key, index) => ({
        '@type': 'HowToStep',
        position: index + 1,
        name: this.translate.instant(`HOW_IT_WORKS.STEPS.${key}.TITLE`),
        text: this.translate.instant(`HOW_IT_WORKS.STEPS.${key}.DESCRIPTION`),
      })),
    });
  }

  checkIconClass(stepIndex: number): string {
    const tones = [
      'bg-green-100 text-green-600',
      'bg-blue-100 text-blue-600',
      'bg-amber-100 text-amber-600',
    ];
    return `mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${tones[stepIndex]}`;
  }

  private loadFaqPreview(): void {
    this.faqLoading.set(true);
    this.cms.getFaqs().subscribe({
      next: (sections) => {
        this.faqPreview.set(sections.flatMap((section) => section.items).slice(0, 6));
        this.faqLoading.set(false);
      },
      error: () => {
        this.faqPreview.set([]);
        this.faqLoading.set(false);
      },
    });
  }
}

