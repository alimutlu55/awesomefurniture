import type { Table } from '../../domain/drawings/drawing';
import { type Mark, shape, words } from './paper-marks';

/** Row height and lettering of a schedule on paper (2.5 mm figures). Millimetres. */
const ROW = 5.8, CHAR = 1.75, PAD = 1.6;

/** A schedule drawn as a ruled table across `area`: a heavy header rule, thin rules between rows, numbers set right,
 * each column as wide as its longest entry (the last column takes what is left), and its notes under it. */
export function tableMarks(table: Table, area: { x: number; y: number; w: number }): Mark[] {
  const widths = table.columns.map((c, k) => Math.max(c.length, ...table.rows.map(r => (r[k] ?? '').length)) * CHAR + 2 * PAD);
  const fixed = widths.slice(0, -1).reduce((a, b) => a + b, 0), last = Math.max(widths[widths.length - 1]!, area.w - fixed);
  const cols = [...widths.slice(0, -1), last], k = Math.min(1, area.w / cols.reduce((a, b) => a + b, 0)), xs = cols.map((_, i) => area.x + cols.slice(0, i).reduce((a, b) => a + b, 0) * k);
  const cell = (text: string, col: number, y: number, font: 'head' | 'cell') => {
    const right = table.numeric.includes(col);
    return words({ x: right ? xs[col]! + cols[col]! * k - PAD : xs[col]! + PAD, y }, text, font, right ? 'end' : 'start');
  };
  const right = area.x + area.w, rule = (y: number, pen: 'heavy' | 'rule') => shape([{ x: area.x, y }, { x: right, y }], pen);
  const out: Mark[] = [rule(area.y, 'heavy'), ...table.columns.map((c, col) => cell(c, col, area.y + ROW - 1.7, 'head')), rule(area.y + ROW, 'heavy')];
  table.rows.forEach((r, i) => {
    const y = area.y + ROW * (i + 2);
    out.push(...r.map((text, col) => cell(text, col, y - 1.7, 'cell')), rule(y, 'rule'));
  });
  const end = area.y + ROW * (table.rows.length + 1);
  out.push(rule(end, 'heavy'), ...table.notes.map((n, i) => words({ x: area.x, y: end + 5 + i * 3.8 }, n, 'small')));
  return out;
}
