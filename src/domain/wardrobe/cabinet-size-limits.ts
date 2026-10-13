import { isRegularShape, minimumShapeHeight, type ShapedDesign } from './shape/wardrobe-shape';

/** A fitted or already short wardrobe can be adjusted below the normal freestanding minimum. */
export function resizeHeightMinimum(design: ShapedDesign): number {
    const shape = design.shape;
    if (shape && (!isRegularShape(shape) || shape.template === 'room' || design.h < 180)) {
        return Math.max(60, Math.ceil(minimumShapeHeight(shape)));
    }
    return design.h < 180 ? 60 : 180;
}
