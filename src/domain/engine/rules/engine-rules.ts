import type { Construction } from '../../make/make-construction';
import type { BuildModel } from '../build-model';

/**
 * One rule engine for everything that can be wrong with a design: whether it can be manufactured, drilled and
 * assembled, and whether it carries what is planned for it. Each concern is a rule pack (one module in this folder, one
 * line in RULE_PACKS in rule-packs.ts) that reads the build model and returns findings in one shape: how serious, what
 * and why, where on the model, what was measured against which limit, and the fixes the editor can apply.
 *
 * Findings are data, never markup: the presentation writes them, the planner and agents read them.
 */

export type Severity = 'blocking' | 'warning' | 'advice';
export const SEVERITIES: readonly Severity[] = ['blocking', 'warning', 'advice'];

export type RulePackKey = 'manufacturing' | 'drilling' | 'engineering';

/** A change the editor can make for a finding. */
export type FixAction =
  /** Select the piece and frame it. */
  | { readonly kind: 'select-piece'; readonly piece: number }
  /** Split bay `bay` (from 0 on the left) in two with a partition under its middle, keeping its layout on both sides. */
  | { readonly kind: 'split-bay'; readonly piece: number; readonly bay: number }
  /** Build the piece with other joints or another back. */
  | { readonly kind: 'set-construction'; readonly piece: number; readonly construction: Partial<Construction> };

export interface Fix { readonly label: string; readonly action: FixAction }

export interface Measure { readonly value: number; readonly unit: 'mm' | 'kg' | '%' }

export interface EngineFinding {
  /** Stable across evaluations of the same model. */
  readonly id: string;
  readonly pack: RulePackKey;
  readonly severity: Severity;
  /** What is wrong, in a short sentence ("W1 Shelf bends 4.6 mm under 18 kg"). */
  readonly title: string;
  /** The rule it breaks and why it matters. */
  readonly why: string;
  /** The piece (scene id) and its mark on the drawings; the board in its Make board list. */
  readonly piece?: number | undefined;
  readonly mark?: string | undefined;
  readonly board?: number | undefined;
  readonly measured?: Measure | undefined;
  readonly limit?: Measure | undefined;
  readonly fixes: readonly Fix[];
}

export interface RulePack {
  readonly key: RulePackKey;
  readonly label: string;
  readonly evaluate: (model: BuildModel) => readonly EngineFinding[];
}

export interface Evaluation {
  readonly revision: string;
  readonly findings: readonly EngineFinding[];
  /** No blocking finding: the design may be issued for manufacture. */
  readonly ready: boolean;
  readonly counts: Readonly<Record<Severity, number>>;
}

const RANK: Readonly<Record<Severity, number>> = { blocking: 0, warning: 1, advice: 2 };

/** Runs every pack over the model: findings most serious first, in a stable order within a severity. */
export function evaluateRules(model: BuildModel, packs: readonly RulePack[]): Evaluation {
  const findings = packs.flatMap(p => p.evaluate(model)).map((f, i) => ({ f, i }))
    .sort((a, b) => RANK[a.f.severity] - RANK[b.f.severity] || a.i - b.i).map(x => x.f);
  const counts = { blocking: 0, warning: 0, advice: 0 };
  for (const f of findings) counts[f.severity]++;
  return { revision: model.revision, findings, ready: counts.blocking === 0, counts };
}

/** The piece's scene id and mark for a mark on the drawings. */
export function pieceOfMark(model: BuildModel, mark: string | undefined): { piece?: number; mark?: string } {
  const placed = mark ? model.placed.find(p => p.mark === mark) : undefined;
  return placed ? { piece: placed.id, mark: placed.mark } : mark ? { mark } : {};
}

/** The fix that selects a piece, for every finding about one. */
export const showPiece = (piece: number): Fix => ({ label: 'Show', action: { kind: 'select-piece', piece } });
