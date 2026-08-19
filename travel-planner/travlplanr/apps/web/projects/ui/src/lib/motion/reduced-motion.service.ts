import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ReducedMotionService {
  readonly prefersReducedMotion = signal<boolean>(
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  constructor() {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    mql.addEventListener('change', (e) => this.prefersReducedMotion.set(e.matches));
  }
}
