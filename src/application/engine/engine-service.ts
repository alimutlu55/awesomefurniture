import type { CreditCurrency } from '../../domain/credits/credit-catalog';
import type { DrawingInput } from '../../domain/drawings/room-pieces';
import { type Inspection, inspect } from '../../domain/engine/inspect';
import { buildModel } from '../../domain/engine/build-model';
import { BUILDER_PROFILES } from '../../domain/engine/catalog/builder-profiles';
import { type Quote, quote } from '../../domain/engine/catalog/quote';
import { type SceneChange, diffScenes } from '../../domain/engine/scene-diff';
import type { EditorScene } from '../projects/editor-scene';
import { NO_EVENTS, type ProductEvents } from '../ports/product-events';
import { drawingInputOf } from './scene-input';

/**
 * The engine as the editor uses it: inspects the scene when the design changes (not when only the selection does),
 * keeps the latest inspection (findings and passport at once; prices under each builder profile only when asked for),
 * and records what changed between inspections as the design's change history. Every change, and every change in what
 * the rules find, is reported as a product event.
 */

export interface ChangeEntry {
  /** Milliseconds since the epoch. */
  readonly at: number;
  readonly revision: string;
  readonly changes: readonly SceneChange[];
}

export interface EngineServicePorts {
  readonly currency: () => CreditCurrency;
  readonly events?: ProductEvents | undefined;
  readonly now?: (() => number) | undefined;
  /** Change history entries kept; older ones are dropped. */
  readonly limit?: number | undefined;
}

export interface EngineService {
  /** The latest inspection, or null before the first refresh. */
  current(): Inspection | null;
  /** A cheap key for the design as the engine sees it: selection and open panels do not change it. */
  keyOf(scene: EditorScene): string;
  /** Inspects the scene if the design (or the currency) changed since the last inspection; true when it did. */
  refresh(scene: EditorScene): boolean;
  /** What changed, oldest first. */
  history(): readonly ChangeEntry[];
  /** The latest design priced under every builder profile; worked out when first asked for after a change. */
  quotes(): readonly Quote[];
}

/** The scene as the engine reads it, without the editing context (selection, open doors) the mapper strips too. */
export function designInput(scene: EditorScene): DrawingInput {
  const input = drawingInputOf(scene);
  return { ...input, pieces: input.pieces.map(p => {
    const { sel: _sel, item: _item, divider: _divider, space: _space, open: _open, ...design } = p.design as typeof p.design & Record<string, unknown>;
    return { ...p, design: design as typeof p.design };
  }) };
}

export function createEngineService({ currency, events = NO_EVENTS, now = Date.now, limit = 100 }: EngineServicePorts): EngineService {
  let last: { key: string; input: DrawingInput; inspection: Inspection; currency: CreditCurrency; quotes?: readonly Quote[] } | null = null;
  const log: ChangeEntry[] = [];
  const keyOf = (scene: EditorScene) => JSON.stringify(designInput(scene));

  function report(before: Inspection | null, after: Inspection, changes: readonly SceneChange[]) {
    for (const kind of new Set(changes.map(c => c.kind))) events.track('design_changed', { kind });
    const a = before?.evaluation.counts, b = after.evaluation.counts;
    if (!a || a.blocking !== b.blocking || a.warning !== b.warning) {
      events.track('findings', { blocking: b.blocking, warning: b.warning, advice: b.advice, ready: after.evaluation.ready });
    }
  }

  return {
    current: () => last?.inspection ?? null,
    keyOf,
    refresh(scene) {
      const input = designInput(scene), key = JSON.stringify(input) + '|' + currency();
      if (last?.key === key) return false;
      const inspection = inspect(input, { currency: currency(), profiles: [] }), changes = last ? diffScenes(last.input, input) : [];
      if (changes.length) {
        log.push({ at: now(), revision: inspection.model.revision, changes });
        if (log.length > limit) log.splice(0, log.length - limit);
      }
      report(last?.inspection ?? null, inspection, changes);
      last = { key, input, inspection, currency: currency() };
      return true;
    },
    history: () => log,
    quotes() {
      if (!last) return [];
      last.quotes ??= BUILDER_PROFILES.map(profile => quote(buildModel(last!.input, { construction: profile.construction }), profile, last!.currency));
      return last.quotes;
    },
  };
}
