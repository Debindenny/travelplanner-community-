import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Animated text link, ported from Skiper UI `skiper40` (React/Next) to Angular.
 *
 * All animation is pure CSS (Tailwind `before:` pseudo + `group-hover`), so it is
 * framework-agnostic and respects `prefers-reduced-motion`.
 *
 * Variant → original Skiper component:
 *  - 'underline-sweep'   → Link000 (underline scales right→left, no arrow)
 *  - 'underline-arrow'   → Link001 (underline right→left + arrow, external)
 *  - 'underline-ltr'     → Link002 (underline left→right + arrow)
 *  - 'underline-center'  → Link003 (underline expands from center + arrow)
 *  - 'highlight-grow'    → Link004 (white highlight grows in height, arrow rotates)
 *  - 'highlight-wipe'    → Link005 (white highlight wipes across, arrow slides in)
 *
 * Color: 'underline-*' variants use `bg-current` so the underline matches the text
 * color (set via a `text-*` class on the host). 'highlight-*' variants use
 * `mix-blend-difference` and invert whatever sits behind them.
 */
export type AnimatedLinkVariant =
  | 'underline-sweep'
  | 'underline-arrow'
  | 'underline-ltr'
  | 'underline-center'
  | 'highlight-grow'
  | 'highlight-wipe';

const VARIANT_CLASSES: Record<AnimatedLinkVariant, string> = {
  // Link000 — underline at bottom, scales in from the right edge.
  'underline-sweep':
    "before:pointer-events-none before:absolute before:bottom-0 before:left-0 before:h-[0.05em] before:w-full before:bg-current before:content-[''] " +
    'before:origin-right before:scale-x-0 before:transition-transform before:duration-300 before:ease-[cubic-bezier(0.4,0,0.2,1)] ' +
    'hover:before:origin-left hover:before:scale-x-100',

  // Link001 — underline below text, scales right→left, arrow lifts up.
  'underline-arrow':
    "before:pointer-events-none before:absolute before:left-0 before:top-[1.5em] before:h-[0.05em] before:w-full before:bg-current before:content-[''] " +
    'before:origin-right before:scale-x-0 before:transition-transform before:duration-300 before:ease-[cubic-bezier(0.4,0,0.2,1)] ' +
    'hover:before:origin-left hover:before:scale-x-100',

  // Link002 — underline scales left→right.
  'underline-ltr':
    "before:pointer-events-none before:absolute before:left-0 before:top-[1.5em] before:h-[0.05em] before:w-full before:bg-current before:content-[''] " +
    'before:origin-left before:scale-x-0 before:transition-transform before:duration-300 before:ease-[cubic-bezier(0.4,0,0.2,1)] ' +
    'hover:before:origin-right hover:before:scale-x-100',

  // Link003 — underline expands outward from the center.
  'underline-center':
    "before:pointer-events-none before:absolute before:left-0 before:top-[1.5em] before:h-[0.05em] before:w-full before:bg-current before:content-[''] " +
    'before:origin-center before:scale-x-0 before:transition-transform before:duration-300 before:ease-[cubic-bezier(0.4,0,0.2,1)] ' +
    'hover:before:scale-x-100',

  // Link004 — white highlight grows in height from center, arrow rotates 45°.
  'highlight-grow':
    "before:pointer-events-none before:absolute before:bottom-0 before:left-0 before:w-full before:bg-white before:content-[''] " +
    'before:origin-center before:scale-x-100 before:transition-all before:duration-300 before:ease-[cubic-bezier(0.4,0,0.2,1)] ' +
    'px-2 before:z-[1] before:h-0 before:mix-blend-difference hover:before:h-[1.4em]',

  // Link005 — white highlight wipes left→right at full height, arrow slides in.
  'highlight-wipe':
    "before:pointer-events-none before:absolute before:top-0 before:left-0 before:h-full before:w-full before:bg-white before:content-[''] " +
    'before:origin-left before:scale-x-0 before:transition-all before:duration-300 before:ease-[cubic-bezier(0.4,0,0.2,1)] ' +
    'px-2 before:z-[1] before:mix-blend-difference hover:before:scale-x-100',
};

const ARROW_BASE =
  'relative z-0 ml-[0.3em] size-[0.55em] opacity-0 transition-all duration-300 motion-reduce:transition-none';

const ARROW_BY_VARIANT: Record<AnimatedLinkVariant, string> = {
  'underline-sweep': 'translate-y-1 group-hover:translate-y-0 group-hover:opacity-100',
  'underline-arrow': 'translate-y-1 group-hover:translate-y-0 group-hover:opacity-100',
  'underline-ltr': 'translate-y-1 group-hover:translate-y-0 group-hover:opacity-100',
  'underline-center': 'translate-y-1 group-hover:translate-y-0 group-hover:opacity-100',
  'highlight-grow': 'ml-[0.6em] translate-y-1 group-hover:translate-y-0 group-hover:rotate-45 group-hover:opacity-100',
  'highlight-wipe': 'ml-[0.6em] -translate-x-1 rotate-45 group-hover:translate-x-0 group-hover:opacity-100',
};

@Component({
    selector: 'app-animated-link',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink, NgClass],
    template: `
    <a
      [routerLink]="routerLink ?? null"
      [attr.href]="routerLink ? null : (href || null)"
      [attr.target]="target || null"
      [attr.rel]="(!routerLink && target === '_blank') ? 'noopener noreferrer' : null"
      class="group relative inline-flex w-fit items-center no-underline"
      [ngClass]="[hostClasses(), linkClass]"
    >
      <ng-content />
      @if (showArrow()) {
        <svg
          [ngClass]="arrowClasses()"
          fill="none"
          viewBox="0 0 10 10"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M1.004 9.166 9.337.833m0 0v8.333m0-8.333H1.004"
            stroke="currentColor"
            stroke-width="1.25"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      }
    </a>
  `
})
export class AnimatedLinkComponent {
  /** Internal route. Takes precedence over `href` when set. */
  @Input() routerLink?: string | string[];
  /** External URL (used when `routerLink` is not set). */
  @Input() href = '';
  /** Optional classes applied to the inner anchor element. */
  @Input() linkClass = '';
  /** e.g. '_blank' for external links. */
  @Input() target?: string;

  private readonly variantSig = signal<AnimatedLinkVariant>('underline-sweep');
  private readonly withArrowSig = signal<boolean | null>(null);

  @Input() set variant(value: AnimatedLinkVariant) {
    this.variantSig.set(value);
  }
  /** Force the trailing arrow on/off. Defaults to on for every variant except 'underline-sweep'. */
  @Input() set withArrow(value: boolean) {
    this.withArrowSig.set(value);
  }

  protected readonly hostClasses = computed(() => VARIANT_CLASSES[this.variantSig()]);
  protected readonly arrowClasses = computed(() => `${ARROW_BASE} ${ARROW_BY_VARIANT[this.variantSig()]}`);
  protected readonly showArrow = computed(() => {
    const forced = this.withArrowSig();
    if (forced !== null) return forced;
    return this.variantSig() !== 'underline-sweep';
  });
}
