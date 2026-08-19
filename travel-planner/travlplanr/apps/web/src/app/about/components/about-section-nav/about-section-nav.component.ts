import { Component, HostListener, signal } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

interface NavSection {
  id: string;
  labelKey: string;
}

@Component({
    selector: 'app-about-section-nav',
    imports: [TranslatePipe],
    template: `
    <div class="sticky top-[73px] z-40 flex w-full justify-center border-b border-border-light/40 bg-surface/90 backdrop-blur-md shadow-sm transition-all duration-300">
      <nav class="flex items-center gap-1 overflow-x-auto px-4 py-3 sm:gap-2 no-scrollbar" [attr.aria-label]="'ABOUT.NAV.ARIA_LABEL' | translate">
        @for (section of sections; track section.id) {
          <button
            type="button"
            (click)="scrollTo(section.id)"
            class="whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50"
            [class.bg-primary]="activeSection() === section.id"
            [class.text-white]="activeSection() === section.id"
            [class.shadow-md]="activeSection() === section.id"
            [class.text-text-secondary]="activeSection() !== section.id"
            [class.hover:bg-surface-muted]="activeSection() !== section.id"
            [class.hover:text-text-primary]="activeSection() !== section.id"
            [attr.aria-current]="activeSection() === section.id ? 'true' : null"
          >
            {{ section.labelKey | translate }}
          </button>
        }
      </nav>
    </div>
  `,
    styles: [`
    .no-scrollbar::-webkit-scrollbar {
      display: none;
    }
    .no-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  `]
})
export class AboutSectionNavComponent {
  readonly sections: NavSection[] = [
    { id: 'intro', labelKey: 'ABOUT.NAV.STORY' },
    { id: 'timeline', labelKey: 'ABOUT.NAV.JOURNEY' },
    { id: 'features', labelKey: 'ABOUT.NAV.FEATURES' },
    { id: 'map', labelKey: 'ABOUT.NAV.MAP' },
    { id: 'team', labelKey: 'ABOUT.NAV.TEAM' },
    { id: 'join', labelKey: 'ABOUT.NAV.JOIN' },
  ];

  readonly activeSection = signal<string>('intro');

  @HostListener('window:scroll', [])
  onScroll(): void {
    if (typeof window === 'undefined') return;

    let currentId = this.sections[0].id;
    const scrollPosition = window.scrollY + 120;

    for (const section of this.sections) {
      const el = document.getElementById(section.id);
      if (el && el.offsetTop <= scrollPosition) {
        currentId = section.id;
      }
    }

    if (this.activeSection() !== currentId) {
      this.activeSection.set(currentId);
    }
  }

  scrollTo(id: string): void {
    if (typeof window === 'undefined') return;
    const el = document.getElementById(id);
    if (el) {
      const offset = el.offsetTop - 120;
      window.scrollTo({ top: offset, behavior: 'smooth' });
    }
  }
}
