/**
 * Credits: the in-app coins people buy in packs and spend on paid features.
 *
 * THIS FILE IS THE ONLY PLACE THAT PRICES A FEATURE OR A PACK. A new paid feature is one entry in
 * CREDIT_FEATURES; the server charges it by its key (`/api/credits/spend`, or its own endpoint for a
 * feature with a provider cost), the wallet lists it, and `tests/architecture/credits.test.ts` checks it
 * keeps its margin. The database stores what each use actually cost, so changing a price never rewrites
 * history. See docs/credits.md for the pricing calculation.
 */

import { IMAGE_REQUEST_TOKENS, imageGenerationCost } from './image-generation-cost';

/** The currencies packs are sold in. */
export const CREDIT_CURRENCIES = ['pln', 'eur', 'usd'] as const;
export type CreditCurrency = (typeof CREDIT_CURRENCIES)[number];

/** How a use is settled: `result` features reserve credits and keep them only when the result arrives
 * (an AI image: a failed generation gives them back); `immediate` features are final when used. */
export type CreditSettlement = 'result' | 'immediate';

export interface CreditFeature {
  readonly key: string;
  /** Shown in the wallet, on receipts and on the action. */
  readonly label: string;
  /** One line for the wallet: what a use gives. */
  readonly description: string;
  /** What one use is called when counting what credits buy ("30 AI images"). */
  readonly unit: { readonly one: string; readonly many: string };
  /** The wallet's icon for it, by name (presentation draws it). */
  readonly icon: 'sparkle' | 'sheet';
  /** Credits one paid use takes. */
  readonly cost: number;
  /** Uses that cost nothing, per person (the first technical drawings). */
  readonly freeUses: number;
  /** A use opens a pass: the same design again costs nothing for this many hours. 0: every use is charged. */
  readonly passHours: number;
  readonly settlement: CreditSettlement;
  /** What one use costs us at the provider, in US dollars (Google bills in dollars), for the margin guard (docs/credits.md). */
  readonly providerCost: { readonly typical: number; readonly worst: number };
}

export const CREDIT_FEATURES = [
  {
    key: 'ai-image', label: 'AI image', description: 'A photorealistic 2K image of your design in a finished room.',
    unit: { one: 'AI image', many: 'AI images' }, icon: 'sparkle',
    cost: 10, freeUses: 0, passHours: 0, settlement: 'result',
    // Nano Banana 2.1 at 2K with medium thinking, failed attempts included: about $0.074 usually, $0.155 at worst.
    providerCost: { typical: imageGenerationCost(IMAGE_REQUEST_TOKENS.typical), worst: imageGenerationCost(IMAGE_REQUEST_TOKENS.worst) },
  },
  {
    key: 'technical-drawings', label: 'Technical drawings',
    description: 'The full A3 drawing set and PDF of one design. Changes to that design stay free for 24 hours.',
    unit: { one: 'drawing set', many: 'drawing sets' }, icon: 'sheet',
    cost: 20, freeUses: 1, passHours: 24, settlement: 'immediate',
    providerCost: { typical: 0, worst: 0 },
  },
] as const satisfies readonly CreditFeature[];

export type CreditFeatureKey = (typeof CREDIT_FEATURES)[number]['key'];

export interface CreditPack {
  readonly id: string;
  readonly label: string;
  /** Credits the pack pays for, before the bonus. */
  readonly credits: number;
  readonly bonus: number;
  /** Price in each currency's minor unit (grosze, cents), VAT included where VAT is charged. */
  readonly prices: Readonly<Record<CreditCurrency, number>>;
  /** The pack the wallet suggests first. */
  readonly featured?: boolean;
}

/** Each pack has a price per currency: zloty in Poland, euro in the rest of the EU, dollars everywhere else
 * (credit-currency.ts picks one from the visitor's country). Round credit amounts, with the AI image at 10 credits, so
 * every pack keeps MINIMUM_MARGIN in every currency (unit-economics.ts): 8, 18, 48 and 100 AI images. */
export const CREDIT_PACKS = [
  { id: 'starter', label: 'Starter', credits: 80, bonus: 0, prices: { pln: 1999, eur: 499, usd: 499 } },
  { id: 'popular', label: 'Popular', credits: 150, bonus: 30, prices: { pln: 3999, eur: 999, usd: 999 }, featured: true },
  { id: 'pro', label: 'Pro', credits: 400, bonus: 80, prices: { pln: 9999, eur: 2499, usd: 2499 } },
  { id: 'studio', label: 'Studio', credits: 800, bonus: 200, prices: { pln: 19999, eur: 4999, usd: 4999 } },
] as const satisfies readonly CreditPack[];

export type CreditPackId = (typeof CREDIT_PACKS)[number]['id'];

export const creditFeature = (key: string): CreditFeature | undefined => CREDIT_FEATURES.find(f => f.key === key);
export const creditPack = (id: string): CreditPack | undefined => CREDIT_PACKS.find(p => p.id === id);
/** Credits a pack puts in the wallet. */
export const packCredits = (pack: CreditPack) => pack.credits + pack.bonus;

/** What a pack's credits buy of one feature ("30 AI images"). */
export const usesPerPack = (pack: CreditPack, feature: CreditFeature) => Math.floor(packCredits(pack) / feature.cost);

/** Percent saved per credit against the smallest pack's price, in one currency. */
export function packSaving(pack: CreditPack, currency: CreditCurrency): number {
  const base = CREDIT_PACKS[0], perCredit = (p: CreditPack) => p.prices[currency] / packCredits(p);
  return Math.max(0, Math.round((1 - perCredit(pack) / perCredit(base)) * 100));
}
