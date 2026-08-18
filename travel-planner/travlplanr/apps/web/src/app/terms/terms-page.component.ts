import { Component, OnInit, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LegalDocumentContentComponent } from '../shared/components/legal-document-content/legal-document-content.component';
import { LegalPageShellComponent } from '../shared/components/legal-page-shell/legal-page-shell.component';
import { TERMS_INTRO, TERMS_LAST_UPDATED, TERMS_SECTIONS } from '../shared/data/terms.data';
import { TERMS_INTRO_ES, TERMS_LAST_UPDATED_ES, TERMS_SECTIONS_ES } from '../shared/data/terms.data.es';
import { TERMS_INTRO_FR, TERMS_LAST_UPDATED_FR, TERMS_SECTIONS_FR } from '../shared/data/terms.data.fr';
import { SeoService } from '../shared/services/seo.service';
import { LocaleService } from '../core/services/locale.service';

@Component({
    selector: 'app-terms-page',
    imports: [LegalPageShellComponent, LegalDocumentContentComponent, TranslatePipe],
    template: `
    <app-legal-page-shell>
      <div legalHero class="max-w-[846px]">
        <h1 class="text-[clamp(1.75rem,4vw,32px)] font-semibold leading-tight text-text-primary">
          {{ 'LEGAL.TERMS.HEADING' | translate }} –
          <span class="text-primary">TRAVL PLANR</span>
        </h1>
        <p class="mt-2 text-base font-medium text-text-secondary">
          {{ 'LEGAL.TERMS.SUBTITLE' | translate }}
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
        pdfFilename="travlplanr-terms-and-conditions.pdf"
      />
    </app-legal-page-shell>
  `
})
export class TermsPageComponent implements OnInit {
  private readonly seo = inject(SeoService);
  private readonly locale = inject(LocaleService);

  readonly isMachineTranslated = computed(() => this.locale.currentLanguage() !== 'en');

  readonly sections = computed(() => {
    switch (this.locale.currentLanguage()) {
      case 'es':
        return TERMS_SECTIONS_ES;
      case 'fr':
        return TERMS_SECTIONS_FR;
      default:
        return TERMS_SECTIONS;
    }
  });

  readonly intro = computed(() => {
    switch (this.locale.currentLanguage()) {
      case 'es':
        return TERMS_INTRO_ES;
      case 'fr':
        return TERMS_INTRO_FR;
      default:
        return TERMS_INTRO;
    }
  });

  readonly lastUpdated = computed(() => {
    switch (this.locale.currentLanguage()) {
      case 'es':
        return TERMS_LAST_UPDATED_ES;
      case 'fr':
        return TERMS_LAST_UPDATED_FR;
      default:
        return TERMS_LAST_UPDATED;
    }
  });

  ngOnInit(): void {
    this.seo.set({
      title: 'Terms & Conditions | TRAVL PLANR',
      description:
        'Review the TRAVL PLANR Terms & Conditions for using the platform, travel planning tools, bookings, and related services.',
    });
  }
}
