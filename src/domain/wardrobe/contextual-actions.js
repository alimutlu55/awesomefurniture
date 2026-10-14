/** Selection-specific editing commands, independent of DOM and viewport layout. */
const actions = {
    // Nothing selected: add to the wardrobe, the room, or the scene.
    none: [['add', 'Add item'], ['walls', 'Walls'], ['wardrobe', 'Wardrobe']],
    wardrobe: [['move', 'Move'], ['resize', 'Resize'], ['sections', 'Sections'], ['more', 'More']],
    item: [['duplicate', 'Duplicate'], ['remove', 'Remove'], ['resize', 'Resize'], ['more', 'More']],
    // The room: a selected wall, a door, window or archway on one, or a ceiling that comes down (stairs, a slope, a box).
    // Size and Split stay directly accessible; adding openings is grouped in More.
    wall: [['wall-size', 'Size'], ['split', 'Split'], ['ceiling', 'Ceiling'], ['wardrobe-here', 'Wardrobe'], ['more', 'More']],
    opening: [['opening-size', 'Size'], ['remove', 'Remove']],
    ceiling: [['ceiling-size', 'Size'], ['ceiling-shape', 'Shape'], ['flip', 'Flip'], ['remove', 'Remove']],
};
export const wardrobeMoreActions = [['shape', 'Shape'], ['material', 'Material'], ['reach', 'Max reach size'], ['doors', 'Doors'], ['duplicate', 'Duplicate'], ['reset', 'Reset'], ['remove', 'Remove']];
export const wallMoreActions = [['door', 'Door'], ['archway', 'Archway'], ['window', 'Window'], ['add-wall', 'Add wall'], ['remove', 'Remove wall']];
export const itemMoreActions = [['replace', 'Replace'], ['stores', 'Stores']];
/** Actions whose button opens fields in a popover instead of running a command. */
export const fieldActions = ['ceiling', 'ceiling-shape'];
export function contextualActions(selection) {
    return [...(actions[selection] || actions.none), ['undo', 'Undo'], ['redo', 'Redo']];
}
