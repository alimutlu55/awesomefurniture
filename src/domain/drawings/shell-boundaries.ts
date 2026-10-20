import { cornerDegree, type Studio, type StudioWall } from '../studio/studio';
import { type Item, type P, line, mm, rect } from './drawing';

/** An exposed wall end is a break in the room envelope, never an invented closing wall. */
export function planEndBreak(at: (t: number, s: number) => P, t: number, half: number): Item {
  return { kind: 'line', stroke: 'cut', points: [at(t, -half), at(t, -half / 3), at(t - 3, 0), at(t + 3, half / 3), at(t, half)] };
}

/** Wall face and adjacent wall sections; an open end is drawn with a vertical break. */
export function elevationShell(studio: Studio, wall: StudioWall, length: number): Item[] {
  const w = mm(length), h = mm(wall.height), out: Item[] = [line({ x: 0, y: 0 }, { x: w, y: 0 }, 'thin'), line({ x: 0, y: h }, { x: w, y: h }, 'thin')];
  for (const [id, x, sign] of [[wall.a, 0, -1], [wall.b, w, 1]] as const) {
    if (cornerDegree(studio, id) === 1) {
      out.push({ kind: 'line', stroke: 'thin', points: [{ x, y: 0 }, { x, y: h / 2 - 60 },
        { x: x - 30, y: h / 2 - 20 }, { x: x + 30, y: h / 2 + 20 }, { x, y: h / 2 + 60 }, { x, y: h }] });
    } else {
      const other = studio.walls.find(q => q.id !== wall.id && (q.a === id || q.b === id));
      const outer = x + sign * mm(other?.thickness ?? wall.thickness);
      out.push(rect(Math.min(x, outer), 0, Math.max(x, outer), h, 'cut', 'hatch'));
    }
  }
  return out;
}
