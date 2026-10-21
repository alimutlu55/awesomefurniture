type Sheet = Record<string, unknown> & { issues?: unknown; views?: unknown };
type Issue = { kind?: unknown; severity?: unknown; message?: unknown; marks?: unknown; rule?: unknown };

const nonEmpty = (value: unknown) => value !== undefined && value !== null && !(Array.isArray(value) && value.length === 0);

/**
 * The model and the browser preview share this compact specification. It keeps what
 * informs a photograph: drawing vector primitives (`views`) duplicate the design geometry and the
 * references, and every sheet repeats the same review issues, so these are removed/deduplicated.
 */
export function modelSpecification(specification: unknown): unknown {
  if (!specification || typeof specification !== 'object') return specification;
  const { technicalDrawings, ...rest } = specification as { technicalDrawings?: unknown };
  if (!Array.isArray(technicalDrawings)) return specification;
  const issues = new Map<string, Issue>();
  const sheets = technicalDrawings.map(raw => {
    const { issues: sheetIssues, views, ...sheet } = (raw ?? {}) as Sheet;
    if (Array.isArray(sheetIssues)) for (const issue of sheetIssues as Issue[]) {
      const compact = { kind: issue.kind, severity: issue.severity, message: issue.message, marks: issue.marks, rule: issue.rule };
      issues.set(JSON.stringify(compact), compact);
    }
    const viewTitles = Array.isArray(views) ? views.map(view => (view as { title?: unknown })?.title).filter(nonEmpty) : [];
    return Object.fromEntries(Object.entries({ ...sheet, viewTitles }).filter(([, value]) => nonEmpty(value)));
  });
  return { ...rest, technicalDrawings: sheets, reviewIssues: [...issues.values()] };
}

