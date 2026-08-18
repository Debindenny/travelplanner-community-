import { ChangeDetectionStrategy, Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';

@Component({
    selector: 'app-text-input',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NgClass, ReactiveFormsModule],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => TextInputComponent),
            multi: true
        }
    ],
    template: `
    <div class="flex flex-col gap-1.5 w-full">
      @if (label) {
        <label
          [attr.for]="inputId"
          class="text-xs font-bold text-text-secondary dark:text-gray-300 uppercase tracking-wider select-none"
        >
          {{ label }}
          @if (required) {
            <span class="text-rose-500 ml-0.5 font-sans">*</span>
          }
        </label>
      }

      <div class="relative w-full">
        <input
          [attr.id]="inputId"
          [type]="type"
          [placeholder]="placeholder"
          [disabled]="disabled"
          [value]="value"
          (input)="onInput($event)"
          (blur)="onBlur()"
          class="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm text-text-primary dark:text-white placeholder:text-text-disabled dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          [ngClass]="{
            'border-rose-500 focus:ring-rose-500 focus:border-transparent': error
          }"
        />
      </div>

      @if (error) {
        <span class="text-[10px] font-bold text-rose-500 uppercase tracking-wide">
          {{ error }}
        </span>
      } @else if (helperText) {
        <span class="text-[10px] text-text-tertiary dark:text-gray-500">
          {{ helperText }}
        </span>
      }
    </div>
  `
})
export class TextInputComponent implements ControlValueAccessor {
  private static nextId = 0;

  @Input() label?: string;
  @Input() type: 'text' | 'email' | 'password' | 'number' | 'tel' = 'text';
  @Input() placeholder = '';
  @Input() required = false;
  @Input() error?: string;
  @Input() helperText?: string;
  @Input() inputId = `app-input-${TextInputComponent.nextId++}`;

  value: any = '';
  disabled = false;

  onChange: any = () => {};
  onTouched: any = () => {};

  writeValue(value: any): void {
    this.value = value || '';
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.value = target.value;
    this.onChange(this.value);
  }

  onBlur(): void {
    this.onTouched();
  }
}
