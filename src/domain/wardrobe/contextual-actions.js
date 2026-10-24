import { FURNITURE } from '../furniture/furniture';
/** Selection-specific editing commands, independent of DOM and viewport layout. */
/** Every piece of furniture shows the same tools in the same order, the steps furniture planners use: add another,
 * its interior, its size, its fronts, then More. Moving needs no tool: furniture, an item or a divider is dragged where it goes.
 * Add is named for what it adds ("New wardrobe", "Add cabinet"): a tool's third entry is its accessible name.
 * @param {import('../furniture/furniture').FurnitureModule} module */
const toolsOf = module => [['new', 'Add', module.addLabel], ['interior', 'Interior'], ['resize', 'Size'], ['fronts', 'Fronts'], ['more', 'More']];
/** What a furniture tool's menu offers. Interior: Auto design where the module plans, its sections, Add item.
 * More: duplicating, resetting or removing it, the same for every kind. @param {import('../furniture/furniture').FurnitureModule} module */
const menusOf = module => ({
    interior: [...(module.autoDesign ? [['auto', 'Auto design']] : []), ['sections', 'Sections'], ['add-item', 'Add item']],
    more: [['duplicate', 'Duplicate'], ['reset', 'Reset'], ['remove', 'Remove']],
});
const actions = {
    // Nothing selected in Furniture: Add opens one sheet with a tab per kind of furniture; a piece is selected by tapping it.
    none: [['add', 'Add'], ['more', 'More']],
    // Nothing selected in Studio: walls and rooms, or a shape (stairs, a slope, a pillar) on the wall in view.
    studio: [['walls', 'Walls'], ['ceiling', 'Shapes', 'Add a shape: stairs, a slope, a beam or a pillar']],
    // A selected piece of furniture: its kind's tools (the context is its furniture kind).
    ...Object.fromEntries(FURNITURE.map(m => [m.key, toolsOf(m)])),
    // A sink or hob placed on its own has no inside or fronts: it is sized, copied or removed.
    fixture: [['new', 'Add', 'Add cabinet'], ['resize', 'Size'], ['duplicate', 'Duplicate'], ['remove', 'Remove']],
    // A selected item or divider: the same order as furniture, what it is first, then size, duplicate, remove.
    item: [['replace', 'Replace'], ['resize', 'Size'], ['duplicate', 'Duplicate'], ['remove', 'Remove'], ['more', 'More']],
    divider: [['resize', 'Size'], ['duplicate', 'Duplicate'], ['remove', 'Remove']],
    // The room: a selected wall has Add, Size, Shape (its outline face on), Paint, More (Split, Remove).
    wall: [['new', 'Add', 'Add to wall'], ['wall-size', 'Size'], ['surface-shape', 'Shape'], ['wall-paint', 'Paint / Finish'], ['more', 'More']],
    opening: [['opening-size', 'Size'], ['remove', 'Remove']],
    // A ceiling shape is drawn and sized in one place, its Shape editor.
    ceiling: [['surface-shape', 'Shape'], ['flip', 'Flip'], ['remove', 'Remove']],
};
/** The menus of each kind of furniture's tools (Interior, More), by its furniture kind. */
export const furnitureMenus = Object.fromEntries(FURNITURE.map(m => [m.key, menusOf(m)]));
/** The More menu of each kind of furniture, by its furniture kind. */
export const furnitureMoreActions = Object.fromEntries(FURNITURE.map(m => [m.key, menusOf(m).more]));
export const wardrobeMoreActions = furnitureMoreActions.wardrobe;
export const studioMoreActions = [];
export const wallMoreActions = [['split', 'Split'], ['remove', 'Remove wall']];
export const itemMoreActions = [['stores', 'Stores']];
/** Actions whose button opens fields in a popover instead of running a command. */
export const fieldActions = [];
/** Selections whose toolbar is a piece of furniture's: one per furniture kind. */
export const furnitureContexts = FURNITURE.map(m => m.key);
export function contextualActions(selection) {
    return [...(actions[selection] || actions.none), ['undo', 'Undo'], ['redo', 'Redo']];
}
