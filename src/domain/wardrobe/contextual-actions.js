/** Selection-specific editing commands, independent of DOM and viewport layout. */
const actions = {
    // Nothing selected: add to the wardrobe, the room, or the scene.
    none: [['add', 'Add item'], ['walls', 'Walls'], ['wardrobe', 'Wardrobe']],
    wardrobe: [['move', 'Move'], ['resize', 'Resize'], ['sections', 'Sections'], ['more', 'More']],
    item: [['duplicate', 'Duplicate'], ['remove', 'Remove'], ['resize', 'Resize'], ['more', 'More']],
    // The room: a selected wall, or a door, window or archway on one.
    wall: [['wall-size', 'Size'], ['split', 'Split'], ['door', 'Door'], ['window', 'Window'], ['more', 'More']],
    opening: [['opening-size', 'Size'], ['remove', 'Remove']],
};
export const wardrobeMoreActions = [['shape', 'Shape'], ['material', 'Material'], ['reach', 'Max reach size'], ['doors', 'Doors'], ['duplicate', 'Duplicate'], ['reset', 'Reset'], ['remove', 'Remove']];
export const wallMoreActions = [['archway', 'Archway'], ['add-wall', 'Add wall'], ['remove', 'Remove wall']];
export const itemMoreActions = [['replace', 'Replace'], ['stores', 'Stores']];
/** Actions whose button opens fields in a popover instead of running a command. */
export const fieldActions = ['wall-size', 'opening-size'];
export function contextualActions(selection) {
    return [...(actions[selection] || actions.none), ['undo', 'Undo'], ['redo', 'Redo']];
}
