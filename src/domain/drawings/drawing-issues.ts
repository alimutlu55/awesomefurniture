import type { Studio } from '../studio/studio';
import { mm, type DrawingIssue } from './drawing';
import type { PlacedPiece } from './room-pieces';
import { plan } from './plan-symbols';

/** Turn legacy construction messages into locatable issues while retaining printable checks. */
export function constructionIssues(messages: readonly string[], pieces: readonly PlacedPiece[]): DrawingIssue[] {
  return messages.map((message, i) => {
    const members = pieces.filter(p => new RegExp('\\b' + p.mark + '\\b').test(message));
    const p = members[0];
    return { id: 'geometry:' + i, kind: 'geometry', severity: 'warning', message, marks: members.map(p => p.mark),
      ...(p ? { at: plan(p.x, p.z) } : {}), rule: 'Model geometry and room envelope' };
  });
}

/** Tiny positive gaps and mounting mismatches are placement issues, never rounded out of the design. */
export function alignmentIssues(studio: Studio | undefined, pieces: readonly PlacedPiece[]): DrawingIssue[] {
  const issues: DrawingIssue[] = [];
  for (const wall of studio?.walls ?? []) {
    const members = pieces.filter(p => p.wall === wall.id && !p.fixture);
    for (const upper of [false, true]) {
      const row = members.filter(p => (p.y >= 120) === upper).sort((a, b) => a.lo - b.lo);
      for (let i = 1; i < row.length; i++) {
        const a = row[i - 1]!, b = row[i]!, gap = mm(b.lo - a.hi), delta = mm(Math.abs(b.y - a.y));
        const issue = (kind: string, value: number, message: string) => issues.push({ id: kind + ':' + a.id + ':' + b.id,
          kind: 'alignment', severity: 'review', message, marks: [a.mark, b.mark], at: plan(b.x, b.z), measured: value, rule: 'Placement review: differences below 5 mm' });
        if (gap > 0 && gap < 5) issue('gap', gap, a.mark + ' / ' + b.mark + ': verify ' + gap + ' mm gap');
        if (upper && gap >= -5 && gap < 10 && delta > 0 && delta < 5)
          issue('level', delta, a.mark + ' / ' + b.mark + ': undersides differ by ' + delta + ' mm');
      }
    }
  }
  return issues;
}
