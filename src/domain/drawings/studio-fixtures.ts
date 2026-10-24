import type { Studio } from '../studio/studio';
import { wallFace, wallLine } from '../studio/studio';
import type { FixtureAnchor } from '../studio/fixtures/fixture';
import { fixturePose, enclosurePose, localPose } from '../studio/fixtures/fixture-geometry';
import { fixtureDefinition, fixtureVariant } from '../studio/fixtures/fixture-catalog';
import { fixtureFindings } from '../studio/fixtures/fixture-validation';
import { mm, note, rect, type Item, type Table, type DrawingIssue } from './drawing';

const mark = (id: string) => id.startsWith('fx') ? 'F' + id.slice(2) : 'E' + id.replace(/^fe/, '');
function hostWall(s: Studio, anchor: FixtureAnchor, seen = new Set<string>()): string | null {
  if (anchor.kind === 'wall') return anchor.wall;
  if (anchor.kind === 'floor') return null;
  const id = anchor.kind === 'fixture' ? anchor.fixture : anchor.enclosure;
  if (seen.has(id)) return null;
  const next = anchor.kind === 'fixture' ? s.fixtures?.find(f => f.id === id) : s.enclosures?.find(e => e.id === id);
  return next ? hostWall(s, next.anchor, new Set(seen).add(id)) : null;
}

export function studioFixturePlan(s: Studio | undefined): Item[] {
  if (!s) return [];
  const out: Item[] = [];
  for (const item of [...s.enclosures ?? [], ...s.fixtures ?? []]) {
    const p = 'kind' in item ? fixturePose(s, item) : enclosurePose(s, item);
    if (!p) continue;
    const points = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => {
      const q = localPose(p, x! * item.w / 2, 0, z! * item.d / 2); return { x: mm(q.x), y: -mm(q.z) };
    });
    out.push({ kind: 'line', closed: true, points, stroke: p.y >= 120 ? 'overhead' : 'outline' });
    out.push(note({ x: mm(p.x), y: -mm(p.z) }, mark(item.id)));
    if ('kind' in item && ['toilet', 'basin', 'bath'].includes(fixtureDefinition(item.kind)!.shape)) {
      out.push({ kind: 'line', closed: true, stroke: 'thin', points: Array.from({ length: 32 }, (_, i) => {
        const a = i * Math.PI / 16, q = localPose(p, Math.cos(a) * item.w * .4, 0, Math.sin(a) * item.d * .4);
        return { x: mm(q.x), y: -mm(q.z) };
      }) });
    }
  }
  return out;
}

export function studioFixtureElevation(s: Studio, wallId: string): Item[] {
  const wall = s.walls.find(w => w.id === wallId), face = wall && wallFace(s, wall), line = wall && wallLine(s, wall);
  if (!face || !line) return [];
  const out: Item[] = [];
  for (const item of [...s.enclosures ?? [], ...s.fixtures ?? []]) {
    if (hostWall(s, item.anchor) !== wallId) continue;
    const p = 'kind' in item ? fixturePose(s, item) : enclosurePose(s, item);
    if (!p) continue;
    const x = (p.x - face.from.x) * line.ux + (p.z - face.from.z) * line.uz;
    out.push(rect(mm(x - item.w / 2), mm(p.y), mm(x + item.w / 2), mm(p.y + item.h), 'outline'));
    out.push(note({ x: mm(x), y: mm(p.y + item.h + 8) }, mark(item.id) + ' · top FFL ' + mm(p.y + item.h)));
    if ('kind' in item && item.kind === 'toilet' && item.installation) out.push(rect(mm(x - 11), 930, mm(x + 11), 1070, 'thin'));
  }
  return out;
}

export function studioFixtureSchedule(s: Studio | undefined): Table | undefined {
  if (!s || (!s.fixtures?.length && !s.enclosures?.length)) return undefined;
  const rows: string[][] = [];
  for (const item of [...s.enclosures ?? [], ...s.fixtures ?? []]) {
    const p = 'kind' in item ? fixturePose(s, item) : enclosurePose(s, item);
    if (!p) continue;
    const wallId = hostWall(s, item.anchor), wall = s.walls.find(w => w.id === wallId), face = wall && wallFace(s, wall), line = wall && wallLine(s, wall);
    const position = face && line ? 'Wall ' + String.fromCharCode(65 + s.walls.indexOf(wall!)) + ': CL '
      + mm((p.x - face.from.x) * line.ux + (p.z - face.from.z) * line.uz) + ' from finished left; '
      + mm((p.x - face.from.x) * line.nx + (p.z - face.from.z) * line.nz) + ' from finished face'
      : 'Scene CL X ' + mm(p.x) + '; Z ' + mm(p.z) + '; rotation ' + p.angle;
    const name = 'kind' in item ? fixtureDefinition(item.kind)!.name + ' · ' + fixtureVariant(item.kind, item.variant)!.name : item.name;
    const installation = 'kind' in item ? item.anchor.kind === 'enclosure' ? 'On ' + mark(item.anchor.enclosure) : item.installation ? 'Existing concealed support unconfirmed' : item.anchor.kind
      : item.form + '; ' + item.finish + '; lining ' + mm(item.lining);
    rows.push([mark(item.id) + ' ' + name, [item.w, item.h, item.d].map(mm).join(' × '), position + '; underside FFL ' + mm(p.y), installation,
      'kind' in item ? fixtureFindings(s, item.id).map(i => i.message).join(' ') : 'Finished outer dimensions; confirm installation details.']);
  }
  return { columns: ['Reference / item', 'W × H × D (mm)', 'Setting out (mm)', 'Installation', 'Review'], rows, numeric: [],
    notes: ['Generic planning objects. Confirm manufacturer dimensions, support, service access and connection positions.',
      'F = fixture; E = enclosure; CL = centre line; FFL = finished floor. Enclosures are scheduled once even when shared.'] };
}
export function studioFixtureIssues(s: Studio | undefined): DrawingIssue[] {
  return s?.fixtures?.flatMap(f => fixtureFindings(s, f.id).map(i => ({ id: 'fixture:' + f.id + ':' + i.id, kind: 'unconfirmed' as const,
    severity: 'review' as const, marks: [mark(f.id)], message: i.message, rule: 'Generic fixture installation review' }))) ?? [];
}
