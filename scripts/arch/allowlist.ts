/**
 * Legacy code exempt from the layer rules (docs/architecture.md §9).
 *
 * Entries are repo-relative: a trailing `/` means "everything under this directory", otherwise an exact file.
 * Every refactor issue removes the entries for the module it moves; the goal is an empty list.
 * An entry that matches no file fails `npm run arch:check`, so the list can only shrink.
 */
export const LEGACY_ALLOWLIST: string[] = [
  // Server
  'src/server/app.ts',
  'src/server/app.test.ts',
  'src/server/config.ts',
  'src/server/events.ts',
  'src/server/events.test.ts',
  'src/server/index.ts',
  'src/server/leak-guard.ts',
  'src/server/leak-guard.test.ts',
  'src/server/network.ts',
  'src/server/auth/',
  'src/server/db/',
  'src/server/routes/',
  'src/server/services/',
  'src/server/test/',
  // Web
  'src/web/main.tsx',
  'src/web/router.tsx',
  'src/web/components/',
  'src/web/layouts/',
  'src/web/lib/',
  'src/web/pages/',
];
