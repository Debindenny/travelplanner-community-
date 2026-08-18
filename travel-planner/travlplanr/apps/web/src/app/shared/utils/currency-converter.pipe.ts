import { Pipe, PipeTransform, inject } from '@angular/core';
import { LocaleService, CURRENCY_SYMBOLS } from '../../core/services/locale.service';
import { formatCurrency } from '@angular/common';

/**
 * Display-only currency formatter. Amounts must already be in the user's
 * selected currency (converted server-side via X-Currency). This pipe never
 * multiplies by exchange rates.
 */
@Pipe({
  name: 'appCurrency',
  standalone: true,
  pure: false, // Impure so templates refresh when LocaleService.currentCurrency changes
})
export class CurrencyConverterPipe implements PipeTransform {
  private readonly localeService = inject(LocaleService);

  transform(
    value: number | string | null | undefined,
    digitsInfo: string = '1.0-0'
  ): string | null {
    if (value == null || value === '') return null;

    const currency = this.localeService.currentCurrency();
    const targetSymbol = CURRENCY_SYMBOLS[currency] || '$';

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return null;
      return formatCurrency(value, 'en-US', targetSymbol, currency, digitsInfo);
    }

    if (typeof value === 'string') {
      // Strip any leading currency symbol / grouping so we format the bare amount.
      const cleaned = value
        .replace(/^[₹$€]\s*/, '')
        .replace(/[,\s\u00a0]/g, '');
      const num = parseFloat(cleaned);
      if (!Number.isFinite(num)) return String(value);
      return formatCurrency(num, 'en-US', targetSymbol, currency, digitsInfo);
    }

    return String(value);
  }
}
