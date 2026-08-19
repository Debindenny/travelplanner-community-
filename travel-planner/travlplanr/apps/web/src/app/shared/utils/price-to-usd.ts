/**
 * Sum helper for itinerary budget math.
 *
 * Prices are converted server-side to the user's display currency (X-Currency).
 * This no longer performs FX — it only coerces a finite positive number.
 */
export function priceToUsd(item: { price?: number; currency?: string; provider?: string; type?: string }): number {
  const price = Number(item?.price);
  if (!Number.isFinite(price) || price <= 0) return 0;
  return price;
}

/** Rounded display amount as `$1,234`-style using the item's currency symbol when present. */
export function formatUsdCost(item: { price?: number; currency?: string; provider?: string; type?: string }): string | undefined {
  const amount = priceToUsd(item);
  if (amount <= 0) return undefined;
  const currency = String(item?.currency || '').toUpperCase();
  const symbol = currency === 'INR' ? '₹' : currency === 'EUR' ? '€' : '$';
  return `${symbol}${Math.round(amount).toLocaleString()}`;
}
