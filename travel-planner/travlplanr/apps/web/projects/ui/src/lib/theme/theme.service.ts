import { Injectable, InjectionToken, effect, inject, signal } from '@angular/core';

/** localStorage key used to persist the dark/light preference. Override per-app via a provider. */
export const THEME_STORAGE_KEY = new InjectionToken<string>('THEME_STORAGE_KEY', {
  providedIn: 'root',
  factory: () => 'travlplanr_theme',
});

/**
 * Shared dark-mode toggle (`darkMode: 'class'` in tailwind.config.js). Signal-backed,
 * persists to localStorage, and falls back to the OS `prefers-color-scheme` on first visit.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = inject(THEME_STORAGE_KEY);
  readonly isDark = signal<boolean>(false);

  constructor() {
    const stored = localStorage.getItem(this.storageKey);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.isDark.set(stored === 'dark' || (stored === null && prefersDark));

    effect(() => {
      if (this.isDark()) {
        document.documentElement.classList.add('dark');
        localStorage.setItem(this.storageKey, 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem(this.storageKey, 'light');
      }
    });
  }

  toggle(): void {
    this.isDark.set(!this.isDark());
  }
}
