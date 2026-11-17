// Splits an essay question's explanation (model answer + rubric, docs/exam-format.md) into scored criteria.
// Shared by the server (AI grading prompt, PRODUCT.md §7.28) and the web (the T1…Tn rubric grid).

export interface RubricCriterion {
  text: string;
  points: number;
}

export interface ParsedRubric {
  criteria: RubricCriterion[];
  /** Everything that is not a criterion line: the model answer and any notes, as Markdown. */
  model: string;
}

// A list item ("- ", "* ", "1. ") that ends with its points in brackets: "(1,5đ)", "(2 điểm)", "(1.5 đ)".
const CRITERION = /^\s*(?:[-*+]|\d+[.)])\s+(.*\S)\s*[([]\s*(\d+(?:[.,]\d+)?)\s*(?:đ|điểm|d|pts?)\s*[)\]]\s*\.?\s*$/i;

/** Whether the question has a rubric at all (any text). Without one the AI does not grade it. */
export const hasRubric = (explanation: string | null | undefined): boolean => !!explanation && explanation.trim() !== '';

/**
 * The scored criteria of a rubric, or `null` when it cannot be split: no criterion lines, or their points do not add up
 * to the question's points (then the rubric is used as free text).
 */
export function parseRubric(explanation: string | null | undefined, points: number): ParsedRubric | null {
  if (!hasRubric(explanation)) return null;
  const criteria: RubricCriterion[] = [];
  const rest: string[] = [];
  for (const line of explanation!.split('\n')) {
    const m = CRITERION.exec(line);
    if (m) criteria.push({ text: m[1]!.replace(/[\s:–—-]+$/, '').trim(), points: Number(m[2]!.replace(',', '.')) });
    else rest.push(line);
  }
  if (criteria.length === 0) return null;
  const sum = criteria.reduce((t, c) => t + c.points, 0);
  if (Math.abs(sum - points) > 1e-9) return null;
  return { criteria, model: rest.join('\n').trim() };
}
