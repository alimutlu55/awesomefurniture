import type { SceneMeasurement } from '../../application/commands/scene-measurements';
import { decorateMeasurementBadge } from '../components/measurement-badge';

/** Stable identity survives viewport rebuilds; the component knows no feature types. */
export function sceneMeasurementBadge(el: HTMLElement, ref: SceneMeasurement, label: string, value: number,
    orientation: 'horizontal' | 'vertical', min = 0, max = 2000) {
    const encoded = encodeURIComponent(JSON.stringify(ref));
    el.dataset.sceneMeasurement = encoded;
    decorateMeasurementBadge(el, { id: 'scene:' + encoded, label, value, orientation, min, max });
    if (ref.kind === 'studio') el.title = 'Tap to type an exact dimension; use arrow keys for precise changes';
    el.onclick = null; el.onpointerdown = null; el.onkeydown = null;
}
