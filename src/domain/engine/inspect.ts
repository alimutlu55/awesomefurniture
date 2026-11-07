import type { CreditCurrency } from '../credits/credit-catalog';
import type { DrawingInput } from '../drawings/room-pieces';
import { type BuildModel, buildModel } from './build-model';
import { BUILDER_PROFILES, type BuilderProfile } from './catalog/builder-profiles';
import { type Quote, quote } from './catalog/quote';
import { type Passport, passport } from './passport';
import type { Evaluation } from './rules/engine-rules';
import { evaluate } from './rules/rule-packs';

/**
 * The engine's front door: a scene in, everything the engine knows about it out. The editor, agents and tests all call
 * this, so they see the same model, the same findings and the same prices.
 *
 * - `model`, `passport` and `evaluation` are the design as it stands (each piece with its own construction);
 * - `quotes` are the design built under each builder profile, each from the model lowered with that profile.
 */
export interface Inspection {
  readonly model: BuildModel;
  readonly passport: Passport;
  readonly evaluation: Evaluation;
  readonly quotes: readonly Quote[];
}

export interface InspectOptions {
  readonly currency?: CreditCurrency | undefined;
  readonly profiles?: readonly BuilderProfile[] | undefined;
}

export function inspect(input: DrawingInput, options: InspectOptions = {}): Inspection {
  const model = buildModel(input), currency = options.currency ?? 'eur';
  const quotes = (options.profiles ?? BUILDER_PROFILES).map(profile => quote(buildModel(input, { construction: profile.construction }), profile, currency));
  return { model, passport: passport(model), evaluation: evaluate(model), quotes };
}
