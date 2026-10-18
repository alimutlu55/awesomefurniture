import { createSizesRules } from './wardrobe-rules/sizes.js';
import { createCeilingRules } from './wardrobe-rules/ceiling.js';
import { createLayoutRules } from './wardrobe-rules/layout.js';
import { createFitRules } from './wardrobe-rules/fit.js';
import { createDividersRules } from './wardrobe-rules/dividers.js';
import { createAttachmentRules } from './wardrobe-rules/attachments.js';
import { createBoxesRules } from './wardrobe-rules/boxes.js';
import { createSpacesRules } from './wardrobe-rules/spaces.js';
import { createMovementRules } from './wardrobe-rules/movement.js';
import { createClearanceRules } from './wardrobe-rules/clearances.js';
import { createMeasurementsRules } from './wardrobe-rules/measurements.js';
import { createCostingRules } from './wardrobe-rules/costing.js';
import { createPlannerConfigRules } from './wardrobe-rules/planner-config.js';
/** Geometry and feasibility rules for one wardrobe. Only the centimetre design is read.
 *
 * The rules live in ./wardrobe-rules/, one module per concern, created in dependency order: a module
 * may only use the modules created before it. This facade composes them and returns the same API.
 * To add a rule, put it in the module that owns its concern and add it to that module's return.
 * @param {import('./wardrobe-rules/context.js').GeometryContext['getDesign']} getDesign */
export function createWardrobeGeometry(getDesign, getBudget = () => 900) {
    const ctx = { getDesign, getBudget };
    const sizesRules = createSizesRules(ctx, {});
    const ceilingRules = createCeilingRules(ctx, {});
    const layoutRules = createLayoutRules(ctx, { ...ceilingRules });
    const fitRules = createFitRules(ctx, { ...sizesRules, ...ceilingRules, ...layoutRules });
    const dividersRules = createDividersRules(ctx, { ...ceilingRules, ...layoutRules });
    const attachmentRules = createAttachmentRules(ctx, { ...sizesRules, ...ceilingRules, ...layoutRules, ...fitRules, ...dividersRules });
    const boxesRules = createBoxesRules(ctx, { ...dividersRules });
    const spacesRules = createSpacesRules(ctx, { ...sizesRules, ...ceilingRules, ...layoutRules, ...dividersRules });
    const movementRules = createMovementRules(ctx, { ...sizesRules, ...layoutRules, ...fitRules, ...dividersRules, ...spacesRules });
    const clearanceRules = createClearanceRules(ctx, { ...ceilingRules, ...layoutRules, ...fitRules, ...dividersRules });
    const measurementsRules = createMeasurementsRules(ctx, { ...ceilingRules, ...layoutRules, ...fitRules, ...spacesRules, ...clearanceRules });
    const costingRules = createCostingRules(ctx, { ...ceilingRules, ...layoutRules });
    const plannerConfigRules = createPlannerConfigRules(ctx, { ...ceilingRules, ...layoutRules });
    const {
        itemMinW, effectiveMin, itemFeasible, newItem, splitFor, okItem, bayMinW, minTotal, maxN, shapeInfo,
        floor2, ceilingIn, ceilingTop, ceilingOutline, clearSpans, windowClear, cutOutline, widths,
        computeLayout, ih, used, free, currentLayout, interiorFloor, itemFit, fitsCeiling, itemOverflow, overflow,
        sectionFits, fittingFit, dividerRect, visibleRect, sectionDividers, dividerBounds, boardFit, clampDivider,
        dividerValid, dividerOrientation, dividerOverlaps, dividerMeasurements, dividerDupSpot, isBoxed,
        boxCapped, boxSupported, sectionSpaces, spaceCentre, sectionSpaceMeasurements, spaceSpan, narrowToFit,
        edgeGap, itemFreeAbove, planItemMove, planFreeMove, verticalNeighbor, itemYBounds, sectionLayoutValid,
        duplicateSideSpot, resizeObstacles, itemEdgeSize, widthEdgeFor, itemGeom, itemMeasurements, cost,
        stats, plannerConfig, planCfg, moveWithAttachments, carryOnMove, sectionObstacles, gapsAround, itemGaps, railDrop, drawerStack, netOpening, spaceTallest,
    } = {
        ...sizesRules, ...ceilingRules, ...layoutRules, ...fitRules, ...dividersRules, ...attachmentRules, ...boxesRules,
        ...spacesRules, ...movementRules, ...clearanceRules, ...measurementsRules, ...costingRules, ...plannerConfigRules,
    };
    return {
        spaceCentre, clampDivider, shapeInfo, ceilingIn, ceilingTop, ceilingOutline, clearSpans, windowClear,
        itemFit, fittingFit, cutOutline, boardFit, fitsCeiling, overflow, sectionFits, spaceSpan, narrowToFit,
        widths, interiorFloor, computeLayout, planItemMove, planFreeMove, verticalNeighbor, itemFreeAbove, ih, used, free,
        maxN, cost, stats, itemGeom, itemMeasurements, dividerRect, visibleRect, dividerMeasurements, dividerBounds,
        dividerValid, dividerOrientation, itemYBounds, sectionDividers, dividerOverlaps, sectionLayoutValid,
        sectionSpaces, sectionSpaceMeasurements, itemMinW, isBoxed, boxCapped, boxSupported, planCfg,
        plannerConfig, currentLayout, effectiveMin, itemFeasible, newItem, splitFor, edgeGap, bayMinW,
        minTotal, okItem, duplicateSideSpot, resizeObstacles, itemEdgeSize, widthEdgeFor, dividerDupSpot,
        moveWithAttachments, carryOnMove, sectionObstacles, gapsAround, itemGaps, railDrop, drawerStack, netOpening, spaceTallest,
    };
}
