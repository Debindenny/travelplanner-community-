import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  ElementRef,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, of, startWith, switchMap } from 'rxjs';
import { TitleCasePipe } from '@angular/common';
import { DestinationSearchService } from '../../services/destination-search.service';
import { DestinationListItem } from '../../utils/destination.util';

export type TypeaheadPresentation = 'chips' | 'dropdown';
export type TypeaheadVariant = 'glass' | 'surface' | 'dark';

@Component({
    selector: 'app-destination-typeahead',
    imports: [TitleCasePipe],
    host: {
        '[class.typeahead-dropdown-host]': 'presentation() === "dropdown"',
    },
    template: `
    @if (isOpen()) {
      @if (loading() && presentation() === 'dropdown') {
        <ul
          class="typeahead-dropdown typeahead-status"
          [class.dark]="variant() === 'dark'"
          role="listbox"
          [attr.aria-label]="ariaLabel()"
        >
          <li class="typeahead-status-item" role="presentation">
            <span class="typeahead-spinner" aria-hidden="true"></span>
            <span class="text-sm text-text-secondary">{{ loadingLabel() }}</span>
          </li>
        </ul>
      } @else if (showEmpty() && presentation() === 'dropdown') {
        <ul
          class="typeahead-dropdown typeahead-status"
          [class.dark]="variant() === 'dark'"
          role="listbox"
          [attr.aria-label]="ariaLabel()"
        >
          <li class="typeahead-status-item text-sm text-text-secondary" role="presentation">
            {{ emptyLabel() }}
          </li>
        </ul>
      } @else if (showEmpty() && presentation() === 'chips') {
        <div
          class="typeahead-empty"
          [class.surface]="variant() === 'surface'"
          [class.dark]="variant() === 'dark'"
          role="status"
        >
          {{ emptyLabel() }}
        </div>
      } @else if (visible()) {
        @if (showingRecent() && presentation() === 'chips') {
          <div class="typeahead-recent-label">Recent searches</div>
        }
        @if (presentation() === 'dropdown') {
          <ul
            [id]="listboxId()"
            class="typeahead-dropdown"
            [class.dark]="variant() === 'dark'"
            role="listbox"
            [attr.aria-label]="listboxAriaLabel()"
          >
            @if (showingRecent()) {
              <li class="typeahead-status-item text-xs text-text-tertiary" role="presentation">
                Recent searches
              </li>
            }
            @for (item of items(); track item.name; let i = $index) {
              <li>
                <button
                  [id]="optionId(i)"
                  type="button"
                  class="typeahead-dropdown-item"
                  [class.active]="activeIndex() === i"
                  role="option"
                  [attr.aria-selected]="activeIndex() === i"
                  (mousedown)="$event.preventDefault()"
                  (click)="pick(item)"
                >
                  @if (item.image) {
                    <img [src]="item.image" [alt]="''" class="typeahead-thumb" loading="lazy" />
                  } @else {
                    <span class="typeahead-thumb-fallback" aria-hidden="true">📍</span>
                  }
                  <span class="min-w-0 flex-1 text-left">
                    <span class="block truncate font-medium">{{ item.name }}</span>
                    @if (item.region) {
                      <span class="block truncate text-xs text-text-tertiary">{{ item.region }}</span>
                    }
                  </span>
                </button>
              </li>
            }
          </ul>
        } @else {
          <div
            [id]="listboxId()"
            class="typeahead-chips"
            role="listbox"
            [attr.aria-label]="listboxAriaLabel()"
          >
            @for (item of items(); track item.name; let i = $index) {
              <button
                [id]="optionId(i)"
                type="button"
                class="typeahead-chip"
                [class.surface]="variant() === 'surface'"
                [class.dark]="variant() === 'dark'"
                [class.active]="activeIndex() === i"
                role="option"
                [attr.aria-selected]="activeIndex() === i"
                (mousedown)="$event.preventDefault()"
                (click)="pick(item)"
              >
                📍 {{ item.name }}
              </button>
            }
          </div>
        }
        <span class="sr-only" aria-live="polite">
          {{ items().length }} {{ showingRecent() ? 'recent searches' : 'destination suggestions' }} available
        </span>
      }
    }
  `,
    styles: [
        `
      :host {
        display: block;
      }

      /* Anchor under the sibling search field via the shared relative parent. */
      :host.typeahead-dropdown-host {
        position: absolute;
        inset-inline: 0;
        top: 100%;
        width: 100%;
        z-index: 50;
        pointer-events: none;
      }

      .typeahead-chips {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
        margin-top: 10px;
      }

      .typeahead-recent-label {
        margin-top: 10px;
        text-align: center;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.6);
      }

      .typeahead-chip {
        font-size: 12px;
        font-weight: 500;
        padding: 6px 12px;
        border-radius: 999px;
        cursor: pointer;
        border: 1px solid rgba(255, 255, 255, 0.28);
        background: rgba(255, 255, 255, 0.14);
        color: rgba(255, 255, 255, 0.92);
        transition: background 0.15s ease, border-color 0.15s ease;
      }
      .typeahead-chip:hover,
      .typeahead-chip.active {
        background: color-mix(in srgb, #0060ea 40%, transparent);
        border-color: rgba(147, 197, 253, 0.6);
        color: #fff;
      }
      .typeahead-chip.surface {
        border-color: color-mix(in srgb, #141414 12%, transparent);
        background: #fff;
        color: #141414;
      }
      .typeahead-chip.surface:hover,
      .typeahead-chip.surface.active {
        background: color-mix(in srgb, #0060ea 8%, transparent);
        border-color: color-mix(in srgb, #0060ea 35%, transparent);
        color: #0060ea;
      }
      .typeahead-chip.dark {
        border-color: rgba(255, 255, 255, 0.18);
        background: rgba(255, 255, 255, 0.08);
        color: rgba(255, 255, 255, 0.92);
      }
      .typeahead-chip.dark:hover,
      .typeahead-chip.dark.active {
        background: color-mix(in srgb, #0060ea 50%, transparent);
        border-color: rgba(147, 197, 253, 0.6);
        color: #fff;
      }

      .typeahead-dropdown {
        position: absolute;
        inset-inline: 0;
        top: 0.5rem;
        width: 100%;
        box-sizing: border-box;
        z-index: 50;
        margin: 0;
        padding: 0.35rem;
        list-style: none;
        border-radius: 1rem;
        border: 1px solid color-mix(in srgb, #141414 10%, transparent);
        background: #fff;
        box-shadow: 0 16px 40px color-mix(in srgb, #141414 12%, transparent);
        max-height: 18rem;
        overflow: auto;
        pointer-events: auto;
      }
      .typeahead-dropdown.dark {
        border-color: rgba(255, 255, 255, 0.12);
        background: rgba(13, 18, 30, 0.98);
        box-shadow: 0 16px 40px color-mix(in srgb, #141414 35%, transparent);
      }

      .typeahead-empty {
        margin-top: 10px;
        text-align: center;
        font-size: 12px;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.72);
      }
      .typeahead-empty.surface {
        color: color-mix(in srgb, #141414 55%, transparent);
      }
      .typeahead-empty.dark {
        color: rgba(255, 255, 255, 0.6);
      }

      .typeahead-status-item {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        padding: 0.65rem 0.75rem;
      }
      .typeahead-dropdown.dark .typeahead-status-item {
        color: rgba(255, 255, 255, 0.72);
      }

      .typeahead-spinner {
        width: 1rem;
        height: 1rem;
        border: 2px solid color-mix(in srgb, #0060ea 20%, transparent);
        border-top-color: #0060ea;
        border-radius: 50%;
        animation: typeaheadSpin 0.7s linear infinite;
        flex-shrink: 0;
      }
      .typeahead-dropdown.dark .typeahead-spinner {
        border-color: rgba(255, 255, 255, 0.2);
        border-top-color: #fff;
      }
      @keyframes typeaheadSpin {
        to { transform: rotate(360deg); }
      }

      .typeahead-dropdown-item {
        display: flex;
        width: 100%;
        align-items: center;
        gap: 0.75rem;
        border: none;
        border-radius: 0.75rem;
        background: transparent;
        padding: 0.55rem 0.65rem;
        cursor: pointer;
        color: inherit;
        text-align: left;
      }
      .typeahead-dropdown-item:hover,
      .typeahead-dropdown-item.active {
        background: color-mix(in srgb, #0060ea 8%, transparent);
      }
      .typeahead-dropdown.dark .typeahead-dropdown-item {
        color: #fff;
      }
      .typeahead-dropdown.dark .typeahead-dropdown-item:hover,
      .typeahead-dropdown.dark .typeahead-dropdown-item.active {
        background: rgba(255, 255, 255, 0.08);
      }

      .typeahead-thumb {
        width: 2.25rem;
        height: 2.25rem;
        border-radius: 0.5rem;
        object-fit: cover;
        flex-shrink: 0;
      }
      .typeahead-thumb-fallback {
        width: 2.25rem;
        height: 2.25rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 0.5rem;
        background: color-mix(in srgb, #0060ea 8%, transparent);
        flex-shrink: 0;
      }

      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      @media (prefers-reduced-motion: reduce) {
        .typeahead-spinner {
          animation-duration: 0.01ms;
        }
      }
    `,
    ]
})
export class DestinationTypeaheadComponent {
  private readonly destinationSearch = inject(DestinationSearchService);
  private readonly elementRef = inject(ElementRef);

