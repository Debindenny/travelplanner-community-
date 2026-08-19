import {
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';

export type SearchFieldVariant = 'surface' | 'minimal' | 'inline' | 'filled';
export type SearchFieldSize = 'sm' | 'md' | 'lg';
export type SearchFieldPrefixIcon = 'search' | 'sparkle' | 'none';

@Component({
  selector: 'app-search-field',
  standalone: true,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .search-field-input {
        -webkit-appearance: none;
        appearance: none;
        outline: none !important;
      }
      /* Wrapper already shows focus-within ring; suppress global :focus-visible. */
      .search-field-input:focus,
      .search-field-input:focus-visible {
        outline: none !important;
        box-shadow: none;
      }
      .search-field-input::-webkit-search-decoration,
      .search-field-input::-webkit-search-cancel-button,
      .search-field-input::-webkit-search-results-button,
      .search-field-input::-webkit-search-results-decoration {
        -webkit-appearance: none;
        display: none;
      }
    `,
  ],
  template: `
    <div role="search" [class]="wrapperClass()">
      @if (prefixIcon() !== 'none') {
        @if (prefixIcon() === 'sparkle') {
          <svg class="shrink-0 text-primary" [class]="iconClass()" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2Z" fill="currentColor" opacity="0.9"/>
            <path d="M5 17l.9 2.7L8.5 21l-2.6.8L5 24l-.9-2.2L1.5 21l2.6-.8L5 17Z" fill="currentColor" opacity="0.55"/>
          </svg>
        } @else {
          <svg class="shrink-0 text-text-disabled" [class]="iconClass()" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.5" />
            <path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        }
      }

      <input
        #inputEl
        type="text"
        enterkeyhint="search"
        class="search-field-input"
        [value]="value()"
        [attr.placeholder]="placeholder()"
        [attr.aria-label]="ariaLabel()"
        [attr.role]="combobox() ? 'combobox' : null"
        [attr.aria-autocomplete]="combobox() ? 'list' : null"
        [attr.aria-expanded]="combobox() ? ariaExpanded() : null"
        [attr.aria-controls]="combobox() && listboxId() ? listboxId() : null"
        [attr.aria-activedescendant]="combobox() ? ariaActiveDescendant() : null"
        [class]="inputClass()"
        (input)="onInput($event)"
        (focus)="focused.emit()"
        (blur)="blurred.emit()"
        (keydown)="keydown.emit($event)"
      />

      @if (showClear() && value()) {
        <button
          type="button"
          class="shrink-0 text-text-tertiary transition-colors hover:text-text-primary"
          [attr.aria-label]="clearAriaLabel()"
          (mousedown)="$event.preventDefault()"
          (click)="clear()"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/>
          </svg>
        </button>
      }
    </div>
  `,
})
export class SearchFieldComponent implements OnDestroy {
  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');

  readonly value = input('');
  readonly placeholder = input('');
  readonly ariaLabel = input('Search');
  readonly clearAriaLabel = input('Clear search');
  readonly variant = input<SearchFieldVariant>('surface');
  readonly size = input<SearchFieldSize>('md');
  readonly prefixIcon = input<SearchFieldPrefixIcon>('search');
  readonly showClear = input(true);
  readonly debounceMs = input(0);
  readonly inputClassName = input('');
  readonly combobox = input(false);
  readonly listboxId = input<string | null>(null);
  readonly ariaExpanded = input(false);
  readonly ariaActiveDescendant = input<string | null>(null);

  readonly valueChange = output<string>();
  readonly cleared = output<void>();
  readonly focused = output<void>();
  readonly blurred = output<void>();
  readonly keydown = output<KeyboardEvent>();

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const external = this.value();
      const input = this.inputEl()?.nativeElement;
      if (input && input.value !== external) {
        input.value = external;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  focus(): void {
    this.inputEl()?.nativeElement.focus();
  }

  wrapperClass(): string {
    const variant = this.variant();
    const size = this.size();
    const base = 'relative flex items-center gap-3 transition-all w-full';

    const variantClass =
      variant === 'surface'
        ? 'bg-white border border-border rounded-full px-4 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary'
        : variant === 'inline'
          ? 'rounded-btn border border-border bg-white px-5 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary'
          : variant === 'filled'
            ? 'bg-surface-muted border border-border rounded-lg px-4 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary'
            : 'bg-transparent';

    const sizeClass =
      variant === 'inline' || variant === 'filled'
        ? size === 'lg'
          ? 'h-12'
          : size === 'sm'
            ? 'h-9'
            : 'h-10'
        : size === 'lg'
          ? 'py-3'
          : size === 'sm'
            ? 'py-1.5'
            : 'py-2';

    return `${base} ${variantClass} ${sizeClass}`.trim();
  }

  iconClass(): string {
    return this.size() === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  }

  inputClass(): string {
    const sizeClass =
      this.size() === 'lg'
        ? 'text-base'
        : this.size() === 'sm'
          ? 'text-sm'
          : 'text-sm-plus';
    const custom = this.inputClassName();
    return `min-w-0 flex-1 bg-transparent text-text-primary outline-none placeholder:text-text-tertiary ${sizeClass} ${custom}`.trim();
  }

  onInput(event: Event): void {
    const next = (event.target as HTMLInputElement).value;
    const delay = this.debounceMs();
    if (!delay) {
      this.valueChange.emit(next);
      return;
    }
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.valueChange.emit(next), delay);
  }

  clear(): void {
    const input = this.inputEl()?.nativeElement;
    if (input) input.value = '';
    this.valueChange.emit('');
    this.cleared.emit();
    input?.focus();
  }
}
