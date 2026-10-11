import { resizeTarget } from '../../domain/wardrobe/resize-target';
/** Routes all Resize actions through the existing shared bottom-sheet hosts. */
export function createResizePresenter({ getSelection, openWardrobe, openItem, openDivider, prepare = (_target = 'wardrobe') => {} }) {
    const open = () => {
        const target = resizeTarget(getSelection());
        prepare(target);
        ({wardrobe:openWardrobe,item:openItem,divider:openDivider})[target]();
    };
    return { open };
}
