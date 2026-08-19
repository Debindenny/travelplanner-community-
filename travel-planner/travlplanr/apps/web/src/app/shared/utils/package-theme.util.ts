/** Turn API values like `europe-theme` into user-facing labels. */
export function humanizePackageTheme(theme: string): string {
  if (!theme?.trim()) return '';
  const cleaned = theme
    .replace(/-theme$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!cleaned) return '';
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}
