import { Component, Input } from '@angular/core';
import { FooterSectionComponent } from '../../../landing/components/footer-section/footer-section.component';
import { NavbarComponent } from '../../../landing/components/navbar/navbar.component';
import { NavLink } from '../../models/landing.models';
import { DOCUMENT_NAV_LINKS } from '../../data/landing.data';

@Component({
    selector: 'app-legal-page-shell',
    imports: [NavbarComponent, FooterSectionComponent],
    template: `
    <div class="min-h-screen bg-surface-muted">
      <div class="bg-primary" aria-hidden="true">
        <div class="h-[70px]"></div>
      </div>

      <div class="-mt-[70px]">
        <app-navbar variant="default" [navLinks]="navLinks" [showUserActions]="showUserActions" />
      </div>

      <div class="pt-[73px]">
        <section class="page-container px-5 pb-6 pt-8 xl:px-20">
          <ng-content select="[legalHero]" />
        </section>

        <ng-content />
      </div>

      <app-footer-section />
    </div>
  `
})
export class LegalPageShellComponent {
  @Input() navLinks: NavLink[] = DOCUMENT_NAV_LINKS;
  @Input() showUserActions = true;
}
