import { findingRule, type AssemblyGate } from '../../domain/engine/assembly-gate';
import type { CutLayout } from '../../domain/make/make-cut-layout';
import type { MakePiece } from '../../domain/make/make-parts';
import { saveFile } from '../components/save-file';
import { planFor } from './assembly-plan-text';
import { cutListCsv, makePdf, partsListCsv } from './make-export';
import { gateView } from './make-panel';
import type { StepPicture } from './make-pictures';
import type { MakeViewPorts } from './make-view.ports';

/**
 * What leaves Make: the assembly film and the paper. Both pass one gate (domain/engine/assembly-gate.ts): while
 * anything blocks building the piece, Assembly does not open and nothing is saved to cut or order from; the panel
 * lists what to fix instead, each with the rule it breaks.
 */
export type Wanted = 'assembly' | 'drawings';
type SaveOutcome = 'requested' | 'saved' | 'gate_blocked' | 'not_paid' | 'piece_changed' | 'failed';

interface Host {
  readonly ports: Pick<MakeViewPorts, 'gate' | 'openCheck' | 'pay' | 'note' | 'scene'>;
  /** The piece Make has open, and its id in the scene; null when Make is closed. */
  piece(): { readonly piece: MakePiece; readonly id: number } | null;
  /** Shows the panel's list, where the closed gate is drawn. */
  showList(): void;
  /** Takes the piece apart again from the design as it is now. */
  rebuild(): void;
  /** Opens Assembly Studio (which asks the gate itself). */
  assemble(): void;
}

export function createMakeGate(host: Host) {
  let shut: { gate: AssemblyGate; wanted: Wanted } | null = null;
  /** True when nothing blocks building the piece; otherwise the panel shows what does. */
  function passes(wanted: Wanted): boolean {
    const open = host.piece(), gate = open ? host.ports.gate?.(open.id) : undefined;
    if (!gate || gate.open) { shut = null; return true; }
    shut = { gate, wanted };
    const rules = [...new Set(gate.blockers.map(findingRule))], packs = [...new Set(gate.blockers.map(f => f.pack))];
    host.ports.note?.({ kind: 'gate', wanted, blockers: gate.blockers.length, notes: gate.notes.length, packs, rules });
    host.showList();
    return false;
  }
  return {
    passes,
    get shut() { return shut; },
    clear() { shut = null; },
    /** The closed gate as the panel's body. */
    markup: (piece: MakePiece) => shut ? gateView(shut.gate, piece, shut.wanted) : '',
    /** A click in the closed gate; true when it was one of its buttons. */
    click(target: Element): boolean {
      if (target.closest('[data-gate-check]')) {
        host.ports.note?.({ kind: 'gate_action', action: 'open_check', wanted: shut?.wanted ?? 'assembly', open: false });
        host.ports.openCheck?.(); return true;
      }
      if (!target.closest('[data-gate-retry]')) return false;
      const wanted = shut?.wanted ?? 'assembly';
      host.rebuild();
      if (wanted === 'assembly') host.assemble(); else if (passes(wanted)) host.showList();
      host.ports.note?.({ kind: 'gate_action', action: 'retry', wanted, open: !shut });
      return true;
    },
    /** Saves the piece's drawings (PDF, with each step's pictures taken from the film) or cut list (CSV): part of the
     * paid drawing set, and only for a piece that can be built. */
    async save(kind: 'pdf' | 'csv' | 'parts', doc: Document, band: number, material: (decorId: string) => string, cut: () => CutLayout, pictures: () => readonly StepPicture[]) {
      const open = host.piece();
      if (!open) return;
      const note = (outcome: SaveOutcome) => host.ports.note?.({ kind: 'export', format: kind, parts: open.piece.parts.length, outcome });
      note('requested');
      // The parts list is free (no account, no credits); the cut list and the drawings are the paid set.
      if (!passes('drawings')) { note('gate_blocked'); return; }
      if (kind !== 'parts' && !await host.ports.pay()) { note('not_paid'); return; }
      if (host.piece()?.piece !== open.piece) { note('piece_changed'); return; }
      const { piece, id } = open, title = host.ports.scene().wardrobes.find(c => c.id === id)?.name || 'Piece';
      const name = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'piece';
      try {
        const blob = kind === 'pdf'
          ? new Blob([makePdf(piece, { title, material, band, cut: cut(), pictures: pictures(), plan: planFor(piece, host.ports.scene()) }).buffer as ArrayBuffer], { type: 'application/pdf' })
          : new Blob([kind === 'parts' ? partsListCsv(piece, material) : cutListCsv(piece, material, band)], { type: 'text/csv' });
        await saveFile(doc, `${name}-${kind === 'pdf' ? 'make.pdf' : kind === 'parts' ? 'parts.csv' : 'cut-list.csv'}`, blob);
      } catch (e) { note('failed'); throw e; }
      note('saved');
    },
  };
}
