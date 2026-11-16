import { fileURLToPath } from 'node:url';
import { LEGACY_ALLOWLIST } from './arch/allowlist.js';
import { checkArchitecture, collectSourceFiles } from './arch/check.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const { violations, staleAllowlist } = checkArchitecture(collectSourceFiles(root), LEGACY_ALLOWLIST);

for (const v of violations) console.error(`${v.file}:${v.line}  ${v.message}${v.spec ? `  (import '${v.spec}')` : ''}`);
for (const e of staleAllowlist) console.error(`scripts/arch/allowlist.ts: stale entry "${e}" matches no file, remove it`);

if (violations.length || staleAllowlist.length) {
  console.error(`\narch:check failed: ${violations.length} violation(s), ${staleAllowlist.length} stale allowlist entr${staleAllowlist.length === 1 ? 'y' : 'ies'}.`);
  process.exit(1);
}
console.log('arch:check ok');
