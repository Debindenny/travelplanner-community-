import { Component, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { AppNavbarComponent } from '../components/app-navbar/app-navbar.component';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
    selector: 'app-shell',
    imports: [RouterOutlet, AppNavbarComponent],
    template: `
    <div class="min-h-screen bg-surface-muted">
      <app-app-navbar [theme]="navbarTheme" />
      <div class="pt-[68px]">
        <router-outlet></router-outlet>
      </div>
    </div>
  `
})
export class AppShellComponent {
  private readonly router = inject(Router);
  navbarTheme: 'light' | 'dark' | 'blue' = 'light';

  constructor() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntilDestroyed()
    ).subscribe((event: any) => {
      this.updateNavbarTheme(event.urlAfterRedirects);
    });
    this.updateNavbarTheme(this.router.url);
  }

  private updateNavbarTheme(url: string): void {
    if (url.includes('/community/reels')) {
      this.navbarTheme = 'dark';
    } else if (url.includes('/wizard') || url.includes('/packages') || url.includes('/transfers')) {
      this.navbarTheme = 'blue';
    } else {
      this.navbarTheme = 'light';
    }
  }
}