  readonly query = input('');
  readonly enabled = input(true);
  readonly minChars = input(2);
  readonly limit = input(6);
  readonly presentation = input<TypeaheadPresentation>('chips');
  readonly variant = input<TypeaheadVariant>('glass');
  /**
   * Controlled open state for dropdown mode. When set, the parent owns
   * open/close (outside click, scroll, blur). Omit for chips / uncontrolled use.
   */
  readonly open = input<boolean | undefined>(undefined);
  readonly listboxId = input('destination-typeahead-listbox');
  readonly ariaLabel = input('Destination suggestions');
  readonly loadingLabel = input('Searching destinations…');
  readonly emptyLabel = input('No destinations found');

  readonly picked = output<DestinationListItem>();
  /** Emitted when Escape closes the panel in controlled dropdown mode. */
  readonly dismissed = output<void>();

  readonly activeIndex = signal(-1);

  private readonly searchTrigger = computed(() => {
    if (!this.enabled()) return null;
    const query = this.query().trim();
    if (query.length < this.minChars()) return null;
    return { query, limit: this.limit() };
  });

  private readonly searchResults = toSignal(
    toObservable(this.searchTrigger).pipe(
      debounceTime(200),
      distinctUntilChanged((a, b) => a?.query === b?.query && a?.limit === b?.limit),
      switchMap((trigger) => {
        if (!trigger) return of<DestinationListItem[]>([]);
        const local = this.destinationSearch.match(trigger.query, trigger.limit);
        return this.destinationSearch.search(trigger.query, trigger.limit).pipe(
          startWith(local),
          catchError(() => of(local)),
        );
      }),
    ),
    { initialValue: [] as DestinationListItem[] },
  );

