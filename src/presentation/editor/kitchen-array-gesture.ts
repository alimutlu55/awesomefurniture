import * as THREE from 'three';
import { arrayCount, runReach } from '../../domain/kitchen/kitchen-runs';
import { isKitchen } from '../../domain/furniture/furniture';
import { hasTrait } from '../../domain/wardrobe/fittings';
import type { EditorScene } from '../../application/projects/editor-scene';

type Side = 1 | -1;
interface KitchenArrayPorts {
  readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
  readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'scene' | 'activeCabinet' | 'snapshot' | 'restore'>;
  readonly sceneCommands: Readonly<Pick<ReturnType<typeof import('../../application/commands/scene-commands').createSceneCommands>, 'arrayKitchenUnit'>>;
  readonly history: { checkpoint(snapshot: string): void };
  /** The editor lifetime's timers (editor-lifetime.js), so a pending hold stops with the editor. */
  readonly lifetime: { timeout(fn: () => void, delay: number): unknown; cancelTimeout(id: never): void };
  readonly picking: { screenPoint(point: THREE.Vector3): { x: number; y: number } };
  readonly renderState: { Gr: THREE.Object3D | null; labs: { p: THREE.Vector3; el: HTMLElement; owner?: THREE.Object3D }[] };
  readonly callbacks: {
    /** Rebuilds the model with the copies so far (the worktop and plinth follow). */
    rebuild(): void;
    /** After the pull: refresh panels and history buttons. */
    finished(): void;
    /** Copies were kept: show the whole run, new cabinets included. */
    added(): void;
    toast(message: string): void;
    /** A copy came or went: a light tick where the device can. */
    tick(count: number): void;
  };
}

/** How long a finger rests on a selected kitchen unit before sliding it pulls out copies instead of moving it. */
export const HOLD_MS = 450;

/**
 * Pull-to-array for kitchen units. A selected unit shows a grip on each side; pulling one lays copies of the unit
 * along its run, one more each time the pull passes most of a unit's width, and lets go of them when pulled back.
 * A long press on the unit, then a slide, does the same towards the side it slides to. The copies are real
 * units from the first moment, so the worktop and plinth extend over them as they appear; letting go keeps them
 * as one undo step, Escape or a cancelled pointer puts everything back. Copies get plain storage in place of an
 * appliance (see domain/kitchen/kitchen-design.ts).
 */
