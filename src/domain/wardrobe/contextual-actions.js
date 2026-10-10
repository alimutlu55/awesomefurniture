/** Selection-specific editing commands, independent of DOM and viewport layout. */
const actions = {
    none: [['add', 'Add item'], ['auto', 'Auto design']],
    wardrobe: [['move', 'Move'], ['resize', 'Resize'], ['sections', 'Sections'], ['more', 'More']],
    item: [['duplicate', 'Duplicate'], ['remove', 'Remove'], ['replace', 'Replace']],
};
export const wardrobeMoreActions = [['material', 'Material'], ['reach', 'Max reach size'], ['doors', 'Doors'], ['duplicate', 'Duplicate'], ['reset', 'Reset'], ['remove', 'Remove']];
export function contextualActions(selection) {
    return [...(actions[selection] || actions.none), ['undo', 'Undo'], ['redo', 'Redo']];
}
