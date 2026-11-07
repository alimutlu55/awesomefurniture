import { CREDIT_CURRENCIES, CREDIT_FEATURES, CREDIT_PACKS, type CreditCurrency, type CreditFeature } from '../../domain/credits/credit-catalog';

/** Pricing page lines, read from the credit catalog so the page always shows what the studio sells. */

/** A price the way its buyers write it, fixed to one locale per currency so every build prints the same page. */
const price = (minor: number, currency: CreditCurrency) =>
  new Intl.NumberFormat(currency === 'pln' ? 'pl-PL' : 'en-GB', { style: 'currency', currency: currency.toUpperCase() })
    .format(minor / 100);

export const creditPackList = (): string[] => CREDIT_PACKS.map(pack => {
  const credits = pack.bonus ? `${pack.credits} + ${pack.bonus} bonus credits` : `${pack.credits} credits`;
  const prices = CREDIT_CURRENCIES.map(c => price(pack.prices[c], c)).join(' / ');
  return `${pack.label}: ${credits} for ${prices}.`;
});

export const creditUseLines = (): string[] => CREDIT_FEATURES.map((feature: CreditFeature) => {
  const free = feature.freeUses ? ` Your first ${feature.freeUses === 1 ? feature.unit.one : `${feature.freeUses} ${feature.unit.many}`} is free.` : '';
  const pass = feature.passHours ? ` Changes to the same design stay free for ${feature.passHours} hours.` : '';
  return `${feature.label}: ${feature.cost} credits each.${free}${pass}`;
});
