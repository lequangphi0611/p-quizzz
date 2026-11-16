/**
 * Legacy code exempt from the layer rules (docs/architecture.md §9).
 *
 * Entries are repo-relative: a trailing `/` means "everything under this directory", otherwise an exact file.
 * Every refactor issue removes the entries for the module it moves; the goal is an empty list.
 * An entry that matches no file fails `npm run arch:check`, so the list can only shrink.
 */
export const LEGACY_ALLOWLIST: string[] = [];
