import { FURNITURE } from '../furniture/furniture';
/** Selection-specific editing commands, independent of DOM and viewport layout. */
/** Furniture tools act on the selected piece. Moving needs no tool: drag the furniture, item or divider. */
const toolsOf = () => [['add-item', 'Add item'], ['interior', 'Interior'], ['resize', 'Size'], ['fronts', 'Fronts'], ['make', 'Make', 'Make: every part, measured'], ['more', 'More']];
/** What a furniture tool's menu offers. Interior: Auto design where the module plans, and its sections.
 * More: duplicating, resetting or removing it, the same for every kind. @param {import('../furniture/furniture').FurnitureModule} module */
const menusOf = module => ({
    interior: [...(module.autoDesign ? [['auto', 'Auto design']] : []), ['sections', 'Sections']],
    more: [['duplicate', 'Duplicate'], ['reset', 'Reset'], ['remove', 'Remove']],
});
const actions = {
    // Nothing selected in Furniture: Add opens one sheet with a tab per kind of furniture; a piece is selected by tapping it.
    none: [['add', 'Add'], ['more', 'More']],
    // Nothing selected in Studio: Add opens one sheet with a tab per part of the room (walls and rooms, a ceiling shape, a fixture).
    studio: [['new', 'Add', 'Add to the room']],
    // A selected piece of furniture: its kind's tools (the context is its furniture kind).
    ...Object.fromEntries(FURNITURE.map(m => [m.key, toolsOf()])),
    // A sink or hob placed on its own has no inside or fronts: it is sized, copied or removed.
    installation: [['new', 'Add', 'Add cabinet'], ['resize', 'Size'], ['fronts', 'Finish'], ['more', 'More']],
    fixture: [['new', 'Add', 'Add cabinet'], ['resize', 'Size'], ['duplicate', 'Duplicate'], ['remove', 'Remove']],
    // A selected item or divider: the same order as furniture, what it is first, then size, duplicate, remove.
    item: [['replace', 'Replace'], ['resize', 'Size'], ['duplicate', 'Duplicate'], ['remove', 'Remove'], ['more', 'More']],
    divider: [['resize', 'Size'], ['duplicate', 'Duplicate'], ['remove', 'Remove']],
    // Size contains the wall's outline editor and dimension controls.
    wall: [['new', 'Add', 'Add to wall'], ['wall-size', 'Size'], ['wall-paint', 'Paint / Finish'], ['more', 'More']],
    opening: [['opening-size', 'Size'], ['remove', 'Remove']],
    // A ceiling is drawn and sized in the same Size section.
    ceiling: [['ceiling-size', 'Size'], ['flip', 'Flip'], ['remove', 'Remove']],
    // A toilet or basin: how it is fitted (with its boxing), its size, its finishes; More copies or removes it.
    'room-fixture': [['fixture-type', 'Type', 'How it is fitted'], ['fixture-size', 'Size'], ['fixture-finish', 'Finish'], ['more', 'More']],
};
/** The menus of each kind of furniture's tools (Interior, More), by its furniture kind. */
export const furnitureMenus = Object.fromEntries(FURNITURE.map(m => [m.key, menusOf(m)]));
/** The More menu of each kind of furniture, by its furniture kind. */
export const furnitureMoreActions = Object.fromEntries(FURNITURE.map(m => [m.key, menusOf(m).more]));
export const wardrobeMoreActions = furnitureMoreActions.wardrobe;
export const studioMoreActions = [];
export const wallMoreActions = [['split', 'Split'], ['remove', 'Remove wall']];
export const fixtureMoreActions = [['duplicate', 'Duplicate'], ['remove', 'Remove']];
export const itemMoreActions = [['stores', 'Stores']];
/** Actions whose button opens fields in a popover instead of running a command. */
export const fieldActions = [];
/** Selections whose toolbar is a piece of furniture's: one per furniture kind. */
export const furnitureContexts = FURNITURE.map(m => m.key);
export function contextualActions(selection) {
    return [...(actions[selection] || actions.none), ['undo', 'Undo'], ['redo', 'Redo']];
}
