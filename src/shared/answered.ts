/** A question counts as answered when a choice is picked or the essay has non-blank text (PRODUCT.md §7.26). Shared by the member's question list and the mentor's progress column. */
export function isAnswered(a: { selectedOptionIds?: readonly number[] | null; textAnswer?: string | null } | undefined): boolean {
  if (!a) return false;
  return (a.selectedOptionIds?.length ?? 0) > 0 || (a.textAnswer ?? '').trim().length > 0;
}

/** A `{reason}` question with a pick but no (non-blank) reason: blocks a manual submit (PRODUCT.md §7.32b). Leaving the whole question blank is fine. */
export function isMissingReason(
  q: { requireReason: boolean },
  a: { selectedOptionIds?: readonly number[] | null; reasonText?: string | null } | undefined,
): boolean {
  return q.requireReason && (a?.selectedOptionIds?.length ?? 0) > 0 && (a?.reasonText ?? '').trim().length === 0;
}
