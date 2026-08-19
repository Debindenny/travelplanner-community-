/** Airline display helpers — avoid external logo CDNs (Clearbit is unreliable/offline). */

const AIRLINE_IATA: Record<string, string> = {
  'air france': 'AF',
  emirates: 'EK',
  delta: 'DL',
  lufthansa: 'LH',
  'singapore airlines': 'SQ',
  'qatar airways': 'QR',
  'air india': 'AI',
  indigo: '6E',
  'british airways': 'BA',
  'american airlines': 'AA',
  'turkish airlines': 'TK',
  'air europa': 'UX',
  vueling: 'VY',
};

export function airlineIataCode(carrier: string): string {
  const key = carrier.toLowerCase().trim();
  if (AIRLINE_IATA[key]) return AIRLINE_IATA[key];
  const words = carrier.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return carrier.slice(0, 2).toUpperCase() || 'FL';
}

/** Only block known-dead logo hosts (Clearbit); allow other provider https:// URLs. */
export function safeAirlineLogoUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.toLowerCase().includes('clearbit.com')) return undefined;
  return url;
}

/** Bundled airline logo assets we actually ship, keyed by normalized carrier name. */
const AIRLINE_LOGO_ASSETS: Record<string, string> = {
  emirates: 'assets/airline-logos/emirates-218344.png',
  'air france': 'assets/airline-logos/air-france.png',
  'qatar airways': 'assets/airline-logos/qatar-airways-c2f42c.png',
  qatar: 'assets/airline-logos/qatar-airways-c2f42c.png',
  'srilankan airlines': 'assets/airline-logos/srilankan-airlines-1447bd.png',
  srilankan: 'assets/airline-logos/srilankan-airlines-1447bd.png',
};

/** Resolve a bundled airline logo for a carrier, if we ship one. */
export function airlineLogoAsset(carrier?: string | null): string | undefined {
  if (!carrier) return undefined;
  return AIRLINE_LOGO_ASSETS[carrier.toLowerCase().trim()];
}
