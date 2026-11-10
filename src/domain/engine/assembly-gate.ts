import type { EngineFinding, Evaluation } from './rules/engine-rules';

/**
 * The gate into assembly. A piece goes to the assembly bench only when nothing blocks building it: every blocking
 * finding about it (the manufacturing check, drilling that cannot be made, buildability) must be cleared first, and so
 * must any that names no piece (a problem with the design as a whole). Warnings and advice are shown, and do not close
 * the gate. One rule for every way in: the Assembly tool, a part's stage link, the steps on paper.
 */
export interface AssemblyGate {
  /** Nothing blocks: the piece may be opened in assembly. */
  readonly open: boolean;
  /** What must be fixed first, most serious first as the evaluation lists them. */
  readonly blockers: readonly EngineFinding[];
  /** What to know before starting, but which does not stop it. */
  readonly notes: readonly EngineFinding[];
}

export function assemblyGate(evaluation: Evaluation, piece: number): AssemblyGate {
  const about = (f: EngineFinding) => f.piece === piece || f.piece === undefined && f.mark === undefined;
  const mine = evaluation.findings.filter(about), blockers = mine.filter(f => f.severity === 'blocking');
  return { open: blockers.length === 0, blockers, notes: mine.filter(f => f.severity !== 'blocking') };
}
