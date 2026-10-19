import type { Table } from '../../domain/drawings/drawing';

const f = (n: number) => String(Math.round(n * 100) / 100);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Row height and lettering of a schedule on paper (2.5 mm figures). Millimetres. */
const ROW = 5.8, CHAR = 1.75, PAD = 1.6;

/** A schedule drawn as a ruled table across `area`: a heavy header rule, thin rules between rows, numbers set right,
 * each column as wide as its longest entry (the last column takes what is left), and its notes under it. */
export function tableSvg(table: Table, area: { x: number; y: number; w: number }): string {
  const widths = table.columns.map((c, k) => Math.max(c.length, ...table.rows.map(r => (r[k] ?? '').length)) * CHAR + 2 * PAD);
  const fixed = widths.slice(0, -1).reduce((a, b) => a + b, 0), last = Math.max(widths[widths.length - 1]!, area.w - fixed);
  const cols = [...widths.slice(0, -1), last], k = Math.min(1, area.w / cols.reduce((a, b) => a + b, 0)), xs = cols.map((_, i) => area.x + cols.slice(0, i).reduce((a, b) => a + b, 0) * k);
  const cell = (text: string, col: number, y: number, cls: string) => {
    const right = table.numeric.includes(col), x = right ? xs[col]! + cols[col]! * k - PAD : xs[col]! + PAD;
    return `<text class="${cls}" x="${f(x)}" y="${f(y)}"${right ? ' text-anchor="end"' : ''}>${esc(text)}</text>`;
  };
  const right = area.x + area.w;
  let out = `<line class="tbh" x1="${area.x}" y1="${f(area.y)}" x2="${f(right)}" y2="${f(area.y)}"/>`;
  out += table.columns.map((c, col) => cell(c, col, area.y + ROW - 1.7, 'th')).join('');
  out += `<line class="tbh" x1="${area.x}" y1="${f(area.y + ROW)}" x2="${f(right)}" y2="${f(area.y + ROW)}"/>`;
  table.rows.forEach((r, i) => {
    const y = area.y + ROW * (i + 2);
    out += r.map((text, col) => cell(text, col, y - 1.7, 'td')).join('') + `<line class="tbl" x1="${area.x}" y1="${f(y)}" x2="${f(right)}" y2="${f(y)}"/>`;
  });
  const end = area.y + ROW * (table.rows.length + 1);
  out += `<line class="tbh" x1="${area.x}" y1="${f(end)}" x2="${f(right)}" y2="${f(end)}"/>`;
  out += table.notes.map((n, i) => `<text class="ns" x="${area.x}" y="${f(end + 5 + i * 3.8)}">${esc(n)}</text>`).join('');
  return out;
}