  /** Shows recent picks when the field is empty/below `minChars` and there's
   * search history, instead of leaving the panel blank until the user types. */
  readonly showingRecent = computed(
    () => !this.searchTrigger() && this.enabled() && this.destinationSearch.recentSearches().length > 0,
  );

  readonly items = computed(() =>
    this.showingRecent()
      ? this.destinationSearch.recentSearches().slice(0, this.limit())
      : this.searchResults() ?? [],
  );

  readonly listboxAriaLabel = computed(() => (this.showingRecent() ? 'Recent searches' : this.ariaLabel()));

  readonly loading = computed(() => {
    const trigger = this.searchTrigger();
    return !!trigger && this.destinationSearch.isLoading();
  });

  readonly visible = computed(() => (this.items() ?? []).length > 0);

  readonly showEmpty = computed(() => {
    const trigger = this.searchTrigger();
    return !!trigger && !this.loading() && (this.items() ?? []).length === 0;
  });

  /** Whether the typeahead panel (results, loading, or empty) is open. */
  readonly isOpen = computed(() => {
    if (this.presentation() === 'dropdown') {
      // Controlled by parent via `[open]`; default closed until parent opens it.
      if (!this.open()) return false;
    }
    return this.loading() || this.visible() || this.showEmpty();
  });

  /** True when `node` is inside this typeahead host (the dropdown panel). */
  containsTarget(target: EventTarget | null): boolean {
    return !!target && target instanceof Node && this.elementRef.nativeElement.contains(target);
  }

  optionId(index: number): string {
    return `${this.listboxId()}-option-${index}`;
  }

  activeOptionId(): string | null {
    const index = this.activeIndex();
    return index >= 0 ? this.optionId(index) : null;
  }

  resetActiveIndex(): void {
    this.activeIndex.set(-1);
  }

  handleKeydown(event: KeyboardEvent): boolean {
    if (this.loading() || this.showEmpty()) {
      if (event.key === 'Escape') {
        this.activeIndex.set(-1);
        this.dismissed.emit();
        return true;
      }
      return false;
    }

    const options = this.items() ?? [];
    if (!options.length) {
      if (event.key === 'Escape' && this.presentation() === 'dropdown' && this.open()) {
        this.dismissed.emit();
        return true;
      }
      return false;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex.update((i) => (i + 1) % options.length);
      return true;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.update((i) => (i <= 0 ? options.length - 1 : i - 1));
      return true;
    }
    if (event.key === 'Enter' && this.activeIndex() >= 0) {
      event.preventDefault();
      this.pick(options[this.activeIndex()]!);
      return true;
    }
    if (event.key === 'Escape') {
      this.activeIndex.set(-1);
      this.dismissed.emit();
      return true;
    }
    return false;
  }

  pick(item: DestinationListItem): void {
    this.destinationSearch.recordRecentSearch(item);
    this.picked.emit(item);
    this.activeIndex.set(-1);
    this.dismissed.emit();
  }
}
