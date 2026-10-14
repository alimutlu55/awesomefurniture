/** Selection-specific editing commands, independent of DOM and viewport layout. */
const actions = {
    // Nothing selected: add to the wardrobe, the room, or the scene.
    none: [['add', 'Add item'], ['wardrobe', 'Wardrobe'], ['auto', 'Auto design']],
    studio: [['walls', 'Walls'], ['ceiling', 'Ceiling']],
    wardrobe: [['move', 'Move'], ['resize', 'Resize'], ['shape', 'Shape'], ['sections', 'Sections'], ['more', 'More']],
    item: [['duplicate', 'Duplicate'], ['remove', 'Remove'], ['resize', 'Resize'], ['more', 'More']],
    divider: [['duplicate', 'Duplicate'], ['remove', 'Remove'], ['resize', 'Resize']],
    // The room: a selected wall, a door, window or archway on one, or a ceiling that comes down (stairs, a slope, a box).
    // Size and Split stay directly accessible; adding openings is grouped in More.
    wall: [['wall-size', 'Size'], ['split', 'Split'], ['wall-paint', 'Paint / Finish'], ['more', 'More']],
    opening: [['opening-size', 'Size'], ['remove', 'Remove']],
    ceiling: [['ceiling-size', 'Size'], ['ceiling-shape', 'Shape'], ['flip', 'Flip'], ['remove', 'Remove']],
};
export const wardrobeMoreActions = [['material', 'Material'], ['reach', 'Max reach size'], ['doors', 'Doors'], ['duplicate', 'Duplicate'], ['reset', 'Reset'], ['remove', 'Remove']];
export const studioMoreActions = [['door', 'Door'], ['window', 'Window'], ['archway', 'Archway']];
export const wallMoreActions = [...studioMoreActions, ['remove', 'Remove wall']];
export const itemMoreActions = [['replace', 'Replace'], ['stores', 'Stores']];
/** Actions whose button opens fields in a popover instead of running a command. */
export const fieldActions = ['ceiling', 'ceiling-shape'];
export function contextualActions(selection) {
    return [...(actions[selection] || actions.none), ['undo', 'Undo'], ['redo', 'Redo']];
}
