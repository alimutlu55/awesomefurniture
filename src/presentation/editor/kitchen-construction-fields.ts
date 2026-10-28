import { cornerStripWidth, cornerReturnJoints } from '../../domain/kitchen/corner-widths';
import { sidePanelThickness } from '../../domain/kitchen/end-panels';
import { kitchenFrontThickness } from '../../domain/kitchen/installation-parts';
import { worktopThickness } from '../../domain/materials/configured-materials';
import type { EditorDesign } from '../../domain/wardrobe/editor-design';
import { kitchenUnit, isFixture, installationKind } from '../../domain/kitchen/kitchen-units';
import { plinthOf } from '../../domain/wardrobe/carcass';
import { sizeControlMarkup, bindSizeNumber, bindSizeSlider } from './size-control';
import { syncResizeFields } from './resize-fields.js';
import type { BindCabinetDimensionsPorts } from './bindings/cabinet.ports';
import { lengthWithUnit } from './length-unit-state';

const mounted = new WeakMap<BindCabinetDimensionsPorts['dom'], { root: HTMLElement; model: BindCabinetDimensionsPorts['model'] }>();

type ConstructionKey = 'plinthHeight' | 'cornerStrip' | 'leftPanelThickness' | 'rightPanelThickness' | 'frontThickness' | 'worktopThickness' | 'ventilationWidth' | 'ventilationHeight' | 'fridgeSplit';

function currentConstructionValue(d: EditorDesign, key: ConstructionKey) {
  return key === 'plinthHeight' ? plinthOf(d) : key === 'cornerStrip' ? cornerStripWidth(d)
    : key === 'leftPanelThickness' ? sidePanelThickness(d, -1)
      : key === 'rightPanelThickness' ? sidePanelThickness(d, 1)
        : key === 'frontThickness' ? kitchenFrontThickness(d)
          : key === 'worktopThickness' ? worktopThickness(d) : d[key] ?? 0;
}

export function bindKitchenConstruction({ dom, model, sceneCommands, inspector, history, lifetime }: BindCabinetDimensionsPorts) {
  const root = dom.document.createElement('div');
  mounted.set(dom, { root, model });
  root.id = 'kitchen-construction'; root.hidden = true;
  dom.$('#sliders').append(root);
  root.insertAdjacentHTML('beforeend', '<p class="corner-joint-summary" role="status" hidden></p>');
  for (const [key, label] of [
    ['plinthHeight', 'Plinth height'], ['cornerStrip', 'Corner allowance'],
    ['leftPanelThickness', 'Left panel'], ['rightPanelThickness', 'Right panel'],
    ['frontThickness', 'Front thickness'], ['worktopThickness', 'Worktop thickness'],
    ['ventilationWidth', 'Vent grille width'], ['ventilationHeight', 'Vent grille height'],
    ['fridgeSplit', 'Lower fridge door height'],
  ] as const) {
    const allowZero = key === 'plinthHeight' || key === 'leftPanelThickness' || key === 'rightPanelThickness'
      || key === 'ventilationWidth' || key === 'ventilationHeight' || key === 'fridgeSplit';
    root.insertAdjacentHTML('beforeend', sizeControlMarkup({ label, min: allowZero ? 0 : .1,
      max: key === 'leftPanelThickness' || key === 'rightPanelThickness' ? 10 : key === 'frontThickness' ? 5 : key === 'worktopThickness' ? 15 : key === 'ventilationWidth' ? 150 : key === 'fridgeSplit' ? 270 : 30,
      inputAttributes: { 'data-construction': key, 'aria-label': label } }));
    const input = root.querySelector<HTMLInputElement>('[data-construction="' + key + '"]')!, row = input.closest<HTMLElement>('.size-control')!;
    const refresh = () => inspector.update(true);
    bindSizeNumber({ input, lifetime, commit: value => { sceneCommands.setKitchenConstruction(key, value); refresh(); }, finished: refresh });
    bindSizeSlider({ range: row.querySelector('input[type="range"]')!, lifetime, model, history,
      preview: value => {
        if (sceneCommands.setKitchenConstruction(key, value, false)) return;
        const start = currentConstructionValue(model.activeCabinet().state, key), dir = value > start ? 1 : -1;
        const steps = Math.min(300, Math.round(Math.abs(value - start) * 10));
        for (let s = steps - 1; s >= 1; s--) {
          if (sceneCommands.setKitchenConstruction(key, Math.round((start + dir * s * .1) * 10) / 10, false)) break;
        }
      }, refresh });
  }
}

export function syncKitchenConstruction(dom: BindCabinetDimensionsPorts['dom'], d: EditorDesign) {
  const mountedState = mounted.get(dom);
  if (!mountedState) return;
  const { root, model } = mountedState;
  root.hidden = d.product !== 'kitchen' || isFixture(d);
  const boxes = model.scene.wardrobes, selected = model.activeCabinet();
  const joints = boxes.flatMap(p => cornerReturnJoints(p, boxes).filter(j => j.blind && (p.id === selected.id || j.otherId === selected.id)));
  const summary = root.querySelector<HTMLElement>('.corner-joint-summary')!;
  summary.hidden = !joints.length;
  summary.textContent = joints.map(j => {
    const equation = lengthWithUnit(j.requiredGap) + ' corner = ' + lengthWithUnit(j.frontProjection) + ' overlap + '
      + lengthWithUnit(Math.max(0, j.stripWidth)) + ' return strip.';
    return equation + (Math.abs(j.bodyGap - j.requiredGap) > .05 ? ' Check spacing: ' + lengthWithUnit(j.bodyGap) + ' in the layout.' : '');
  }).join(' ');
  for (const key of ['plinthHeight', 'cornerStrip', 'leftPanelThickness', 'rightPanelThickness', 'frontThickness', 'worktopThickness', 'ventilationWidth', 'ventilationHeight', 'fridgeSplit'] as const) {
    const input = root.querySelector<HTMLInputElement>('[data-construction="' + key + '"]')!;
    input.closest<HTMLElement>('.size-control')!.hidden = key === 'plinthHeight' ? !kitchenUnit(d.unit).plinth
      : key === 'cornerStrip' || key === 'leftPanelThickness' || key === 'rightPanelThickness' ? !!installationKind(d) : key === 'worktopThickness' ? !kitchenUnit(d.unit).worktop
        : key === 'ventilationWidth' || key === 'ventilationHeight' || key === 'fridgeSplit' ? !d.secs.flat().some(i => i.k === 'fridge') : key === 'frontThickness' ? installationKind(d) === 'end-panel' : false;
    const value = currentConstructionValue(d, key);
    if (dom.document.activeElement !== input) input.value = String(value);
  }
  syncResizeFields(root);
}
