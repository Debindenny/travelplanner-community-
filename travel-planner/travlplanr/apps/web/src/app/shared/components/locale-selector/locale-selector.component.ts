import { Component, inject, signal, HostListener, ElementRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LocaleService, SupportedLanguage, SupportedCurrency, LANGUAGE_LABELS, CURRENCY_FLAGS } from '../../../core/services/locale.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-locale-selector',
    imports: [CommonModule, TranslatePipe],
    template: `
    <div class="relative" (click)="$event.stopPropagation()">
      <button
        type="button"
        class="flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1.5 transition-colors xl:gap-2 xl:px-3"
        [ngClass]="lightChrome ? 'border-white/30 text-white hover:bg-white/10' : 'border-border text-text-primary hover:bg-black/5'"
        (click)="toggleMenu()"
        [attr.aria-label]="'LOCALE.CHANGE_LANGUAGE_CURRENCY' | translate"
      >
        <span class="text-base leading-none" aria-hidden="true">{{ currentLangIcon() }}</span>
        <span class="text-xs font-medium xl:text-sm">
          @if (compact) {
            {{ currentLang() | uppercase }}
          } @else {
            <span class="xl:hidden">{{ currentLang() | uppercase }}</span>
            <span class="hidden xl:inline">{{ currentLang() | uppercase }} / {{ currentCurrency() }}</span>
          }
        </span>
      </button>

      @if (isOpen()) {
        <div class="absolute right-0 top-full mt-2 w-64 rounded-xl border border-border bg-white p-4 shadow-xl z-50">
          
          <!-- Language Section -->
          <div class="mb-4">
            <h4 class="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
              {{ 'LOCALE.LANGUAGE' | translate }}
            </h4>
            <div class="grid grid-cols-1 gap-1">
              @for (lang of languages; track lang.code) {
                <button
                  type="button"
                  class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-black/5"
                  [class.bg-black_5]="currentLang() === lang.code"
                  [class.font-medium]="currentLang() === lang.code"
                  (click)="setLanguage(lang.code)"
                >
                  <div class="flex items-center gap-2 text-text-primary">
                    <span>{{ lang.icon }}</span>
                    <span>{{ lang.label }}</span>
                  </div>
                  @if (currentLang() === lang.code) {
                    <svg class="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  }
                </button>
              }
            </div>
          </div>

          <!-- Currency Section -->
          <div>
            <h4 class="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
              {{ 'LOCALE.CURRENCY' | translate }}
            </h4>
            <div class="grid grid-cols-1 gap-1">
              @for (cur of currencies; track cur) {
                <button
                  type="button"
                  class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-black/5"
                  [class.bg-black_5]="currentCurrency() === cur"
                  [class.font-medium]="currentCurrency() === cur"
                  (click)="setCurrency(cur)"
                >
                  <div class="flex items-center gap-2 text-text-primary">
                    <span>{{ currencyIcon(cur) }}</span>
                    <span>{{ cur }}</span>
                  </div>
                  @if (currentCurrency() === cur) {
                    <svg class="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  }
                </button>
              }
            </div>
          </div>

        </div>
      }
    </div>
  `,
    styles: [`
    .bg-black_5 { background-color: rgba(0,0,0,0.05); }
  `]
})
export class LocaleSelectorComponent {
  readonly localeService = inject(LocaleService);
  private readonly translate = inject(TranslateService);
  private readonly elementRef = inject(ElementRef);

  @Input() lightChrome = false;
  @Input() compact = false;
  
  readonly isOpen = signal(false);

  readonly languages = (Object.keys(LANGUAGE_LABELS) as SupportedLanguage[]).map(code => ({
    code,
    ...LANGUAGE_LABELS[code]
  }));
  readonly currencies: SupportedCurrency[] = ['USD', 'EUR', 'INR'];

  constructor() {
    this.translate.setFallbackLang('en');
    this.translate.use(this.localeService.currentLanguage());
  }

  currentLang() {
    return this.localeService.currentLanguage();
  }

  currentCurrency() {
    return this.localeService.currentCurrency();
  }

  currentCurrencyIcon() {
    return CURRENCY_FLAGS[this.currentCurrency()];
  }

  currentLangIcon() {
    return LANGUAGE_LABELS[this.currentLang()].icon;
  }

  currencyIcon(currency: SupportedCurrency) {
    return CURRENCY_FLAGS[currency];
  }

  toggleMenu() {
    this.isOpen.update(v => !v);
  }

  setLanguage(lang: SupportedLanguage) {
    this.localeService.setLanguage(lang);
    this.translate.use(lang);
    this.isOpen.set(false);
  }

  setCurrency(currency: SupportedCurrency) {
    this.localeService.setCurrency(currency);
    this.isOpen.set(false);
  }

  @HostListener('document:click', ['$event.target'])
  onClickOutside(target: EventTarget | null) {
    if (target && this.isOpen() && !this.elementRef.nativeElement.contains(target as Node)) {
      this.isOpen.set(false);
    }
  }
}
