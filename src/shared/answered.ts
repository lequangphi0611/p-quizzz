/** A question counts as answered when a choice is picked or the essay has non-blank text (PRODUCT.md §7.26). Shared by the member's question list and the mentor's progress column. */
export function isAnswered(a: { selectedOptionIds?: readonly number[] | null; textAnswer?: string | null } | undefined): boolean {
  if (!a) return false;
  return (a.selectedOptionIds?.length ?? 0) > 0 || (a.textAnswer ?? '').trim().length > 0;
}
