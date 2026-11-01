import { wallFace, type StudioOpening } from '../../domain/studio/studio';
import { clampPlanOpenings } from '../../domain/studio/floor-plan';
import { moveOpening, setOpeningSize, setInsideLength } from '../../domain/studio/studio-edit';
import { bindMeasurementBadges, decorateMeasurementBadge } from '../components/measurement-badge';
import { lengthText, unitSuffix } from './length-unit-state';
import type { FloorPlanPorts } from './floor-plan.ports';
type Field = 'width' | 'height' | 'sill' | 'offset';

export function openingPlanMeasurements(layer: HTMLElement, opening: StudioOpening) {
  const row = layer.ownerDocument.createElement('div'); row.className = 'plan-opening-measures';
  for (const field of ['width', 'height', 'sill', 'offset'] as const) {
    if (field === 'sill' && opening.kind !== 'window') continue;
    const b = layer.ownerDocument.createElement('button'); b.type = 'button'; b.dataset.opening = opening.id; b.dataset.field = field;
    b.textContent = `${field[0]!.toUpperCase() + field.slice(1)} ${lengthText(opening[field])}${unitSuffix()}`;
    decorateMeasurementBadge(b, { id: `opening:${opening.id}:${field}`, label: `Opening ${field}`, value: opening[field], orientation: 'horizontal', min: 0, max: 2000 });
    row.append(b);
  }
  layer.append(row);
}

export function bindFloorPlanMeasurements(p: FloorPlanPorts, layer: HTMLElement, active: (editing: boolean) => void, render: () => void) {
  let before = '', initial = 0;
  bindMeasurementBadges({ layer, boundary: p.dom.$('#view'), windowEvents: p.dom.window, lifetime: p.lifetime,
    feedback: { begin() {}, tick() {}, settle() {} }, active: id => active(!!id),
    resolve: el => {
      const id = el.dataset.wall ?? el.dataset.opening, field = el.dataset.field as Field | undefined;
      if (!id) return null;
      const read = () => {
        const r = p.model.scene.studio;
        if (field) return r?.openings.find(o => o.id === id)?.[field] ?? 0;
        const w = r?.walls.find(w => w.id === id); return r && w ? wallFace(r, w)?.length ?? 0 : 0;
      };
      const selector = field ? `[data-opening="${CSS.escape(id)}"][data-field="${field}"]` : `[data-wall="${CSS.escape(id)}"]`;
      return { id: `plan:${id}:${field ?? 'length'}`, selector, orientation: 'horizontal', min: field ? 0 : 30, max: 2000, entry: true, read,
        begin() { before = p.model.snapshot(); initial = read(); },
        preview(delta) {
          p.model.restore(before); const value = Math.round((initial + delta) * 10) / 10;
          if (field) p.commands.editStudio(r => {
            const next = field === 'offset' ? moveOpening(r, id, value) : setOpeningSize(r, id, { [field]: value });
            return next && clampPlanOpenings(next);
          }, false);
          else if (value >= 30 && value <= 2000) {
            // The shared exact-size command prefers a free end. If hosted openings no longer fit,
            // retry with bounded opening dimensions before rejecting the connected wall edit.
            if (!p.commands.resizeWallLength(id, value, false, true)) for (const fromEnd of [false, true]) {
              if (p.commands.editStudio(r => {
                const next = setInsideLength(r, id, value, fromEnd); return next && clampPlanOpenings(next);
              }, false, true)) break;
            }
          }
          return read();
        },
        finish(cancel) {
          const changed = p.model.snapshot() !== before;
          if (cancel) p.model.restore(before); else if (changed) p.history.checkpoint(before);
          // Do not replace a tapped badge before its keyboard-eligible native click.
          if (changed) p.refresh();
          return !cancel && changed;
        }, refresh: render };
    } });
}
