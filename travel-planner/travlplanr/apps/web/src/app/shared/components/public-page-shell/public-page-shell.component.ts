import { Component, Input } from '@angular/core';
import { NavbarComponent } from '../../../landing/components/navbar/navbar.component';
import { FooterSectionComponent } from '../../../landing/components/footer-section/footer-section.component';

/**
 * Shared outer shell for footer-linked public pages — consistent navbar,
 * max-width, typography, and footer spacing.
 *
 * - `hero`: page opens with its own full-bleed hero section (that section
 *   supplies its own top padding for the fixed navbar offset), e.g. How It
 *   Works, Contact, About.
 * - `content` (default): page has no full-bleed hero; content is offset
 *   below the fixed navbar automatically, e.g. Blog, FAQ.
 */
@Component({
    selector: 'app-public-page-shell',
    imports: [NavbarComponent, FooterSectionComponent],
    template: `
    <div class="min-h-screen font-poppins overflow-x-hidden" [class.bg-white]="background === 'white'" [class.bg-surface-muted]="background === 'surface-muted'">
      @if (topStrip) {
        <div class="bg-primary" aria-hidden="true">
          <div class="h-[70px]"></div>
        </div>
        <div class="-mt-[70px]">
          <app-navbar variant="default" [showUserActions]="true" />
        </div>
      } @else {
        <app-navbar variant="default" [showUserActions]="true" />
      }
      <div [class.pt-\[73px\]]="variant !== 'hero'">
        <ng-content />
      </div>
      <app-footer-section />
    </div>
  `
})
export class PublicPageShellComponent {
  @Input() variant: 'hero' | 'content' = 'content';
  @Input() background: 'white' | 'surface-muted' = 'white';
  /** Renders the colored band behind the navbar used by FAQ. */
  @Input() topStrip = false;
}
