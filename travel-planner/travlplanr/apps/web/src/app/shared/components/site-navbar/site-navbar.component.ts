import { NgClass } from '@angular/common';
import { Component, HostListener, Input, inject, signal, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../auth/auth.service';
import { CommunityNotificationsDropdownComponent } from '../../../community/components/community-notifications-dropdown.component';
import { NAV_LINKS } from '../../data/landing.data';
import { NavLink } from '../../models/landing.models';
import { LogoComponent } from '../logo/logo.component';
import { PrimaryButtonComponent, ThemeService } from 'ui';
import { LocaleSelectorComponent } from '../locale-selector/locale-selector.component';
import { TranslatePipe } from '@ngx-translate/core';
import { ChatContextService } from '../../services/chat-context.service';

export type SiteNavbarAppearance =
  | 'default'
  | 'hero'
  | 'transparent'
  | 'solid'
  | 'app-light'
  | 'app-blue'
  | 'app-dark';

@Component({
    selector: 'app-site-navbar',
    imports: [
        NgClass,
        RouterLink,
        RouterLinkActive,
        LogoComponent,
        PrimaryButtonComponent,
        CommunityNotificationsDropdownComponent,
        LocaleSelectorComponent,
        TranslatePipe,
    ],
    styles: [
        `
      :host {
        display: block;
        width: 100%;
      }

      .hero-gradient-bar {
        background: linear-gradient(
          to bottom,
          rgba(0, 0, 0, 0.52) 0%,
          rgba(0, 0, 0, 0.3) 42%,
          rgba(0, 0, 0, 0.1) 72%,
          transparent 100%
        );
        border-bottom: none;
        box-shadow: none;
      }

      .hero-scrolled-glass {
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.9) 0%,
          rgba(255, 255, 255, 0.62) 52%,
          rgba(255, 255, 255, 0.18) 82%,
          transparent 100%
        );
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        border-bottom: none;
        box-shadow: none;
      }

      .hero-scrolled-blend {
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.72) 0%,
          rgba(255, 255, 255, 0.38) 55%,
          rgba(255, 255, 255, 0.1) 82%,
          transparent 100%
        );
        backdrop-filter: blur(16px) saturate(160%);
        -webkit-backdrop-filter: blur(16px) saturate(160%);
        border-bottom: none;
        box-shadow: none;
      }

      .hero-glass-inner {
        background: rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        box-shadow:
          0 1px 0 rgba(255, 255, 255, 0.1) inset,
          0 -1px 0 rgba(255, 255, 255, 0.05) inset;
      }

      .nav-logo ::ng-deep svg {
        display: block;
        height: 32px;
        width: auto;
        max-width: 132px;
      }

      @media (min-width: 1280px) {
        .nav-logo ::ng-deep svg {
          height: 34px;
          max-width: 168px;
        }
      }

      @media (min-width: 1536px) {
        .nav-logo ::ng-deep svg {
          height: 36px;
          max-width: none;
        }
      }

      .nav-shell {
        display: flex;
        width: 100%;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        min-width: 0;
      }

      @media (min-width: 640px) {
        .nav-shell {
          gap: 0.75rem;
        }
      }

      @media (min-width: 1280px) {
        .nav-shell {
          gap: 1rem;
        }
      }

      .nav-desktop-links {
        display: none;
        min-width: 0;
        flex: 1 1 auto;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding-inline: 0.25rem;
        overflow: hidden;
      }

      .nav-desktop-links a {
        white-space: nowrap;
        flex-shrink: 0;
        line-height: 1.25rem;
      }

      @media (min-width: 1024px) {
        .nav-desktop-links {
          display: flex;
          gap: 0.625rem;
        }

        .nav-desktop-links a {
          font-size: 12px;
        }
      }

      @media (min-width: 1280px) {
        .nav-desktop-links {
          gap: 1rem;
          padding-inline: 0.5rem;
        }

        .nav-desktop-links a {
          font-size: 14px;
        }
      }

      @media (min-width: 1536px) {
        .nav-desktop-links {
          gap: 1.5rem;
        }

        .nav-desktop-links a {
          font-size: 15px;
        }
      }

      .nav-actions {
        display: none;
        flex-shrink: 0;
        align-items: center;
        justify-content: flex-end;
        gap: 0.5rem;
        min-width: 0;
      }

      @media (min-width: 1024px) {
        .nav-actions {
          display: flex;
          gap: 0.625rem;
        }
      }

      @media (min-width: 1280px) {
        .nav-actions {
          gap: 0.875rem;
        }
      }

      @media (min-width: 1536px) {
        .nav-actions {
          gap: 1.25rem;
        }
      }

      .nav-login-link {
        font-size: 13px;
        white-space: nowrap;
      }

      @media (min-width: 1536px) {
        .nav-login-link {
          font-size: 16px;
        }
      }

      .nav-link-item {
        position: relative;
        padding-bottom: 2px;
      }

      .nav-link-item::after {
        content: '';
        position: absolute;
        right: 0;
        bottom: -2px;
        left: 0;
        height: 1.5px;
        border-radius: 99px;
        background: currentColor;
        transform: scaleX(0);
        transform-origin: center;
        transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .nav-link-item.is-active::after,
      .nav-link-item:hover::after {
        transform: scaleX(1);
      }

      .text-on-video {
        text-shadow: 0 1px 6px rgba(0, 0, 0, 0.35);
        letter-spacing: 0.01em;
      }

      .max-w-1281 {
        max-width: 1281px;
      }
    `,
    ],
    template: `
    <header
      class="z-50 w-full transition-all duration-300 ease-in-out"
      [ngClass]="headerClass()"
    >
      <div [ngClass]="outerClass()">
        <div class="nav-shell transition-all duration-300" [ngClass]="innerClass()">
          <div class="nav-logo flex min-w-0 shrink-0 items-center">
            <app-logo [variant]="useLightChrome() ? 'light' : 'dark'" />
          </div>

          <nav class="nav-desktop-links" [attr.aria-label]="'NAV.MAIN_NAVIGATION' | translate">
            @for (link of navLinks; track link.route) {
              <a
                [routerLink]="link.route"
                routerLinkActive
                [routerLinkActiveOptions]="link.route === '/' ? { exact: true } : { exact: false }"
                #navLink="routerLinkActive"
                class="nav-link-item no-underline transition-all duration-200"
                [ngClass]="desktopLinkClass(navLink.isActive)"
                [class.is-active]="navLink.isActive"
              >
                {{ link.labelKey ? (link.labelKey | translate) : link.label }}
              </a>
            }
          </nav>

          <div class="nav-actions">
            @if (showLocale) {
              <app-locale-selector [lightChrome]="useLightChrome()" />
            }

            <!-- Dark mode toggle -->
            <button
              type="button"
              class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full transition-colors"
              [ngClass]="useLightChrome() ? 'text-white hover:bg-white/15' : 'text-text-primary hover:bg-black/5'"
              (click)="theme.toggle()"
              [attr.aria-label]="theme.isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
            >
              @if (theme.isDark()) {
                <!-- Sun icon -->
                <svg class="h-[18px] w-[18px]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
                  <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364-.707.707M6.343 6.343l.707.707m11.66 11.66-.707.707M6.343 17.657l-.707-.707M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z"/>
                </svg>
              } @else {
                <!-- Moon icon -->
                <svg class="h-[18px] w-[18px]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
                  <path d="M21.752 15.002A9.718 9.718 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"/>
                </svg>
              }
            </button>

            @if (showUserActions) {
              @if (auth.isLoggedIn()) {
                @if (showAppActions) {
                  <a
                    routerLink="/community/messages"
                    class="relative shrink-0 rounded-full p-2 transition-colors hover:bg-black/5"
                    [ngClass]="useLightChrome() ? 'text-white hover:bg-white/10' : 'text-gray-600 hover:text-gray-900'"
                    [attr.aria-label]="'NAV.OPEN_COMMUNITY_MESSAGES' | translate"
                  >
                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </a>
                  <app-community-notifications-dropdown [class.text-white]="useLightChrome()" />
                }

                <div class="relative shrink-0">
                  <button
                    type="button"
                    class="h-10 w-10 overflow-hidden rounded-full border-[1.5px] transition-colors"
                    [ngClass]="useLightChrome() ? 'border-white/30 bg-white/20' : 'border-border bg-black/5'"
                    (click)="toggleProfileMenu()"
                    [attr.aria-label]="'NAV.OPEN_PROFILE_MENU' | translate"
                    aria-haspopup="true"
                    [attr.aria-expanded]="profileMenuOpen()"
                  >
                    <img
                      src="/assets/images/default-avatar.svg"
                      [attr.alt]="'NAV.USER_AVATAR_ALT' | translate"
                      class="h-full w-full object-cover"
                    />
                  </button>

                  @if (profileMenuOpen()) {
                    <div class="absolute right-0 z-50 mt-2 w-52 rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5">
                      @if (showAppActions) {
                        <div class="truncate border-b border-border px-4 py-2 text-xs text-text-secondary">
                          {{ auth.user()?.email }}
                        </div>
                      }
                      <a routerLink="/profile" class="block px-4 py-2 text-sm text-text-primary no-underline hover:bg-black/5" (click)="closeProfileMenu()">
                        {{ 'NAV.MY_PROFILE' | translate }}
                      </a>
                      @if (showAppActions) {
                        <a routerLink="/explore" class="block px-4 py-2 text-sm text-text-primary no-underline hover:bg-black/5" (click)="closeProfileMenu()">
                          {{ 'NAV.NEW_TRIP' | translate }}
                        </a>
                      }
                      <button type="button" class="block w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-black/5" (click)="logout(); closeProfileMenu()">
                        {{ 'NAV.LOG_OUT' | translate }}
                      </button>
                    </div>
                  }
                </div>
              } @else {
                @if (!isLoginPage) {
                  <a
                    routerLink="/login"
                    class="nav-login-link shrink-0 font-medium no-underline transition-all duration-200"
                    [ngClass]="useLightChrome() ? 'text-white opacity-80 hover:opacity-100 text-on-video' : 'text-text-primary hover:text-primary'"
                    [attr.title]="'NAV.LOGIN' | translate"
                  >
                    {{ 'NAV.LOGIN_SHORT' | translate }}
                  </a>
                }
                <app-primary-button routerLink="/explore" [widthClass]="ctaWidthClass()">
                  {{ 'NAV.START_FREE_SHORT' | translate }}
                </app-primary-button>
              }
            }
          </div>

          <button
            type="button"
            class="flex h-10 w-10 shrink-0 flex-col items-center justify-center gap-1.5 lg:hidden"
            [attr.aria-label]="(menuOpen() ? 'NAV.CLOSE_MENU' : 'NAV.OPEN_MENU') | translate"
            [attr.aria-expanded]="menuOpen()"
            (click)="toggleMenu()"
          >
            @for (bar of menuBars; track bar) {
              <span class="block h-0.5 w-6" [ngClass]="useLightChrome() ? 'bg-white' : 'bg-text-primary'"></span>
            }
          </button>
        </div>
      </div>

      @if (menuOpen()) {
        <div class="px-5 py-4 lg:hidden" [ngClass]="mobilePanelClass()">
          @if (showLocale) {
            <div class="mb-2 border-b pb-3" [ngClass]="useLightChrome() ? 'border-white/20' : 'border-border'">
              <app-locale-selector [lightChrome]="useLightChrome()" [compact]="true" />
            </div>
          }

          <!-- Dark mode toggle (mobile) -->
          <button
            type="button"
            class="flex w-full items-center gap-3 py-2 text-base transition-colors"
            [ngClass]="useLightChrome() ? 'text-white hover:bg-white/10' : 'text-text-primary hover:bg-black/5'"
            (click)="theme.toggle()"
            [attr.aria-label]="theme.isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <!-- Icon -->
            @if (theme.isDark()) {
              <svg class="h-5 w-5 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
                <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364-.707.707M6.343 6.343l.707.707m11.66 11.66-.707.707M6.343 17.657l-.707-.707M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z"/>
              </svg>
            } @else {
              <svg class="h-5 w-5 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
                <path d="M21.752 15.002A9.718 9.718 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"/>
              </svg>
            }
            <span>{{ theme.isDark() ? 'Light mode' : 'Dark mode' }}</span>
          </button>

          @for (link of navLinks; track link.route) {
            <a
              [routerLink]="link.route"
              routerLinkActive
              [routerLinkActiveOptions]="link.route === '/' ? { exact: true } : { exact: false }"
              #mobileNavLink="routerLinkActive"
              class="block py-3 text-lg no-underline"
              [ngClass]="mobileLinkClass(mobileNavLink.isActive)"
              (click)="closeMenu()"
            >
              {{ link.labelKey ? (link.labelKey | translate) : link.label }}
            </a>
          }

          @if (showUserActions) {
            <div class="mt-2 border-t pt-2" [ngClass]="useLightChrome() ? 'border-white/20' : 'border-border'">
              @if (auth.isLoggedIn()) {
                @if (showAppActions) {
                  <span class="block truncate py-1 text-sm" [ngClass]="useLightChrome() ? 'text-white/70' : 'text-text-secondary'">
                    {{ auth.user()?.email }}
                  </span>
                  <a routerLink="/community/messages" class="block py-2 text-base font-medium no-underline" [ngClass]="mobileActionClass()" (click)="closeMenu()">
                    {{ 'NAV.MESSAGES' | translate }}
                  </a>
                }
                <a routerLink="/profile" class="block py-2 text-base font-medium no-underline" [ngClass]="mobileActionClass()" (click)="closeMenu()">
                  {{ 'NAV.MY_PROFILE' | translate }}
                </a>
                <button type="button" class="block w-full py-2 text-left text-base font-medium" [ngClass]="mobileActionClass()" (click)="logout(); closeMenu()">
                  {{ 'NAV.LOG_OUT' | translate }}
                </button>
              } @else if (!isLoginPage) {
                <a routerLink="/login" class="block py-2 text-base font-medium no-underline" [ngClass]="mobileActionClass()" (click)="closeMenu()">
                  {{ 'NAV.LOGIN' | translate }}
                </a>
              }
              <div (click)="closeMenu()">
                <app-primary-button routerLink="/explore" widthClass="mt-2 w-full">
                  {{ (auth.isLoggedIn() && showAppActions ? 'NAV.NEW_TRIP' : 'NAV.START_FREE') | translate }}
                </app-primary-button>
              </div>
            </div>
          }
        </div>
      }
    </header>
  `
})
export class SiteNavbarComponent {
  @Input() appearance: SiteNavbarAppearance = 'default';
  @Input() overlayHero = false;
  @Input() navLinks: NavLink[] = NAV_LINKS;
  @Input() showUserActions = false;
  @Input() showLocale = false;
  @Input() showAppActions = false;

  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly elRef = inject(ElementRef);
  readonly chatContext = inject(ChatContextService);
  protected theme = inject(ThemeService);

  get isLoginPage(): boolean {
    return this.router.url.startsWith('/login');
  }
  readonly menuOpen = signal(false);
  readonly profileMenuOpen = signal(false);
  readonly scrolled = signal(false);
  readonly menuBars = [1, 2, 3];

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (this.overlayHero || this.appearance === 'transparent') {
      this.scrolled.set(window.scrollY > (this.overlayHero ? 40 : 20));
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.profileMenuOpen()) this.closeProfileMenu();
    if (this.menuOpen()) this.closeMenu();
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      if (this.profileMenuOpen()) this.closeProfileMenu();
      if (this.menuOpen()) this.closeMenu();
    }
  }

  headerClass(): string {
    if (this.appearance === 'hero' && !this.overlayHero) {
      return 'absolute inset-x-4 top-0 xl:inset-x-8 hero-glass-inner';
    }

    const base = 'fixed inset-x-0 top-0';
    const heroInView = this.overlayHero && this.chatContext.heroViewportInView();

    if (heroInView && !this.scrolled()) return `${base} hero-gradient-bar`;
    if (this.overlayHero && !heroInView) return `${base} border-b border-border bg-white`;
    if ((heroInView || this.appearance === 'default') && this.chatContext.pageBackdropActive()) {
      return `${base} hero-scrolled-blend`;
    }
    if (heroInView || this.appearance === 'default') return `${base} hero-scrolled-glass`;
    if (this.appearance === 'transparent') return this.scrolled()
      ? `${base} border-b border-white/10 bg-slate-900/90 shadow-lg backdrop-blur-md`
      : `${base} bg-transparent`;
    if (this.appearance === 'solid' || this.appearance === 'app-light') return `${base} border-b border-border bg-white`;
    if (this.appearance === 'app-blue') return `${base} border-b border-transparent bg-primary`;
    return `${base} border-b border-white/10 bg-slate-950`;
  }

  outerClass(): string {
    if (this.overlayHero) return 'w-full';
    if (this.appearance === 'hero') return 'w-full';
    return 'page-container px-5 xl:px-20';
  }

  innerClass(): string {
    const height = this.isAppAppearance() ? 'h-[68px]' : 'h-[73px]';
    if (this.appearance === 'hero' && !this.overlayHero) {
      return `${height} max-w-1281 mx-auto rounded-t-2xl px-6 xl:px-8`;
    }
    if (this.overlayHero) return `${height} px-4 sm:px-6 xl:px-10 2xl:px-16`;
    return height;
  }

  desktopLinkClass(active: boolean): string {
    if (this.useLightChrome()) {
      return `text-white text-on-video ${active ? 'opacity-100' : 'opacity-75 hover:opacity-100'}`;
    }
    return `${active ? 'text-text-primary font-medium' : 'text-text-secondary hover:text-text-primary'}`;
  }

  mobilePanelClass(): string {
    if (this.useLightChrome()) return 'border-t border-white/20 bg-black/80 backdrop-blur-md';
    return 'border-t border-border bg-white';
  }

  mobileLinkClass(active: boolean): string {
    if (this.useLightChrome()) return `text-white ${active ? 'font-medium opacity-100' : 'opacity-85'}`;
    return active ? 'font-medium text-text-primary' : 'text-text-secondary';
  }

  mobileActionClass(): string {
    return this.useLightChrome() ? 'text-white' : 'text-text-primary';
  }

  useLightChrome(): boolean {
    if (this.appearance === 'hero' && !this.overlayHero) return true;
    if (this.overlayHero && this.chatContext.heroViewportInView() && !this.scrolled()) return true;
    return this.appearance === 'transparent' || this.appearance === 'app-blue' || this.appearance === 'app-dark';
  }

  ctaWidthClass(): string {
    return '!h-10 !px-4 !text-sm !whitespace-nowrap shrink-0';
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  toggleProfileMenu(): void {
    this.profileMenuOpen.update((open) => !open);
  }

  closeProfileMenu(): void {
    this.profileMenuOpen.set(false);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/']);
  }

  private isAppAppearance(): boolean {
    return this.appearance === 'app-light' || this.appearance === 'app-blue' || this.appearance === 'app-dark';
  }

  private isMarketingAppearance(): boolean {
    return this.appearance === 'default' || this.appearance === 'hero';
  }
}
