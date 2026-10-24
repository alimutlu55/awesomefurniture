import type { EditorScene } from '../../application/projects/editor-scene';
import type { Sheet } from '../../domain/drawings/drawing';
import type { DrawingInput } from '../../domain/drawings/room-pieces';
import { technicalDrawings } from '../../domain/drawings/technical-drawings';
import { type ManufacturingFinding, type ManufacturingValidation, modelRevision, validateForManufacture } from '../../domain/drawings/manufacturing-validation';
import { type Mark } from './paper-marks';
import { type SheetSetInfo, releaseStamp, sheetPresentation } from './sheet-marks';
import { paginateDrawingSheets } from './table-marks';

/** A drawing set ready to show or save: its pages, each as paper marks, made from one model revision and checked. */
export interface DrawingRelease {
  readonly pages: readonly Sheet[];
  readonly marks: readonly (readonly Mark[])[];
  readonly info: SheetSetInfo;
  readonly validation: ManufacturingValidation;
}

/** What the drawings are made from: the room and every piece in it as it stands. */
export function drawingInputOf(scene: EditorScene): DrawingInput {
  return { studio: scene.studio, pieces: scene.wardrobes.map(c => ({ id: c.id, name: c.name, x: c.x, y: c.y || 0, z: c.z, angle: c.angle, design: c.state })) };
}

/** The installation set with the clearances plan after the plans, as the viewer shows it. */
function drawingSheets(input: DrawingInput): Sheet[] {
  const sheets = technicalDrawings(input, { preset: 'installation', clearanceProfile: 'nkba-single' });
  const clearance = technicalDrawings(input, { preset: 'clearances', clearanceProfile: 'nkba-single' })[0];
  if (clearance) sheets.splice(sheets[1]?.title === 'Upper furniture plan' ? 2 : 1, 0, { ...clearance, title: 'Clearances plan' });
  return sheets;
}

/** The last sheet of every set: what was checked before manufacture, and what blocks it. */
function checkSheet(v: ManufacturingValidation): Sheet {
  const rows = v.findings.length
    ? [...v.findings].sort((a, b) => Number(b.severity === 'critical') - Number(a.severity === 'critical'))
      .map(f => [f.severity === 'critical' ? 'BLOCKING' : 'Review', f.marks.join(', ') || '—', f.message, f.rule])
    : [['Passed', '—', 'No findings', 'Geometry, assembly, cutting list and drawings checked against the model']];
  const notes = v.ready
    ? ['Checked against model revision ' + v.revision + ': every view, the cutting list and the hardware list on these sheets come from it.']
    : ['NOT FOR MANUFACTURE. Resolve every BLOCKING finding in the design, then save the drawings again. Model revision ' + v.revision + '.'];
  return { number: 0, title: 'Manufacturing check', views: [], pieces: [], checks: [], table: { columns: ['Status', 'Elements', 'Finding', 'Rule'], rows, numeric: [], notes } };
}

/**
 * The drawing set of a scene, checked for manufacture and failing closed: every page is laid out against one model
 * revision; annotations the layout could not place clear of the drawing are findings too; the set ends with the
 * Manufacturing check; and unless nothing blocks it, every page carries NOT FOR MANUFACTURE.
 */
export function releaseDrawings(scene: EditorScene, project: string, date: string): DrawingRelease {
  const input = drawingInputOf(scene), revision = modelRevision(input), pages = paginateDrawingSheets(drawingSheets(input));
  // The check sheet's length depends on the findings, and the findings on the layout: lay out again if it grows.
  let checkPages = 1;
  for (;;) {
    const info: SheetSetInfo = { project, date, total: pages.length + checkPages, revision };
    const laid = pages.map(p => sheetPresentation(p, info));
    const drawing: ManufacturingFinding[] = laid.flatMap((l, i) => l.warnings.length ? [{ id: 'annotations:' + pages[i]!.number, severity: 'critical' as const,
      area: 'drawing' as const, marks: [], message: 'Sheet ' + pages[i]!.number + ' (' + pages[i]!.title + '): ' + l.warnings.length + ' labels could not be placed clear of the drawing',
      rule: 'No label overlaps or hides another mark' }] : []);
    const validation = validateForManufacture(input, drawing);
    const check = paginateDrawingSheets([checkSheet(validation)]).map((s, i) => ({ ...s, number: pages.length + i + 1 }));
    if (check.length !== checkPages) { checkPages = check.length; continue; }
    const stamp = releaseStamp({ ready: validation.ready, revision, blocking: validation.findings.filter(f => f.severity === 'critical').length });
    const marks = [...laid.map(l => l.marks), ...check.map(s => sheetPresentation(s, info).marks)].map(m => [...m, ...stamp]);
    return { pages: [...pages, ...check], marks, info, validation };
  }
}

/** Whether a release still shows the scene as it is: a set made from an older revision must be made again. */
export const releaseCurrent = (release: DrawingRelease, scene: EditorScene) => modelRevision(drawingInputOf(scene)) === release.validation.revision;
