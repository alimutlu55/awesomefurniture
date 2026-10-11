/** Selection-specific editing commands, independent of DOM and viewport layout. They follow what is
 * selected, from the outside in: nothing selected is the room (add wardrobes, walls, rooms); a wardrobe
 * (or a space in it) adds fittings and has Auto design; an item, a wall or an opening edits itself. */
const actions = {
    none: [['add', 'Add']],
    // A third entry is a shorter label for a narrow toolbar; the full name stays the accessible name.
    wardrobe: [['add', 'Add item', 'Add'], ['auto', 'Auto design', 'Design'], ['move', 'Move'], ['resize', 'Resize'], ['more', 'More']],
    item: [['duplicate', 'Duplicate'], ['remove', 'Remove'], ['resize', 'Resize'], ['more', 'More']],
    // The room: a selected wall, or a door, window or archway on one.
    wall: [['wall-size', 'Size'], ['split', 'Split'], ['door', 'Door'], ['window', 'Window'], ['more', 'More']],
    opening: [['opening-size', 'Size'], ['remove', 'Remove']],
};
export const wardrobeMoreActions = [['sections', 'Sections'], ['shape', 'Shape'], ['material', 'Material'], ['reach', 'Max reach size'], ['doors', 'Doors'],
    ['add-wardrobe', 'Add wardrobe'], ['duplicate', 'Duplicate'], ['reset', 'Reset'], ['remove', 'Remove']];
export const wallMoreActions = [['archway', 'Archway'], ['add-wall', 'Add wall'], ['remove', 'Remove wall']];
export const itemMoreActions = [['replace', 'Replace'], ['stores', 'Stores']];
/** Actions whose button opens fields in a popover instead of running a command. */
export const fieldActions = ['wall-size', 'opening-size'];
export function contextualActions(selection) {
    return [...(actions[selection] || actions.none), ['undo', 'Undo'], ['redo', 'Redo']];
}
