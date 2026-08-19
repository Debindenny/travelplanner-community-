import { Component, ElementRef, Input, ViewChild, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TermsSection } from '../../models/terms.models';
import { ItineraryPdfService } from '../../../itinerary/itinerary-pdf.service';
import { ToastService } from '../../utils/toast.service';

@Component({
    selector: 'app-legal-document-content',
    imports: [TranslatePipe],
    template: `
    <section class="section-container pb-20 pt-10">
      <div class="mx-auto max-w-[846px]">
        <div class="mb-4 flex justify-end">
          <button
            type="button"
            class="flex items-center gap-2 rounded-btn border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
            [disabled]="downloading()"
            (click)="downloadPdf()"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            {{ (downloading() ? 'LEGAL.DOWNLOAD_PDF_BUSY' : 'LEGAL.DOWNLOAD_PDF') | translate }}
          </button>
        </div>

        <div #docRoot>
        <p class="text-base font-medium text-text-tertiary">{{ lastUpdatedLabel }}</p>

        <p class="mt-4 text-base leading-relaxed text-text-primary">
          {{ intro }}
        </p>

        <nav class="mt-8 rounded-card border border-border bg-white p-6" [attr.aria-label]="'LEGAL.TOC_ARIA_LABEL' | translate">
          <h2 class="text-base font-medium text-text-primary">{{ 'LEGAL.TOC_HEADING' | translate }}</h2>
          <ol class="mt-4 grid gap-2 text-sm leading-relaxed text-text-secondary sm:grid-cols-2">
            @for (section of sections; track section.id) {
              <li>
                <a [href]="'#' + section.id" class="text-primary no-underline hover:underline">
                  {{ section.title }}
                </a>
              </li>
            }
          </ol>
        </nav>

        <div class="mt-10 space-y-10">
          @for (section of sections; track section.id) {
            <section [id]="section.id" class="scroll-mt-28">
              <h2 class="text-xl font-medium leading-snug text-text-primary">
                {{ section.title }}
              </h2>

              @if (section.leadText) {
                <p class="mt-4 text-base font-medium leading-relaxed text-text-primary">
                  {{ section.leadText }}
                </p>
              }

              @if (section.subsections?.length) {
                <div class="mt-4 space-y-4">
                  @for (subsection of section.subsections; track subsection.subtitle) {
                    <div>
                      <h3 class="text-base font-medium text-text-primary">{{ subsection.subtitle }}</h3>
                      <ul class="mt-2 space-y-2 text-base leading-relaxed text-text-primary">
                        @for (bullet of subsection.bullets; track bullet) {
                          <li class="flex gap-2">
                            <span aria-hidden="true">-</span>
                            <span>
                              @if (extractEmail(bullet); as email) {
                                {{ textBeforeEmail(bullet, email) }}<a [href]="'mailto:' + email" class="text-primary hover:underline">{{ email }}</a>{{ textAfterEmail(bullet, email) }}
                              } @else {
                                {{ bullet }}
                              }
                            </span>
                          </li>
                        }
                      </ul>
                    </div>
                  }
                </div>
              }

              @if (section.bullets?.length) {
                <ul class="mt-4 space-y-2 text-base leading-relaxed text-text-primary">
                  @for (bullet of section.bullets; track bullet) {
                    <li class="flex gap-2">
                      <span aria-hidden="true">-</span>
                      <span>
                        @if (extractEmail(bullet); as email) {
                          {{ textBeforeEmail(bullet, email) }}<a [href]="'mailto:' + email" class="text-primary hover:underline">{{ email }}</a>{{ textAfterEmail(bullet, email) }}
                        } @else {
                          {{ bullet }}
                        }
                      </span>
                    </li>
                  }
                </ul>
              }

              @if (section.contactLines?.length) {
                <div class="mt-4 space-y-2 text-base leading-relaxed text-text-primary">
                  @for (line of section.contactLines; track line) {
                    <p>
                      @if (extractEmail(line); as email) {
                        {{ textBeforeEmail(line, email) }}<a [href]="'mailto:' + email" class="text-primary hover:underline">{{ email }}</a>{{ textAfterEmail(line, email) }}
                      } @else {
                        {{ line }}
                      }
                    </p>
                  }
                </div>
              }
            </section>
          }
        </div>
        </div>
      </div>
    </section>
  `
})
export class LegalDocumentContentComponent {
  @Input({ required: true }) sections!: TermsSection[];
  @Input({ required: true }) intro!: string;
  @Input({ required: true }) lastUpdatedLabel!: string;
  @Input({ required: true }) pdfFilename!: string;

  @ViewChild('docRoot') private readonly docRoot!: ElementRef<HTMLElement>;

  private readonly pdfService = inject(ItineraryPdfService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);
  readonly downloading = signal(false);

  extractEmail(text: string): string | null {
    return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
  }

  textBeforeEmail(text: string, email: string): string {
    return text.slice(0, text.indexOf(email));
  }

  textAfterEmail(text: string, email: string): string {
    return text.slice(text.indexOf(email) + email.length);
  }

  async downloadPdf(): Promise<void> {
    if (this.downloading()) return;
    this.downloading.set(true);
    try {
      await this.pdfService.download(this.docRoot.nativeElement, this.pdfFilename);
    } catch (err) {
      console.error('Failed to generate PDF', err);
      this.toast.error(this.translate.instant('LEGAL.DOWNLOAD_PDF_ERROR'));
    } finally {
      this.downloading.set(false);
    }
  }
}
