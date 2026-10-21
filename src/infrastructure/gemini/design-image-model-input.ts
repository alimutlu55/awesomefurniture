import { ImageGenerationError } from './image-generation-error.ts';

/**
 * Gemini Nano Banana 2.1 accepts 131,072 input tokens. Numeric JSON can tokenize at roughly two
 * characters per token, so this keeps the specification text well clear of the limit after the
 * system prompt and three reference images are added.
 */
export const MAX_MODEL_SPECIFICATION_CHARS = 200_000;

type Sheet = Record<string, unknown> & { issues?: unknown; views?: unknown };
type Issue = { kind?: unknown; severity?: unknown; message?: unknown; marks?: unknown; rule?: unknown };

const nonEmpty = (value: unknown) => value !== undefined && value !== null && !(Array.isArray(value) && value.length === 0);

/**
 * The browser JSON download keeps the full installation drawing set. The model only needs what
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

export function modelSpecificationText(specification: unknown): string {
  const text = JSON.stringify(modelSpecification(specification));
  if (text.length > MAX_MODEL_SPECIFICATION_CHARS) {
    throw new ImageGenerationError(413, 'TOO_LARGE', 'This design is too large to create an image.');
  }
  return text;
}
