import { Component, Input } from '@angular/core';
import { NavLink } from '../../../shared/models/landing.models';
import { NAV_LINKS } from '../../../shared/data/landing.data';
import { SiteNavbarComponent } from '../../../shared/components/site-navbar/site-navbar.component';

@Component({
    selector: 'app-navbar',
    imports: [SiteNavbarComponent],
    template: `
    <app-site-navbar
      [appearance]="variant"
      [overlayHero]="overlayHero"
      [navLinks]="navLinks"
      [showUserActions]="showUserActions"
      [showLocale]="true"
    />
  `
})
export class NavbarComponent {
  @Input() variant: 'default' | 'hero' | 'solid' = 'default';
  /** Fixed glass navbar over the landing hero; stays pinned while scrolling. */
  @Input() overlayHero = false;
  @Input() navLinks: NavLink[] = NAV_LINKS;
  @Input() showUserActions = false;
}
