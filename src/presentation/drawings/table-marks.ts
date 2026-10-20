import type { Sheet, Table } from '../../domain/drawings/drawing';
import { type Mark, shape, words } from './paper-marks';
import { textWidth } from './helvetica-metrics';

const PAD = 1.6, LEADING = 3.8;
/** Wrap with the same Helvetica metrics used by the PDF; never shrink text to force a table to fit. */
export function wrapText(text: string, width: number, size = 3): string[] {
  const result: string[] = []; let line = '';
  for (const token of text.split(/\s+/)) {
    if (line && textWidth(line + ' ' + token, size) > width) { result.push(line); line = ''; }
    for (const ch of token) {
      if (line && textWidth(line + ch, size) > width) { result.push(line); line = ''; }
      line += ch;
    }
    line += ' ';
  }
  if (line.trim()) result.push(line.trim());
  return result.length ? result.map(l => l.trim()) : [''];
}
function layout(table: Table, width: number) {
  const desired = table.columns.map((c, k) => Math.max(20, Math.min(110,
    Math.max(textWidth(c, 3, true), ...table.rows.map(r => textWidth(r[k] ?? '', 3))) + 2 * PAD)));
  const total = desired.reduce((a, b) => a + b, 0), cols = desired.map(w => w * width / total);
  const rows = table.rows.map(r => r.map((cell, i) => wrapText(cell, cols[i]! - 2 * PAD)));
  const heights = rows.map(r => Math.max(...r.map(c => c.length), 1) * LEADING + 2 * PAD);
  return { cols, rows, heights };
}
/** Break long schedules into real pages using wrapped row heights. Screen and PDF use the same pages. */
export function paginateDrawingSheets(sheets: readonly Sheet[]): Sheet[] {
  const result: Sheet[] = [];
  for (const sheet of sheets) {
    if (!sheet.table) { result.push(sheet); continue; }
    const { table } = sheet, { heights } = layout(table, 378);
    const notes = table.notes.flatMap(n => wrapText(n, 374, 2.4)), available = 207 - notes.length * LEADING;
    let start = 0, used = 0, page = 1;
    for (let i = 0; i <= table.rows.length; i++) {
      if (i < table.rows.length && used + heights[i]! <= available) { used += heights[i]!; continue; }
      if (i > start || !table.rows.length) result.push({ ...sheet, title: sheet.title + (page > 1 ? ' · continued ' + page : ''),
        table: { ...table, rows: table.rows.slice(start, i) } });
      start = i; used = heights[i] ?? 0; page++;
    }
  }
  return result.map((s, i) => ({ ...s, number: i + 1 }));
}
export function tableMarks(table: Table, area: { x: number; y: number; w: number }): Mark[] {
  const { cols, rows, heights } = layout(table, area.w), xs = cols.map((_, i) => area.x + cols.slice(0, i).reduce((a, b) => a + b, 0));
  const rule = (y: number) => shape([{ x: area.x, y }, { x: area.x + area.w, y }], 'rule');
  const cell = (text: string, col: number, y: number, header = false) => words({ x: table.numeric.includes(col) ? xs[col]! + cols[col]! - PAD : xs[col]! + PAD, y },
    text, header ? 'head' : 'cell', table.numeric.includes(col) ? 'end' : 'start');
  let y = area.y;
  const headers = table.columns.map((c, i) => wrapText(c, cols[i]! - 2 * PAD));
  const headerH = Math.max(...headers.map(h => h.length)) * LEADING + 2 * PAD;
  const out: Mark[] = [rule(y)];
  headers.forEach((h, i) => h.forEach((l, k) => out.push(cell(l, i, y + PAD + 3 + k * LEADING, true))));
  y += headerH; out.push(rule(y));
  rows.forEach((row, index) => {
    row.forEach((lines, col) => lines.forEach((text, k) => out.push(cell(text, col, y + PAD + 3 + k * LEADING))));
    y += heights[index]!; out.push(rule(y));
  });
  y += 5;
  for (const n of table.notes) for (const l of wrapText(n, area.w - 2, 2.4)) { out.push(words({ x: area.x + 1, y }, l, 'small')); y += LEADING; }
  return out;
}
