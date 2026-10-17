import { FURNITURE } from '../furniture/furniture';
/** Selection-specific editing commands, independent of DOM and viewport layout. */
/** The tools a piece of furniture shows beside More. Moving needs no tool: an item or a divider is dragged where it goes.
 * Auto design leads them where the furniture's module can plan it. @param {import('../furniture/furniture').FurnitureModule} module */
const toolsOf = module => [...(module.autoDesign ? [['auto', 'Auto design']] : []), ...(module.addItemTool ? [['add', 'Add item']] : []), ['resize', 'Resize'],
    ...(module.shaped ? [['shape', 'Shape']] : []), ...(module.sectionsInMore ? [] : [['sections', 'Sections']]), ['more', 'More']];
/** A selected piece of furniture's More menu: add another, its sections where they are not a tool, then its finish,
 * its doors where it has whole-front doors, and duplicating, resetting or removing it. @param {import('../furniture/furniture').FurnitureModule} module */
const moreOf = module => [['new', module.addLabel], ...(module.sectionsInMore ? [['sections', 'Sections']] : []), ['material', 'Material'],
    ...(module.wholeDoors ? [['doors', 'Doors']] : []), ['duplicate', 'Duplicate'], ['reset', 'Reset'], ['remove', 'Remove']];
const actions = {
    // Nothing selected in Furniture: choose the furniture to work on (one button each, see furniture.ts).
    none: [...FURNITURE.map(m => [m.key, m.label]), ['more', 'More']],
    studio: [['walls', 'Walls'], ['ceiling', 'Ceiling']],
    // A selected piece of furniture: its kind's tools (the context is its furniture kind).
    ...Object.fromEntries(FURNITURE.map(m => [m.key, toolsOf(m)])),
    item: [['duplicate', 'Duplicate'], ['remove', 'Remove'], ['resize', 'Resize'], ['more', 'More']],
    divider: [['duplicate', 'Duplicate'], ['remove', 'Remove'], ['resize', 'Resize']],
    // The room: a selected wall, a door, window or archway on one, or a ceiling that comes down (stairs, a slope, a box).
    // Size and Split stay directly accessible; adding openings is grouped in More.
    wall: [['wall-size', 'Size'], ['split', 'Split'], ['wall-paint', 'Paint / Finish'], ['more', 'More']],
    opening: [['opening-size', 'Size'], ['remove', 'Remove']],
    ceiling: [['ceiling-size', 'Size'], ['ceiling-shape', 'Shape'], ['flip', 'Flip'], ['remove', 'Remove']],
};
/** The More menu of each kind of furniture, by its furniture kind. */
export const furnitureMoreActions = Object.fromEntries(FURNITURE.map(m => [m.key, moreOf(m)]));
export const defaultWardrobeMoreActions = [['reach', 'Max reach size']];
export const wardrobeMoreActions = furnitureMoreActions.wardrobe;
export const studioMoreActions = [['door', 'Door'], ['window', 'Window'], ['archway', 'Archway']];
export const wallMoreActions = [...studioMoreActions, ['remove', 'Remove wall']];
export const itemMoreActions = [['replace', 'Replace'], ['stores', 'Stores']];
/** Actions whose button opens fields in a popover instead of running a command. */
export const fieldActions = ['ceiling', 'ceiling-shape'];
/** Selections whose toolbar is a piece of furniture's: one per furniture kind. */
export const furnitureContexts = FURNITURE.map(m => m.key);
export function contextualActions(selection) {
    return [...(actions[selection] || actions.none), ['undo', 'Undo'], ['redo', 'Redo']];
}
