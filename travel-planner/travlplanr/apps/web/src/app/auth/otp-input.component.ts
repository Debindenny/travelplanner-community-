import {
  Component,
  ElementRef,
  QueryList,
  ViewChildren,
  forwardRef,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-otp-input',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => OtpInputComponent),
      multi: true,
    },
  ],
  template: `
    <div class="flex gap-2" role="group">
      @for (i of indices; track i) {
        <input
          #digitInput
          type="text"
          inputmode="numeric"
          [attr.autocomplete]="i === 0 ? 'one-time-code' : null"
          pattern="[0-9]*"
          maxlength="2"
          [value]="digits()[i] ?? ''"
          [attr.aria-label]="'Digit ' + (i + 1) + ' of 6'"
          [disabled]="disabled() || null"
          (input)="onInput($event, i)"
          (keydown)="onKeydown($event, i)"
          (paste)="onPaste($event, i)"
          (focus)="onFocus($event)"
          (blur)="onBlurInput()"
          class="h-12 w-full min-w-0 rounded-btn border border-border text-center text-xl font-semibold outline-none transition-colors focus:border-primary disabled:opacity-50"
          [class.border-primary]="!!digits()[i]"
        />
      }
    </div>
  `,
})
export class OtpInputComponent implements ControlValueAccessor {
  readonly indices = [0, 1, 2, 3, 4, 5];
  readonly digits = signal<string[]>(['', '', '', '', '', '']);
  readonly disabled = signal(false);

  @ViewChildren('digitInput') inputRefs!: QueryList<ElementRef<HTMLInputElement>>;

  onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    const clean = (value ?? '').replace(/\D/g, '').slice(0, 6);
    // Always keep exactly 6 slots — ''.split('') is [] and would render "undefined" in inputs.
    this.digits.set(Array.from({ length: 6 }, (_, i) => clean[i] ?? ''));
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  focusFirst(): void {
    this.focusAt(0);
  }

  onInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/\D/g, '');

    if (raw.length > 1) {
      // Browser autofill or fast paste into a single field
      const updated = [...this.digits()];
      raw.slice(0, 6 - index).split('').forEach((d, offset) => {
        if (index + offset < 6) updated[index + offset] = d;
      });
      this.digits.set(updated);
      this.emitValue();
      const lastFilled = Math.min(index + raw.length - 1, 5);
      this.focusAt(lastFilled < 5 ? lastFilled + 1 : 5);
      return;
    }

    const val = raw.slice(0, 1);
    const updated = [...this.digits()];
    updated[index] = val;
    this.digits.set(updated);
    this.emitValue();
    if (val && index < 5) {
      this.focusAt(index + 1);
    }
  }

  onKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace') {
      const updated = [...this.digits()];
      if (updated[index]) {
        updated[index] = '';
        this.digits.set(updated);
        this.emitValue();
      } else if (index > 0) {
        updated[index - 1] = '';
        this.digits.set(updated);
        this.emitValue();
        this.focusAt(index - 1);
      }
      event.preventDefault();
    } else if (event.key === 'ArrowLeft' && index > 0) {
      this.focusAt(index - 1);
      event.preventDefault();
    } else if (event.key === 'ArrowRight' && index < 5) {
      this.focusAt(index + 1);
      event.preventDefault();
    }
  }

  onPaste(event: ClipboardEvent, index: number): void {
    event.preventDefault();
    const text = event.clipboardData?.getData('text') ?? '';
    const pastedDigits = text.replace(/\D/g, '').slice(0, 6 - index);
    if (!pastedDigits) return;
    const updated = [...this.digits()];
    pastedDigits.split('').forEach((d, offset) => {
      if (index + offset < 6) updated[index + offset] = d;
    });
    this.digits.set(updated);
    this.emitValue();
    const nextEmpty = updated.findIndex((d, i) => i >= index && !d);
    this.focusAt(nextEmpty === -1 ? 5 : nextEmpty);
    this.onTouched();
  }

  onFocus(event: FocusEvent): void {
    (event.target as HTMLInputElement).select();
  }

  onBlurInput(): void {
    // Mark as touched when any digit blurs and no other digit has focus
    // Use a small timeout to allow focus to move between digits without false blurs
    setTimeout(() => {
      const active = document.activeElement;
      const isStillInGroup = this.inputRefs?.some(
        (ref) => ref.nativeElement === active,
      );
      if (!isStillInGroup) this.onTouched();
    }, 50);
  }

  private emitValue(): void {
    this.onChange(this.digits().join(''));
  }

  private focusAt(index: number): void {
    setTimeout(() => {
      const el = this.inputRefs?.get(index)?.nativeElement;
      if (el) {
        el.focus();
        el.select();
      }
    });
  }
}
