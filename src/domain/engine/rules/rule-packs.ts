import type { BuildModel } from '../build-model';
import { buildabilityPack } from './buildability-pack';
import { drillingPack } from './drilling-pack';
import { type Evaluation, type RulePack, evaluateRules } from './engine-rules';
import { engineeringPack } from './engineering-pack';
import { manufacturingPack } from './manufacturing-pack';

/**
 * Every rule pack the engine runs, in the order their findings are listed within a severity. TO ADD A PACK (a country's
 * standard, a hardware maker's rules, a workshop's limits): write one module in this folder that returns EngineFindings
 * from the build model, and add it here. tests/architecture/engine-rules.test.ts runs every pack over the fixtures.
 */
export const RULE_PACKS: readonly RulePack[] = [manufacturingPack, drillingPack, buildabilityPack, engineeringPack];

/** Every finding on the model, from every pack. */
export const evaluate = (model: BuildModel, packs: readonly RulePack[] = RULE_PACKS): Evaluation => evaluateRules(model, packs);
