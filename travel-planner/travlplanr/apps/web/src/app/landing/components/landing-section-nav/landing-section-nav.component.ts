import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ChatContextService } from '../../../shared/services/chat-context.service';

interface LandingSectionLink {
  id: string;
  labelKey: string;
}

/** Matches site navbar landing height (`h-[73px]`). */
const NAVBAR_HEIGHT_PX = 73;
/** Approx. sticky pill row height (padding + link). */
const SECTION_NAV_HEIGHT_PX = 48;
/** Clearance below the fixed/sticky chrome for anchors + scroll-spy. */
const STICKY_STACK_OFFSET_PX = NAVBAR_HEIGHT_PX + SECTION_NAV_HEIGHT_PX;

@Component({
    selector: 'app-landing-section-nav',
    imports: [TranslatePipe],
    host: {
        '[class.hidden-nav]': '!visible()',
        '[class.backdrop-blend]': 'chatContext.pageBackdropActive()',
    },
    styles: [
        `
      :host {
        display: block;
        position: sticky;
        top: 73px;
        z-index: 42;
        pointer-events: none;
      }

      :host(.backdrop-blend) {
        z-index: 42;
      }

      .section-nav {
        display: flex;
        justify-content: flex-start;
        width: 100%;
        margin: 0;
        padding: 0.35rem 0;
        background: none;
        border: none;
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        pointer-events: none;
        transition:
          opacity 0.25s ease,
          transform 0.25s ease;
      }

      .section-nav-track {
        display: flex;
        justify-content: flex-start;
        width: 100%;
        pointer-events: none;
      }

      .section-nav-pills {
        display: inline-flex;
        width: auto;
        max-width: min(100%, 72rem);
        align-items: center;
        gap: 0.35rem;
        overflow-x: auto;
        pointer-events: auto;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .section-nav-pills::-webkit-scrollbar {
        display: none;
      }

      :host(.backdrop-blend) .section-nav {
        background: none;
        border: none;
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
      }

      :host(.hidden-nav) {
        pointer-events: none;
      }
      :host(.hidden-nav) .section-nav {
        opacity: 0;
        transform: translateY(-8px);
      }

      .section-nav-link {
        white-space: nowrap;
        border-radius: 999px;
        padding: 0.4rem 0.9rem;
        font-size: 13px;
        font-weight: 600;
        color: #525252;
        background: #fff;
        border: 1px solid rgba(0, 0, 0, 0.08);
        box-shadow: 0 1px 4px rgba(15, 23, 42, 0.06);
        transition:
          background 0.15s ease,
          color 0.15s ease,
          border-color 0.15s ease,
          box-shadow 0.15s ease;
      }
      .section-nav-link:hover {
        background: #fff;
        color: #0060ea;
        border-color: rgba(0, 96, 234, 0.2);
        box-shadow: 0 2px 8px rgba(0, 96, 234, 0.1);
      }
      .section-nav-link.active {
        background: #0060ea;
        color: #fff;
        border-color: #0060ea;
        box-shadow: 0 2px 10px rgba(0, 96, 234, 0.25);
      }

      :host(.backdrop-blend) .section-nav-link {
        background: #fff;
        border: 1px solid rgba(0, 0, 0, 0.08);
        box-shadow: 0 2px 10px rgba(15, 23, 42, 0.1);
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
      }
      :host(.backdrop-blend) .section-nav-link:hover {
        background: #fff;
        color: #0060ea;
        border-color: rgba(0, 96, 234, 0.22);
      }
      :host(.backdrop-blend) .section-nav-link.active {
        background: #0060ea;
        color: #fff;
        border-color: #0060ea;
        box-shadow: 0 3px 14px rgba(0, 96, 234, 0.3);
      }
    `,
    ],
    template: `
    <nav class="section-nav" [attr.aria-label]="'LANDING.SECTION_NAV.ARIA' | translate">
      <div class="section-nav-track section-container">
        <div class="section-nav-pills">
          @for (link of links; track link.id) {
            <a
              class="section-nav-link"
              [class.active]="activeSection() === link.id"
              [href]="'#' + link.id"
              (click)="scrollToSection($event, link.id)"
            >
              {{ link.labelKey | translate }}
            </a>
          }
        </div>
      </div>
    </nav>
  `
})
export class LandingSectionNavComponent {
  readonly chatContext = inject(ChatContextService);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly links: LandingSectionLink[] = [
    { id: 'how-it-works', labelKey: 'LANDING.SECTION_NAV.HOW' },
    { id: 'packages', labelKey: 'LANDING.SECTION_NAV.PACKAGES' },
    { id: 'destinations', labelKey: 'LANDING.SECTION_NAV.DESTINATIONS' },
    { id: 'testimonials', labelKey: 'LANDING.SECTION_NAV.TESTIMONIALS' },
    { id: 'regions', labelKey: 'LANDING.SECTION_NAV.REGIONS' },
  ];

  readonly activeSection = signal('how-it-works');
  readonly visible = signal(false);

  @HostListener('window:scroll')
  onScroll(): void {
    if (typeof window === 'undefined') return;

    const y = window.scrollY;
    let show = y > window.innerHeight * 0.65;

    let current = this.links[0].id;
    for (const link of this.links) {
      const el = document.getElementById(link.id);
      if (el && el.getBoundingClientRect().top <= STICKY_STACK_OFFSET_PX) {
        current = link.id;
      }
    }
    this.activeSection.set(current);

    // Floating pills have no bar background — hide while a section title sits
    // under the sticky band (most noticeable on Explore by Region near the footer).
    if (show && this.titleOverlapsStickyBand(current)) {
      show = false;
    }

    // Near page end the sticky host is pushed up by its container; hide to avoid
    // the pills sliding over the regions heading.
    if (show) {
      const hostTop = this.host.nativeElement.getBoundingClientRect().top;
      if (hostTop < NAVBAR_HEIGHT_PX - 1) {
        show = false;
      }
    }

    this.visible.set(show);
  }

  scrollToSection(event: Event, id: string): void {
    event.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;

    const top = window.scrollY + el.getBoundingClientRect().top - STICKY_STACK_OFFSET_PX;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    this.activeSection.set(id);
  }

  private titleOverlapsStickyBand(sectionId: string): boolean {
    const section = document.getElementById(sectionId);
    const heading = section?.querySelector('h2');
    if (!heading) return false;

    const rect = heading.getBoundingClientRect();
    const bandTop = NAVBAR_HEIGHT_PX;
    const bandBottom = STICKY_STACK_OFFSET_PX;
    return rect.top < bandBottom && rect.bottom > bandTop;
  }
}
