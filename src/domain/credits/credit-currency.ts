import type { CreditCurrency } from './credit-catalog';

/** EU member states other than Poland (ISO 3166-1 alpha-2): they pay in euro, with EU VAT. */
const EU_COUNTRIES = new Set(['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT',
  'LU', 'MT', 'NL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']);

/** The currency a visitor buys in, from the country Cloudflare reports: zloty in Poland, euro in the rest of the EU,
 * dollars everywhere else and when the country is not known. */
export function currencyForCountry(country: string | null | undefined): CreditCurrency {
  const code = country?.trim().toUpperCase();
  if (code === 'PL') return 'pln';
  return code && EU_COUNTRIES.has(code) ? 'eur' : 'usd';
}
