import { Component, Input } from '@angular/core';
import {
  SiteNavbarAppearance,
  SiteNavbarComponent,
} from '../site-navbar/site-navbar.component';

@Component({
    selector: 'app-app-navbar',
    imports: [SiteNavbarComponent],
    template: `
    <app-site-navbar
      [appearance]="appearance"
      [showUserActions]="true"
      [showAppActions]="true"
      [showLocale]="true"
    />
  `
})
export class AppNavbarComponent {
  @Input() theme: 'light' | 'blue' | 'dark' = 'light';

  get appearance(): SiteNavbarAppearance {
    return `app-${this.theme}` as SiteNavbarAppearance;
  }
}
