/** What every wardrobe rules module receives.
 * @typedef {object} GeometryContext
 * @property {() => import('../../wardrobe/editor-design').EditorDesign & { sel: number; item: number; divider: number; space: {i:number;x:number;y:number}|null }} getDesign
 * @property {() => number} getBudget
 */
export {};
