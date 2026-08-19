import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LogoComponent } from '../../../shared/components/logo/logo.component';
import { AuthService } from '../../../auth/auth.service';
import { LocaleSelectorComponent } from '../../../shared/components/locale-selector/locale-selector.component';

@Component({
  selector: 'app-explore-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, LogoComponent, TranslatePipe, LocaleSelectorComponent],
  template: `
    <header class="bg-primary">
      <div class="mx-auto flex h-[73px] max-w-[1490px] items-center justify-between border-b border-white/20 px-6 xl:px-[88px]">
        <app-logo variant="light" />

        <nav class="hidden flex-1 items-center justify-center gap-16 px-8 lg:flex" [attr.aria-label]="'EXPLORE.NAV.MAIN_NAV' | translate">
          <a
            routerLink="/"
            class="text-lg text-white/70 no-underline transition-colors hover:text-white"
            routerLinkActive="!text-white"
            [routerLinkActiveOptions]="{ exact: true }"
          >
            {{ 'EXPLORE.NAV.HOME' | translate }}
          </a>
          <a
            routerLink="/packages"
            class="text-lg text-white/70 no-underline transition-colors hover:text-white"
            routerLinkActive="!text-white"
          >
            {{ 'EXPLORE.NAV.PACKAGES' | translate }}
          </a>
          <a
            routerLink="/community"
            class="text-lg text-white/70 no-underline transition-colors hover:text-white"
            routerLinkActive="!text-white"
          >
            {{ 'EXPLORE.NAV.COMMUNITY' | translate }}
          </a>
          <a
            routerLink="/trips"
            class="text-lg text-white/70 no-underline transition-colors hover:text-white"
            routerLinkActive="!text-white"
          >
            {{ 'EXPLORE.NAV.TRIPS' | translate }}
          </a>
        </nav>

        <div class="flex items-center gap-4">
          <app-locale-selector [lightChrome]="true" />

          @if (auth.isLoggedIn()) {
            <a
              routerLink="/profile"
              class="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-medium text-white no-underline hover:bg-white/30 transition-colors"
              [attr.aria-label]="'EXPLORE.NAV.PROFILE' | translate"
            >
              {{ initials() }}
            </a>
          } @else {
            <a
              routerLink="/login"
              class="rounded-btn px-4 py-1.5 text-sm font-medium text-white hover:bg-white/10 transition-colors no-underline border border-white/20"
            >
              {{ 'EXPLORE.NAV.LOGIN' | translate }}
            </a>
          }
        </div>
      </div>
    </header>
  `,
})
export class ExploreNavbarComponent {
  auth = inject(AuthService);

  initials(): string {
    const name = this.auth.customerName();
    if (name) {
      return name.charAt(0).toUpperCase();
    }
    return 'U';
  }
}
