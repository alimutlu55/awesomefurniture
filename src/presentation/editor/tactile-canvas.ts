import { createTactileEdits } from '../../application/commands/tactile-edits';
import { bindDimensionScrubbers } from './dimension-scrubbers';
import { bindAccordionGestures } from './accordion-gestures';
import type { MountEditorBindingsPorts } from './mount-editor-bindings.ports';

export function bindTactileCanvas(ports: MountEditorBindingsPorts) {
    const edits = createTactileEdits({ model: ports.model, checkpoint: ports.history.checkpoint });
    const badges = bindDimensionScrubbers({ ...ports, edits });
    bindAccordionGestures({ ...ports, edits: { ...edits, active: () => edits.active() || badges.active() } });
}
