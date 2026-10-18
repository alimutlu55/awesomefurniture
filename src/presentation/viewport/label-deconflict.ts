/** Keeps in-scene measurements readable: after every label is placed, a measurement that would sit on a control (an
 * item handle, the + buttons, the toolbar and the top bars) or on another measurement is nudged to the nearest free spot
 * beside its own line. It runs right after positionLabels has written each label's transform for this frame, and
 * appends the nudge to that transform, so nothing accumulates between frames. Controls never move; a read-only figure
 * that finds no free spot is hidden for that frame rather than left on top of something. */

/** Measurements that may be nudged, most important first: what is being dragged, then sizes, then gaps. */
const MOVABLE = ['.assist-size', '.assist-gap', '.item-dimension', '.clearance', '.rail-height', '.space-ruler', '.dim:not(.hover-dim):not(.reach-dimension)'];
/** Things a measurement must never cover. */
const FIXED = '.item-resize-handle:not([hidden]), .lbl.add, .lbl.shape-handle, .lbl.array-grip, .ground-rotate, .wardrobe-actions, [data-editor-id="toolbar"], '
  + '[data-editor-id="view-modes"], [data-editor-id="topright"], [data-editor-id="topleft"], [data-editor-id="bl"], [data-editor-id="br"]';
const GAP = 3;

interface Box { left: number; top: number; right: number; bottom: number }
const hits = (a: Box, b: Box) => a.left < b.right + GAP && b.left < a.right + GAP && a.top < b.bottom + GAP && b.top < a.bottom + GAP;
const shifted = (b: Box, dx: number, dy: number): Box => ({ left: b.left + dx, right: b.right + dx, top: b.top + dy, bottom: b.bottom + dy });
const shown = (el: HTMLElement) => el.style.display !== 'none' && !el.hidden && el.offsetParent !== null;
/** Where this frame placed an element, from the transform it was just given (`translate(-50%,-50%) translate(x,y)`),
 * not from layout: under reduced motion every change is a very short transition, so layout still reports the
 * previous frame. Falls back to layout for anything placed another way. */
function placed(el: HTMLElement, bounds: DOMRect): Box {
  const m = /translate\(-50%,\s*-50%\)\s*translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)(?:\s*scale\((-?[\d.]+)\))?/.exec(el.style.transform);
  if (!m) return el.getBoundingClientRect();
  const k = Number(m[3] ?? 1), w = el.offsetWidth * k, h = el.offsetHeight * k, x = bounds.left + Number(m[1]), y = bounds.top + Number(m[2]);
  return { left: x - w / 2, right: x + w / 2, top: y - h / 2, bottom: y + h / 2 };
}

/** @param labels The `#labels` layer. @param bounds The canvas's client rectangle. */
export function deconflictLabels(labels: HTMLElement, bounds: DOMRect): void {
  const movable: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  for (const selector of MOVABLE) {
    for (const el of labels.querySelectorAll<HTMLElement>('.lbl' + selector)) {
      if (seen.has(el)) continue;
      seen.add(el);
      if (shown(el) && !el.classList.contains('hover-dim')) movable.push(el);
    }
  }
  if (!movable.length) return;
  // Item handles live beside the labels layer, so look through the whole editor scope.
  const scope = labels.getRootNode() as Document | ShadowRoot;
  const taken: Box[] = [...scope.querySelectorAll<HTMLElement>(FIXED)].filter(shown).map(el => placed(el, bounds));
  const inside = (b: Box) => b.left >= bounds.left + 4 && b.right <= bounds.right - 4 && b.top >= bounds.top + 4 && b.bottom <= bounds.bottom - 4;
  for (const el of movable) {
    const box = placed(el, bounds), w = box.right - box.left, h = box.bottom - box.top;
    // Prefer staying where it is, then the nearest free spot: first along its own line, then a row up or down.
    const xs = [0, w / 2 + 8, -(w / 2 + 8), w + 12, -(w + 12), 1.5 * w + 20, -(1.5 * w + 20)], ys = [0, -(h + 4), h + 4, -2 * (h + 4), 2 * (h + 4), -3 * (h + 4), 3 * (h + 4)];
    const steps = xs.flatMap(dx => ys.map(dy => [dx, dy] as const)).sort((p, q) => Math.hypot(p[0], p[1] * 1.6) - Math.hypot(q[0], q[1] * 1.6));
    // A gap figure belongs to its line: it may only slide along the line's height, never float off it to another place.
    const allowed = el.classList.contains('clearance') ? steps.filter(([, dy]) => dy === 0) : steps;
    const fits = ([dx, dy]: readonly [number, number]) => { const b = shifted(box, dx, dy); return inside(b) && !taken.some(t => hits(b, t)); };
    // A selected fitting's height reads along its own edge: slide it up or down that edge before moving it aside, so it never
    // lands where it looks like another part's height.
    const free = (el.classList.contains('item-height') ? allowed.filter(([dx]) => dx === 0).find(fits) : undefined) ?? allowed.find(fits);
    // A read-only figure with no free spot steps aside rather than cover a control; an editable one stays.
    if (!free && !el.hasAttribute('data-measurement-badge')) { el.style.display = 'none'; continue; }
    const spot = free ?? [0, 0];
    if (spot[0] || spot[1]) el.style.transform += ` translate(${spot[0]}px,${spot[1]}px)`;
    taken.push(shifted(box, spot[0]!, spot[1]!));
  }
}
