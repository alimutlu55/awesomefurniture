import { WardrobePlanner } from '../../domain/planner/wardrobe-planner.js';
import { z } from 'zod';
import type { ProjectDocument } from '../../domain/project/project';
import type { StoredProject } from '../../application/ports/project-repository';
import { ALL_PURPOSES, POSSESSIONS } from '../../domain/wardrobe/possessions';
import type { Needs } from '../../domain/wardrobe/possessions';
import type { StoragePurpose } from '../../domain/wardrobe/wardrobe';
import { SHAPE_TEMPLATE_IDS, maxHeight, resolveShape, shapeProblems } from '../../domain/wardrobe/shape/wardrobe-shape';

const id = z.string().trim().min(1);
const finite = z.number().finite();
const positive = finite.positive();
const nonnegative = finite.nonnegative();
const count = nonnegative.int();
// Purposes and needs come from the possessions registry: a new possession is accepted here with no edit.
const purposeEnum = z.enum(ALL_PURPOSES as unknown as [string, ...string[]]) as unknown as z.ZodEnum<{ [K in StoragePurpose]: K }>;
const needsSchema = z.strictObject(Object.fromEntries(POSSESSIONS.map(p => [p.key, p.engine === 'bespoke' ? count : count.optional()]))) as unknown as z.ZodType<Needs>;
const name = z.string().trim().min(1).max(120);
const editorItem = z.strictObject({
  id:id.optional(),
  k: z.enum(['drawer','sdrawer','void','shelf','folded','seasonal','short','long','pants','shoe','basket','lift']),
  f: z.enum(['Oak','White','Walnut','Graphite','Sage']).nullable().optional(),
  h: nonnegative, purpose: purposeEnum.optional(),
  w: positive.optional(), x: nonnegative.optional(), y: nonnegative.optional(), ax: z.enum(['l','c','r']).optional(),
  front: z.boolean().optional(), boxes: count.optional(),
});
const area = z.strictObject({x0:nonnegative,x1:positive,y0:nonnegative,y1:positive});
const editorDivider = z.strictObject({
  id:id.optional(),
  i: count.max(5), orientation:z.enum(['horizontal','vertical']), want: nonnegative.optional(),
  x: nonnegative.optional(), y: nonnegative.optional(), x0: nonnegative.optional(), x1: positive.optional(), y0: nonnegative.optional(), y1: positive.optional(),
  area:area.optional(),
}).superRefine((d,ctx)=>{
  const valid=d.orientation==='horizontal'?d.x0!==undefined&&d.x1!==undefined&&d.x1>d.x0&&d.y!==undefined:d.x!==undefined&&d.y0!==undefined&&d.y1!==undefined&&d.y1>d.y0;
  if(!valid)ctx.addIssue({code:'custom',message:'Invalid divider extent'});
});
const editorLayout = z.strictObject({
  cabinetId:count.positive(), weights:z.array(positive).length(6), reachStd:positive.optional(), engaged:z.boolean().optional(), reachLine:z.boolean().optional(),
  proposal:z.strictObject({title:z.string(),summary:z.string()}).nullable(),
});
const shape = z.strictObject({
  template: z.enum(SHAPE_TEMPLATE_IDS),
  top: z.array(z.strictObject({ x: nonnegative, y: positive, partition: count.max(4).optional() })).min(2).max(40),
});
const item = z.strictObject({
  editorItem: editorItem.optional(),
  id,
  kind: z.enum(['drawer', 'sdrawer', 'void', 'shelf', 'folded', 'seasonal', 'short', 'long', 'pants', 'shoe', 'basket', 'lift']),
  purpose: purposeEnum,
  width: positive,
  height: nonnegative,
  x: nonnegative,
  y: nonnegative,
  frontFacing: z.boolean(),
  boxes: count.nullable(),
});
const divider = z.strictObject({
  editorDivider: editorDivider.optional(),
  id, orientation: z.enum(['horizontal', 'vertical']),
  x: nonnegative, y: nonnegative, length: positive, thickness: positive,
});
const section = z.strictObject({
  id, width: positive, items: z.array(item), dividers: z.array(divider),
});
const wardrobe = z.strictObject({
  editorLayout: editorLayout.optional(),
  id, name,
  dimensions: z.strictObject({ width: positive, height: positive, depth: positive }),
  position: z.strictObject({ x: finite, y: nonnegative, z: finite }),
  rotation: finite,
  finish: z.enum(['Oak', 'White', 'Walnut', 'Graphite', 'Sage']),
  doors: z.enum(['none', 'solid', 'glass']),
  sections: z.array(section),
  shape: shape.optional(),
  preferences: z.strictObject({
    boxWidth:positive.max(100).optional(), boxHeight:positive.max(60).optional(), boxDepth:positive.max(100).optional(),
    composition:z.enum(['balanced','storage']).optional(),
    needs: needsSchema,
    reach: positive, longDrop: positive,
    upper: z.enum(['none', 'auto', 'more', 'fill']),
    drawers: z.enum(['none', 'auto', 'more']),
    allowLift: z.boolean(), density: z.enum(['compact', 'comfort', 'spacious']),
    growth: nonnegative, jackets: count, coats: count, accessible: z.boolean(), budget: nonnegative,
  }),
}).superRefine((cabinet, context) => {
  const fail = (message: string) => context.addIssue({code:'custom', message});
  const close = (a: number, b: number) => Math.abs(a-b)<.001;
  if (cabinet.editorLayout) {
    const n=cabinet.sections.length, weights=cabinet.editorLayout.weights;
    if(n<1 || n>6) fail('An editor wardrobe must have between one and six sections.');
    const total=weights.slice(0,n).reduce((a,b)=>a+b,0);
    cabinet.sections.forEach((section,i)=>{
      const width=(cabinet.dimensions.width-(n+1)*1.8)*weights[i]!/total;
      if(!close(section.width,width)) fail('Section weights disagree with the canonical widths.');
    });
  }
  if (cabinet.shape) {
    // Skeletons are checked against the same rules the editor enforces.
    const n=cabinet.sections.length, resolved=resolveShape({w:cabinet.dimensions.width,h:cabinet.dimensions.height,n,wt:cabinet.sections.map(s=>s.width),shape:cabinet.shape});
    for (const problem of shapeProblems(resolved,cabinet.dimensions.width)) fail('Invalid wardrobe shape: '+problem);
    if (!close(maxHeight(resolved),cabinet.dimensions.height)) fail('Wardrobe height disagrees with its shape.');
  }
  cabinet.sections.forEach((section,i)=>{
    const raw=section.items.map(it=>it.editorItem??{k:it.kind,h:it.height,w:it.width,x:it.x,y:it.y});
    const positions=WardrobePlanner.layoutSection(raw,section.width);
    section.items.forEach((it,j)=>{
      const hint=it.editorItem;
      if(!hint)return;
      const position=positions[j]!;
      if((hint.id!==undefined&&hint.id!==it.id) || hint.k!==it.kind || hint.h!==it.height || (hint.purpose!==undefined&&hint.purpose!==it.purpose) || (hint.front??false)!==it.frontFacing || (hint.boxes??null)!==it.boxes || !close(position.w,it.width) || !close(position.x0,it.x) || !close(position.y0,it.y)) fail('Item layout intent disagrees with the canonical item.');
    });
    section.dividers.forEach(d=>{
      const hint=d.editorDivider;
      if(!hint)return;
      const x=hint.orientation==='horizontal'?hint.x0!:hint.x!-1.8/2;
      const y=hint.orientation==='horizontal'?hint.y!-1.8/2:hint.y0!;
      const length=hint.orientation==='horizontal'?hint.x1!-hint.x0!:hint.y1!-hint.y0!;
      if((hint.id!==undefined&&hint.id!==d.id) || hint.i!==i || hint.orientation!==d.orientation || !close(x,d.x) || !close(y,d.y) || !close(length,d.length) || !close(d.thickness,1.8)) fail('Divider layout intent disagrees with the canonical divider.');
    });
  });
});
const projectSchema = z.strictObject({
  schemaVersion: z.literal(1), id, name, units: z.literal('cm'), wardrobes: z.array(wardrobe),
}).superRefine((project, context) => {
  const ids = new Set<string>([project.id]);
  const cabinetIds = new Set<number>();
  const check = (entity: { id: string }) => {
    if (ids.has(entity.id)) context.addIssue({ code: 'custom', message: `Duplicate entity ID: ${entity.id}` });
    ids.add(entity.id);
  };
  for (const cabinet of project.wardrobes) {
    check(cabinet);
    if(cabinet.editorLayout){
      const id=cabinet.editorLayout.cabinetId;
      if(cabinetIds.has(id)) context.addIssue({code:'custom',message:'Duplicate editor cabinet ID'});
      cabinetIds.add(id);
    }
    for (const bay of cabinet.sections) {
      check(bay);
      bay.items.forEach(check);
      bay.dividers.forEach(check);
    }
  }
});
const storedSchema = z.strictObject({
  document: projectSchema,
  revision: z.number().int().positive(),
  updatedAt: z.iso.datetime(),
});

/** Add explicit sequential migrations here when schemaVersion 2 is introduced.
 * Unknown versions are rejected, never silently reset or written over.
 * This validates persisted shape; geometry rules belong in the domain layer.
 */
export function parseProject(value: unknown): ProjectDocument {
  return projectSchema.parse(value);
}

export function parseStoredProject(value: unknown): StoredProject {
  return storedSchema.parse(value);
}

export function serializeProject(project: ProjectDocument): string {
  return JSON.stringify(parseProject(project), null, 2);
}

export function deserializeProject(json: string): ProjectDocument {
  return parseProject(JSON.parse(json) as unknown);
}
