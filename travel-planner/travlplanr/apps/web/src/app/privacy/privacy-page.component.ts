import { Component, OnInit, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LegalDocumentContentComponent } from '../shared/components/legal-document-content/legal-document-content.component';
import { LegalPageShellComponent } from '../shared/components/legal-page-shell/legal-page-shell.component';
import { SeoService } from '../shared/services/seo.service';
import { LocaleService } from '../core/services/locale.service';
import {
  PRIVACY_EFFECTIVE_DATE,
  PRIVACY_INTRO,
  PRIVACY_LAST_UPDATED,
  PRIVACY_SECTIONS,
} from '../shared/data/privacy.data';
import {
  PRIVACY_EFFECTIVE_DATE_ES,
  PRIVACY_INTRO_ES,
  PRIVACY_LAST_UPDATED_ES,
  PRIVACY_SECTIONS_ES,
} from '../shared/data/privacy.data.es';
import {
  PRIVACY_EFFECTIVE_DATE_FR,
  PRIVACY_INTRO_FR,
  PRIVACY_LAST_UPDATED_FR,
  PRIVACY_SECTIONS_FR,
} from '../shared/data/privacy.data.fr';

@Component({
    selector: 'app-privacy-page',
    imports: [LegalPageShellComponent, LegalDocumentContentComponent, TranslatePipe],
    template: `
    <app-legal-page-shell>
      <div legalHero class="max-w-[846px]">
        <h1 class="text-[clamp(1.75rem,4vw,32px)] font-semibold leading-tight text-text-primary">
          {{ 'LEGAL.PRIVACY.HEADING' | translate }} –
          <span class="text-primary">TRAVL PLANR</span>
        </h1>
        <p class="mt-2 text-base font-medium text-text-secondary">
          {{ 'LEGAL.EFFECTIVE_DATE' | translate: { date: effectiveDate() } }}
        </p>

        @if (isMachineTranslated()) {
          <p class="mt-4 rounded-card border border-border bg-surface-muted px-4 py-3 text-sm leading-relaxed text-text-secondary">
            {{ 'LEGAL.TRANSLATION_NOTICE' | translate }}
          </p>
        }
      </div>

      <app-legal-document-content
        [sections]="sections()"
        [intro]="intro()"
        [lastUpdatedLabel]="('LEGAL.LAST_UPDATED' | translate) + lastUpdated()"
        pdfFilename="travlplanr-privacy-policy.pdf"
      />
    </app-legal-page-shell>
  `
})
export class PrivacyPageComponent implements OnInit {
  private readonly seo = inject(SeoService);
  private readonly locale = inject(LocaleService);

  readonly isMachineTranslated = computed(() => this.locale.currentLanguage() !== 'en');

  readonly sections = computed(() => {
    switch (this.locale.currentLanguage()) {
      case 'es':
        return PRIVACY_SECTIONS_ES;
      case 'fr':
        return PRIVACY_SECTIONS_FR;
      default:
        return PRIVACY_SECTIONS;
    }
  });

  readonly intro = computed(() => {
    switch (this.locale.currentLanguage()) {
      case 'es':
        return PRIVACY_INTRO_ES;
      case 'fr':
        return PRIVACY_INTRO_FR;
      default:
        return PRIVACY_INTRO;
    }
  });

  readonly lastUpdated = computed(() => {
    switch (this.locale.currentLanguage()) {
      case 'es':
        return PRIVACY_LAST_UPDATED_ES;
      case 'fr':
        return PRIVACY_LAST_UPDATED_FR;
      default:
        return PRIVACY_LAST_UPDATED;
    }
  });

  readonly effectiveDate = computed(() => {
    switch (this.locale.currentLanguage()) {
      case 'es':
        return PRIVACY_EFFECTIVE_DATE_ES;
      case 'fr':
        return PRIVACY_EFFECTIVE_DATE_FR;
      default:
        return PRIVACY_EFFECTIVE_DATE;
    }
  });

  ngOnInit(): void {
    this.seo.set({
      title: 'Privacy Policy | TRAVL PLANR',
      description:
        'Read the TRAVL PLANR Privacy Policy to understand how we collect, use, protect, and manage your travel planning data.',
    });
  }
}
