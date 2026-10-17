import { createTactileEdits } from '../../application/commands/tactile-edits';
import { bindDimensionScrubbers } from './dimension-scrubbers';
import { bindAccordionGestures } from './accordion-gestures';
import type { MountEditorBindingsPorts } from './mount-editor-bindings.ports';

/** `openSize` opens the selected furniture's Size sheet (a tap on one of its measurements). */
export function bindTactileCanvas(ports: MountEditorBindingsPorts & { openSize: () => void }) {
    const edits = createTactileEdits({ model: ports.model, checkpoint: ports.history.checkpoint });
    const badges = bindDimensionScrubbers({ ...ports, edits });
    bindAccordionGestures({ ...ports, edits: { ...edits, active: () => edits.active() || badges.active() } });
}
