import { cornerStripWidth } from '../../domain/kitchen/corner-widths';
import { kitchenFrontThickness } from '../../domain/kitchen/installation-parts';
import { worktopThickness } from '../../domain/materials/configured-materials';
import type { EditorDesign } from '../../domain/wardrobe/editor-design';
import { kitchenUnit, isFixture, installationKind } from '../../domain/kitchen/kitchen-units';
import { plinthOf } from '../../domain/wardrobe/carcass';
import { sizeControlMarkup, bindSizeNumber, bindSizeSlider } from './size-control';
import { syncResizeFields } from './resize-fields.js';
import type { BindCabinetDimensionsPorts } from './bindings/cabinet.ports';

const mounted = new WeakMap<BindCabinetDimensionsPorts['dom'], HTMLElement>();

export function bindKitchenConstruction({ dom, model, sceneCommands, inspector, history, lifetime }: BindCabinetDimensionsPorts) {
  const root = dom.document.createElement('div');
  mounted.set(dom, root);
  root.id = 'kitchen-construction'; root.hidden = true;
  dom.$('#sliders').append(root);
  for (const [key, label] of [['plinthHeight', 'Plinth height'], ['cornerStrip', 'Corner strip width'], ['endPanelThickness', 'End/Separator pane thickness'], ['frontThickness', 'Front thickness'], ['worktopThickness', 'Worktop thickness'],
    ['ventilationWidth', 'Vent grille width'], ['ventilationHeight', 'Vent grille height'], ['fridgeSplit', 'Lower fridge door height']] as const) {
    root.insertAdjacentHTML('beforeend', sizeControlMarkup({ label, min: key === 'plinthHeight' || key === 'endPanelThickness' || key === 'ventilationWidth' || key === 'ventilationHeight' || key === 'fridgeSplit' ? 0 : .1,
      max: key === 'endPanelThickness' ? 10 : key === 'frontThickness' ? 5 : key === 'worktopThickness' ? 15 : key === 'ventilationWidth' ? 150 : key === 'fridgeSplit' ? 270 : 30,
      inputAttributes: { 'data-construction': key, 'aria-label': label } }));
    const input = root.querySelector<HTMLInputElement>('[data-construction="' + key + '"]')!, row = input.closest<HTMLElement>('.size-control')!;
    const refresh = () => inspector.update(true);
    bindSizeNumber({ input, lifetime, commit: value => { sceneCommands.setKitchenConstruction(key, value); refresh(); }, finished: refresh });
    bindSizeSlider({ range: row.querySelector('input[type="range"]')!, lifetime, model, history,
      preview: value => { sceneCommands.setKitchenConstruction(key, value, false); }, refresh });
  }
}

export function syncKitchenConstruction(dom: BindCabinetDimensionsPorts['dom'], d: EditorDesign) {
  const root = mounted.get(dom);
  if (!root) return;
  root.hidden = d.product !== 'kitchen' || isFixture(d);
  for (const key of ['plinthHeight', 'cornerStrip', 'endPanelThickness', 'frontThickness', 'worktopThickness', 'ventilationWidth', 'ventilationHeight', 'fridgeSplit'] as const) {
    const input = root.querySelector<HTMLInputElement>('[data-construction="' + key + '"]')!;
    input.closest<HTMLElement>('.size-control')!.hidden = key === 'plinthHeight' ? !kitchenUnit(d.unit).plinth
      : key === 'cornerStrip' || key === 'endPanelThickness' ? !!installationKind(d) : key === 'worktopThickness' ? !kitchenUnit(d.unit).worktop
        : key === 'ventilationWidth' || key === 'ventilationHeight' || key === 'fridgeSplit' ? !d.secs.flat().some(i => i.k === 'fridge') : key === 'frontThickness' ? installationKind(d) === 'end-panel' : false;
    const value = key === 'plinthHeight' ? plinthOf(d) : key === 'cornerStrip' ? cornerStripWidth(d)
      : key === 'endPanelThickness' ? d.endPanelThickness ?? 1.8 : key === 'frontThickness' ? kitchenFrontThickness(d) : key === 'worktopThickness' ? worktopThickness(d) : d[key] ?? 0;
    if (dom.document.activeElement !== input) input.value = String(value);
  }
  syncResizeFields(root);
}
