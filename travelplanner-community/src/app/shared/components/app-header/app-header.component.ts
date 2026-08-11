import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="topbar" role="banner">
      <div class="topbar__inner">
        <div class="topbar__brand">
          <div class="topbar__brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M2 12h20M12 2c3 3.5 3 16.5 0 20M12 2c-3 3.5-3 16.5 0 20"></path>
            </svg>
          </div>
          <div class="topbar__brand-divider" aria-hidden="true"></div>
          <span class="topbar__brand-name">TRAVL PLANR</span>
        </div>

        <nav class="topbar__nav" aria-label="Primary" *ngIf="showNav">
          <button
            type="button"
            class="topbar__nav-link"
            [class.is-active]="activeTab() === tab"
            *ngFor="let tab of tabs"
            (click)="selectTab.emit(tab)"
          >
            {{ tab }}
          </button>
        </nav>

        <div class="topbar__actions" aria-label="Quick tools">
          <button type="button" class="topbar__pill">US · EN · INR</button>
          <button type="button" class="topbar__icon" aria-label="Notifications">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 11.5a8.4 8.4 0 01-9 8.5 9.7 9.7 0 01-2.8-.4L3 21l1.4-4.2A8.4 8.4 0 0121 11.5z"></path></svg>
          </button>
          <button type="button" class="topbar__icon" aria-label="Messages">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 01-3.4 0"></path></svg>
          </button>
          <button type="button" class="topbar__profile" (click)="toggleProfile.emit()" aria-label="Profile menu">AV</button>
        </div>
      </div>
    </header>
  `,
  styleUrl: './app-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeaderComponent {
  readonly tabs = ['Home', 'Explore', 'Transfers', 'About Us', 'Pricing', 'Community'];
  readonly activeTab = input<string>('Home');
  readonly showNav = input<boolean>(true);
  readonly selectTab = output<string>();
  readonly toggleProfile = output<void>();
}
