/** Selection-specific editing commands, independent of DOM and viewport layout. */
const actions = {
    none: [['add', 'Add item'], ['auto', 'Auto design']],
    wardrobe: [['move', 'Move'], ['resize', 'Resize'], ['sections', 'Sections'], ['more', 'More']],
    item: [['duplicate', 'Duplicate'], ['remove', 'Remove'], ['resize', 'Resize'], ['more', 'More']],
};
export const wardrobeMoreActions = [['material', 'Material'], ['reach', 'Max reach size'], ['doors', 'Doors'], ['duplicate', 'Duplicate'], ['reset', 'Reset'], ['remove', 'Remove']];
export const itemMoreActions = [['replace', 'Replace'], ['stores', 'Stores']];
export function contextualActions(selection) {
    return [...(actions[selection] || actions.none), ['undo', 'Undo'], ['redo', 'Redo']];
}