export function createKitchenArrayGesture({ dom, model, sceneCommands, history, lifetime, picking, renderState, callbacks }: KitchenArrayPorts) {
  const grips = new Map<Side, HTMLButtonElement>();
  let gesture: { snapshot: string; id: number; side: Side | 0; axis: { x: number; y: number }; x: number; y: number; count: number; grip?: HTMLButtonElement } | null = null;
  let hold: { timer: unknown; x: number; y: number } | null = null;

  /** Pixels on screen per centimetre along the unit's width, from its front centre. */
  function screenAxis() {
    const c = model.activeCabinet(), Gr = renderState.Gr;
    if (!Gr) return { x: 0, y: 0 };
    const a = picking.screenPoint(Gr.localToWorld(new THREE.Vector3(0, c.state.h / 2, c.state.d / 2)));
    const b = picking.screenPoint(Gr.localToWorld(new THREE.Vector3(50, c.state.h / 2, c.state.d / 2)));
    return { x: (b.x - a.x) / 50, y: (b.y - a.y) / 50 };
  }
  function begin(x: number, y: number, side: Side | 0, grip?: HTMLButtonElement) {
    const unit = model.activeCabinet();
    if (!isKitchen(unit.state)) return false;
    gesture = { snapshot: model.snapshot(), id: unit.id, side, axis: screenAxis(), x, y, count: 0, ...(grip ? { grip } : {}) };
    grip?.classList.add('pulling');
    // A long press has turned into a pull: a tick tells the finger.
    if (!side) callbacks.tick(0);
    return true;
  }
  /** Follows the pointer: the copies so far, rebuilt only when their number changes. */
  function move(x: number, y: number) {
    const g = gesture;
    if (!g) return;
    const length = g.axis.x * g.axis.x + g.axis.y * g.axis.y;
    if (length < 1e-6) return;
    const along = ((x - g.x) * g.axis.x + (y - g.y) * g.axis.y) / length;
    if (!g.side) {
      if (Math.abs(along) < 10) return;
      g.side = along > 0 ? 1 : -1;
    }
    const width = model.activeCabinet().state.w, wanted = arrayCount(Math.max(0, along * g.side), width);
    if (wanted === g.count) return;
    model.restore(g.snapshot);
    model.scene.activeWardrobe = g.id;
    g.count = wanted ? sceneCommands.arrayKitchenUnit(wanted, g.side, false) : 0;
    if (g.grip) g.grip.dataset.count = g.count ? '+' + g.count : '';
    callbacks.tick(g.count);
    callbacks.rebuild();
  }
  /** Keeps the copies as one undo step, or puts the scene back. */
  function end(cancel = false) {
    const g = gesture;
    if (!g) return;
    gesture = null;
    g.grip?.classList.remove('pulling');
    if (g.grip) delete g.grip.dataset.count;
    if (cancel || !g.count) {
      if (g.count) { model.restore(g.snapshot); callbacks.rebuild(); }
      callbacks.finished();
      return;
    }
    history.checkpoint(g.snapshot);
    const original = (JSON.parse(g.snapshot) as EditorScene).wardrobes.find(w => w.id === g.id);
    const appliance = original?.state.secs.flat().some(it => hasTrait(it.k, 'appliance'));
    callbacks.toast(g.count + (g.count === 1 ? ' cabinet' : ' cabinets') + ' added' + (appliance ? ', with plain storage in place of the appliances' : ''));
    callbacks.finished();
    callbacks.added();
  }

  function grip(side: Side) {
    let el = grips.get(side);
    if (el) return el;
    el = dom.document.createElement('button');
    el.type = 'button';
    el.className = 'lbl array-grip';
    el.dataset.side = side > 0 ? 'right' : 'left';
    el.setAttribute('aria-label', 'Pull to add cabinets on the ' + (side > 0 ? 'right' : 'left'));
    el.title = 'Drag outwards to add copies of this cabinet · Click to add one';
    el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>';
    const button = el;
    button.onpointerdown = e => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      if (begin(e.clientX, e.clientY, side, button)) button.setPointerCapture(e.pointerId);
    };
    button.onpointermove = e => { if (gesture?.grip === button && button.hasPointerCapture(e.pointerId)) move(e.clientX, e.clientY); };
    button.onpointerup = e => {
      if (gesture?.grip !== button) return;
      if (button.hasPointerCapture(e.pointerId)) button.releasePointerCapture(e.pointerId);
      // A click without a pull adds one copy on that side.
      if (!gesture.count) gesture.count = sceneCommands.arrayKitchenUnit(1, side, false);
      end();
    };
    button.onpointercancel = () => end(true);
    button.onkeydown = e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (begin(0, 0, side)) { gesture!.count = sceneCommands.arrayKitchenUnit(1, side, false); end(); }
    };
    grips.set(side, button);
    return button;
  }

  return {
    /** Before a rebuild: the grips show again only if `place` is called for a selected kitchen unit. They are
     * kept across rebuilds, so a pull keeps its pointer while the copies are rebuilt under it. */
    beginBuild() {
      for (const el of grips.values()) { el.hidden = true; el.style.display = 'none'; }
    },
    /** Puts the grips at the two ends of the selected unit's run, at its height: pulling makes the run longer. */
    place() {
      const c = model.activeCabinet(), owner = renderState.Gr;
      if (!isKitchen(c.state) || !owner) return;
      const reach = runReach(model.scene.wardrobes, c);
      for (const side of [-1, 1] as const) {
        const el = grip(side);
        el.hidden = false;
        if (!el.isConnected) dom.$('#labels').appendChild(el);
        renderState.labs.push({ p: new THREE.Vector3(reach[side > 0 ? 1 : 0] + side * 6, c.state.h * .55, c.state.d / 2), el, owner });
      }
    },
    active: () => !!gesture,
    begin, move, end,
    /** A finger or button rests on the selected kitchen unit: after a moment, sliding pulls out copies. */
    holdStart(x: number, y: number, started: () => void) {
      this.holdCancel();
      if (!isKitchen(model.activeCabinet().state)) return;
      hold = { x, y, timer: lifetime.timeout(() => { hold = null; if (begin(x, y, 0)) started(); }, HOLD_MS) };
    },
    /** The pointer moved off before the hold completed: it is an ordinary drag. */
    holdMoved(x: number, y: number) { if (hold && Math.hypot(x - hold.x, y - hold.y) > 5) this.holdCancel(); },
    holdCancel() { if (hold) lifetime.cancelTimeout(hold.timer as never); hold = null; },
    dispose() { this.holdCancel(); for (const el of grips.values()) el.remove(); grips.clear(); },
  };
}
